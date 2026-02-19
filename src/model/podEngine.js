import { clamp } from '../utils/math.js';

/* ================================================================
   Safe accessors — pull per-target values from config, with fallbacks
   ================================================================ */

function targetDef(config, targetKey) {
  return config?.targets?.[targetKey] || {};
}

/**
 * Condition factors are organized by target:
 *   config.condition_factors[targetKey][axis][level]
 * Detectability level keys in YAML are strings ('1'..'5'); cast input to string.
 */
function conditionFactor(config, axis, level, targetKey) {
  return Number(config?.condition_factors?.[targetKey]?.[axis]?.[String(level)] ?? 1);
}

/**
 * Spacing bounds from config.spacing_bounds_m.
 * Falls back to config.reference_spacing_bounds_m for backward compat.
 */
function spacingBounds(config, targetKey) {
  const sb = config?.spacing_bounds_m;
  if (sb) {
    return {
      min_effective: Number(sb.min_effective_actual_spacing_m_by_target?.[targetKey] ?? 1),
      max_effective: Number(sb.max_effective_actual_spacing_m_by_target?.[targetKey] ?? 200)
    };
  }
  // Fallback to legacy structure
  const rb = config?.reference_spacing_bounds_m || {};
  return {
    min_effective: Number(rb.min_by_target?.[targetKey] ?? 1),
    max_effective: Number(rb.max_by_target?.[targetKey] ?? 200)
  };
}

function subjectVisibilityFactor(config, level) {
  return Number(config?.subject_visibility_factor?.[level] ?? 1);
}

let _configWarned = false;
function warnMissingConfigKeys(config) {
  const keys = ['subject_visibility_factor', 'ui_tooltips'];
  keys.forEach(k => {
    if (!config?.[k]) console.warn(`[POD] Config missing ${k}; using defaults`);
  });
}

function responseModel(config) {
  const rm = config?.response_model || {};
  return {
    enabled_for_groups: rm.enabled_for_groups || ['active_missing_person'],
    auditory_bonus: rm.auditory_bonus || { none: 0, possible: 0.05, likely: 0.10 },
    visual_bonus: rm.visual_bonus || { none: 0, possible: 0.03, likely: 0.07 },
    max_total_multiplier: Number(rm.max_total_multiplier ?? 1.25)
  };
}

/* ================================================================
   Primary target inference
   Uses primary_target_hierarchy.<group>.order for ALL groups.
   ================================================================ */

export function inferPrimaryTarget(selectedTargets, config, searchType) {
  const hierarchy = config?.primary_target_hierarchy || {};

  if (searchType === 'evidence_historical') {
    const order = hierarchy.evidence_historical?.order || [];
    return order.find((t) => selectedTargets.includes(t)) || selectedTargets[0] || null;
  }

  // Default: active_missing_person — always use .order sub-key
  const order = hierarchy.active_missing_person?.order
    || hierarchy.active_missing_person
    || ['adult', 'child', 'large_clues', 'small_clues'];
  const orderArr = Array.isArray(order) ? order : [];
  return orderArr.find((t) => selectedTargets.includes(t)) || selectedTargets[0] || null;
}

/* ================================================================
   Response multiplier (active_missing_person group only)
   M_resp = min(max_total_multiplier, 1 + auditory_bonus + visual_bonus)
   If target.group NOT in enabled_for_groups → 1.0
   ================================================================ */

export function responseMultiplier(searchLevel, config, targetKey) {
  const rm = responseModel(config);
  const target = targetDef(config, targetKey);
  const group = target.group || '';

  if (!rm.enabled_for_groups.includes(group)) return 1;

  const aud = Number(rm.auditory_bonus[searchLevel?.auditory || 'none'] ?? 0);
  const vis = Number(rm.visual_bonus[searchLevel?.visual || 'none'] ?? 0);
  return Math.min(rm.max_total_multiplier, 1 + aud + vis);
}

export function responseComponents(searchLevel, config, targetKey) {
  const rm = responseModel(config);
  const target = targetDef(config, targetKey);
  const group = target.group || '';

  if (!rm.enabled_for_groups.includes(group)) {
    return { auditory_bonus: 0, visual_bonus: 0, cap: rm.max_total_multiplier, M_resp: 1 };
  }

  const auditory_bonus = Number(rm.auditory_bonus[searchLevel?.auditory || 'none'] ?? 0);
  const visual_bonus = Number(rm.visual_bonus[searchLevel?.visual || 'none'] ?? 0);
  const cap = rm.max_total_multiplier;
  return { auditory_bonus, visual_bonus, cap, M_resp: Math.min(cap, 1 + auditory_bonus + visual_bonus) };
}

/* ================================================================
   Spacing ratio (replaces old spacingEffectiveness)
   spacing_ratio = (S_ref / S_eff_act) ^ spacing_exponent
   NOT capped at 1 — benefit is limited by min effective actual spacing.
   ================================================================ */

export function spacingEffectiveness(S_ref, S_eff_act, k) {
  if (!S_eff_act || S_eff_act <= 0) return 0;
  return (S_ref / S_eff_act) ** k;
}

/* ================================================================
   Completion multiplier
   M_comp = clamp(area_coverage_pct / 100, 0, 1)
   ================================================================ */

export function completionMultiplier(segment) {
  const pct = Number(segment?.area_coverage_pct ?? 100);
  return clamp(pct / 100, 0, 1);
}

/* ================================================================
   Full per-target POD computation — Exponential detection model

   1) condition_multiplier = F_time * F_weather * F_detectability
   2) base_hazard_rate = -ln(1 - base_detectability)
   3) reference_critical_spacing_m = base * condition_multiplier
   4) effective_actual_critical_spacing_m = max(actual, min_effective)
   5) spacing_ratio = (ref / eff_actual) ^ spacing_exponent
   6) responsiveness_multiplier (only for enabled groups)
   7) completion_multiplier = clamp(area_coverage_pct / 100, 0, 1)
   8) POD = clamp((1 - exp(-k * hazard * ratio * resp)) * comp, 0, 0.99)

   Calibration property: when k=1, ratio=1, resp=1, comp=1 → POD = base_detectability
   ================================================================ */

export function computeForTarget({ config, searchLevel, segment, targetKey }) {
  if (!_configWarned) { warnMissingConfigKeys(config); _configWarned = true; }

  const target = targetDef(config, targetKey);
  const bounds = spacingBounds(config, targetKey);

  // Per-target base values from config
  const base_detectability = Number(target.base_detectability ?? 0.80);
  const calibration_constant_k = Number(target.calibration_constant_k ?? 1.0);
  const base_reference_critical_spacing_m = Number(target.base_reference_critical_spacing_m ?? 8.0);
  const spacing_exponent = Number(target.spacing_exponent ?? 2.0);

  // Per-target condition factors (detectability_level key must be string)
  const F_time = conditionFactor(config, 'time_of_day', segment?.time_of_day || 'day', targetKey);
  const F_weather = conditionFactor(config, 'weather', segment?.weather || 'clear', targetKey);
  // detectability_level applies to evidence/historical only; active missing person uses the three new levers instead
  const F_detectability = searchLevel?.type_of_search === 'active_missing_person'
    ? 1.0
    : conditionFactor(config, 'detectability_level', segment?.detectability_level ?? 3, targetKey);

  // New factors (v2.2): search-level visibility + per-segment condition factors
  const F_visibility = subjectVisibilityFactor(config, searchLevel?.subject_visibility || 'medium');
  const F_veg = conditionFactor(config, 'vegetation_density', segment?.vegetation_density ?? 3, targetKey);
  const F_terrain = conditionFactor(config, 'micro_terrain_complexity', segment?.micro_terrain_complexity ?? 3, targetKey);
  const F_extenuating = conditionFactor(config, 'extenuating_factors', segment?.extenuating_factors ?? 3, targetKey);
  const F_burial = conditionFactor(config, 'burial_or_cover', segment?.burial_or_cover ?? 3, targetKey);

  // 1. condition_multiplier_for_target (includes new factors)
  // Missing axes fall back to 1.0 via conditionFactor: active targets lack burial_or_cover,
  // evidence targets lack extenuating_factors — so only the relevant factor has effect.
  const C_t = F_time * F_weather * F_detectability * F_visibility * F_veg * F_terrain * F_extenuating * F_burial;

  // 2. base_hazard_rate_for_target = -ln(1 - base_detectability)
  //    Guard against base_detectability >= 1 which would give Infinity
  const base_hazard_rate = -Math.log(1 - Math.min(base_detectability, 0.9999));

  // 3. reference_critical_spacing_m = base * condition_multiplier (NOT clamped)
  const S_ref = base_reference_critical_spacing_m * C_t;

  // 4. effective_actual_critical_spacing_m = max(actual, min_effective)
  const actual_spacing = Number(segment?.critical_spacing_m ?? 15);
  const min_effective = bounds.min_effective;
  const S_eff_act = Math.max(actual_spacing, min_effective);

  // 5. spacing_ratio = (S_ref / S_eff_act) ^ spacing_exponent (NOT capped at 1)
  const spacing_ratio = spacingEffectiveness(S_ref, S_eff_act, spacing_exponent);

  // 6. responsiveness_multiplier
  const response = responseComponents(searchLevel || {}, config, targetKey);
  const M_resp = response.M_resp;

  // 7. completion_multiplier = clamp(area_coverage_pct / 100, 0, 1)
  const M_comp = completionMultiplier(segment || {});

  // 8. POD = clamp((1 - exp(-k * hazard * ratio * resp)) * comp, 0, 0.99)
  const exponent_val = calibration_constant_k * base_hazard_rate * spacing_ratio * M_resp;
  const POD_raw = 1 - Math.exp(-exponent_val);
  const POD_final = clamp(POD_raw * M_comp, 0, 0.99);

  return {
    target: targetKey,
    // Per-target base values
    base_detectability,
    calibration_constant_k,
    base_reference_critical_spacing_m,
    spacing_exponent,
    // Spacing bounds
    min_effective,
    max_effective: bounds.max_effective,
    // Condition factors
    F_time,
    F_weather,
    F_detectability,
    F_visibility,
    F_veg,
    F_terrain,
    F_extenuating,
    F_burial,
    C_t,
    // Hazard rate
    base_hazard_rate,
    // Reference critical spacing (adjusted by conditions, NOT clamped)
    S_ref,
    // Effective actual spacing (clamped to min)
    S_eff_act,
    // Spacing ratio (uncapped)
    spacing_ratio,
    // Response
    M_resp,
    auditory_bonus: response.auditory_bonus,
    visual_bonus: response.visual_bonus,
    response_cap: response.cap,
    // Completion
    M_comp,
    // Final POD
    POD_raw,
    POD_final
  };
}

/* ================================================================
   Target selection from search-level state
   ================================================================ */

export function selectedTargets(searchLevel) {
  if (searchLevel.type_of_search === 'active_missing_person') {
    return searchLevel.active_targets || [];
  }
  const targets = [];
  const cats = searchLevel.evidence_categories || ['remains'];
  if (cats.includes('remains') && searchLevel.remains_state) {
    targets.push(searchLevel.remains_state);
  }
  if (cats.includes('evidence')) {
    targets.push(...(searchLevel.evidence_classes || []));
  }
  return targets;
}

/* ================================================================
   QA warning flags
   Reads whatever flags exist in config.qa_flags.
   ================================================================ */

export function generateQaWarnings(segment, config) {
  const warnings = [];
  const flags = config?.qa_flags || {};
  const spacing = Number(segment?.critical_spacing_m);
  const pct = Number(segment?.area_coverage_pct ?? 100);

  if (flags.warn_if_critical_spacing_m_lt_1 && spacing < 1) {
    warnings.push('Critical spacing is very small (< 1 m)');
  }
  if (flags.warn_if_critical_spacing_m_gt_50 && spacing > 50) {
    warnings.push('Critical spacing is very large (> 50 m)');
  }
  // YAML may still carry legacy searched_fraction / inaccessible_fraction flags;
  // these are harmless — they reference inputs no longer collected, so never fire.
  if (flags.warn_if_area_coverage_pct_lt_50 && pct < 50) {
    warnings.push('Area coverage is low (< 50%)');
  }

  return warnings;
}
