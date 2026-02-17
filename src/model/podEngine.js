import { clamp } from '../utils/math.js';

/* ================================================================
   Safe accessors — pull per-target values from config, with fallbacks
   ================================================================ */

function targetDef(config, targetKey) {
  return config?.targets?.[targetKey] || {};
}

function conditionFactor(config, axis, level, targetKey) {
  return Number(config?.condition_factors?.[targetKey]?.[axis]?.[String(level)] ?? 1);
}

function refBounds(config, targetKey) {
  const bounds = config?.reference_spacing_bounds_m || {};
  return {
    min: Number(bounds.min_by_target?.[targetKey] ?? 1),
    max: Number(bounds.max_by_target?.[targetKey] ?? 200)
  };
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
   Spacing effectiveness
   E_space = min(1, (S_ref / S_act)^spacing_exponent)
   ================================================================ */

export function spacingEffectiveness(S_ref, S_act, k) {
  if (!S_act || S_act <= 0) return 0;
  return Math.min(1, (S_ref / S_act) ** k);
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

   POD_t = clamp(
     (1 - exp(-calibration_constant_k * effective_detectability
              * spacing_effectiveness * responsiveness_multiplier))
     * completion_multiplier,
     0, 0.99
   )

   Where:
     condition_multiplier  = F_time * F_weather * F_detectability  (per-target)
     effective_detectability = base_detectability * condition_multiplier
     reference_critical_spacing_raw = base_reference_critical_spacing_m  (NOT * C_t)
     reference_critical_spacing = clamp(raw, min, max)
     spacing_effectiveness = min(1, (S_ref / S_act)^spacing_exponent)
   ================================================================ */

export function computeForTarget({ config, searchLevel, segment, targetKey }) {
  const target = targetDef(config, targetKey);
  const bounds = refBounds(config, targetKey);

  // Per-target base values from config
  const base_detectability = Number(target.base_detectability ?? 0.80);
  const calibration_constant_k = Number(target.calibration_constant_k ?? 3.50);
  const base_reference_critical_spacing_m = Number(target.base_reference_critical_spacing_m ?? 15);
  const spacing_exponent = Number(target.spacing_exponent ?? 1.5);

  // Per-target condition factors (detectability_level key must be string)
  const F_time = conditionFactor(config, 'time_of_day', segment?.time_of_day || 'day', targetKey);
  const F_weather = conditionFactor(config, 'weather', segment?.weather || 'clear', targetKey);
  const F_detectability = conditionFactor(config, 'detectability_level', segment?.detectability_level ?? 3, targetKey);

  // condition_multiplier_for_target = F_time * F_weather * F_detectability
  const C_t = F_time * F_weather * F_detectability;

  // effective_detectability_for_target = base_detectability * condition_multiplier
  const D_eff = base_detectability * C_t;

  // reference_critical_spacing_raw = base_reference_critical_spacing_m (NOT multiplied by conditions)
  const S_ref_raw = base_reference_critical_spacing_m;
  const S_ref = clamp(S_ref_raw, bounds.min, bounds.max);

  // spacing_effectiveness_for_target = min(1, (S_ref / S_act)^spacing_exponent)
  const E_space = spacingEffectiveness(S_ref, Number(segment?.critical_spacing_m), spacing_exponent);

  // responsiveness_multiplier
  const response = responseComponents(searchLevel || {}, config, targetKey);
  const M_resp = response.M_resp;

  // completion_multiplier = clamp(area_coverage_pct / 100, 0, 1)
  const M_comp = completionMultiplier(segment || {});

  // Exponential POD formula:
  // POD = clamp((1 - exp(-k * D_eff * E_space * M_resp)) * M_comp, 0, 0.99)
  const POD_raw = 1 - Math.exp(-calibration_constant_k * D_eff * E_space * M_resp);
  const POD_final = clamp(POD_raw * M_comp, 0, 0.99);

  return {
    target: targetKey,
    // Per-target base values
    base_detectability,
    calibration_constant_k,
    base_reference_critical_spacing_m,
    spacing_exponent,
    min_ref: bounds.min,
    max_ref: bounds.max,
    // Condition factors
    F_time,
    F_weather,
    F_detectability,
    C_t,
    // Effective detectability
    D_eff,
    // Reference spacing (raw = base, not multiplied by conditions)
    S_ref_raw,
    S_ref,
    // Spacing effectiveness
    E_space,
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
  if (flags.warn_if_area_coverage_pct_lt_50 && pct < 50) {
    warnings.push('Area coverage is low (< 50%)');
  }

  return warnings;
}
