import { clamp } from '../utils/math.js';

/* ================================================================
   Safe accessors — pull per-target values from config, with fallbacks
   ================================================================ */

function targetDef(config, targetKey) {
  return config?.targets?.[targetKey] || {};
}

function conditionFactor(config, axis, level, targetKey) {
  return Number(config?.condition_factors?.[axis]?.[String(level)]?.[targetKey] ?? 1);
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
   ================================================================ */

export function inferPrimaryTarget(selectedTargets, config, searchType) {
  const hierarchy = config?.primary_target_hierarchy || {};

  if (searchType === 'evidence_historical') {
    const order = hierarchy.evidence_historical?.order || [];
    return order.find((t) => selectedTargets.includes(t)) || selectedTargets[0] || null;
  }

  // Default: active_missing_person
  const order = hierarchy.active_missing_person || ['adult', 'child', 'large_clues', 'small_clues'];
  return order.find((t) => selectedTargets.includes(t)) || selectedTargets[0] || null;
}

/* ================================================================
   Response multiplier (active_missing_person group only)
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
   ================================================================ */

export function spacingEffectiveness(S_ref, S_act, k) {
  if (!S_act || S_act <= 0) return 0;
  return Math.min(1, (S_ref / S_act) ** k);
}

/* ================================================================
   Completion multiplier (strict subtractive)
   M_comp = max(0, min(1, searched_fraction - inaccessible_fraction))
   ================================================================ */

export function completionMultiplier(segment) {
  const searched = Number(segment?.searched_fraction ?? 1);
  const inaccessible = Number(segment?.inaccessible_fraction ?? 0);
  return clamp(searched - inaccessible, 0, 1);
}

/* ================================================================
   Full per-target POD computation
   ================================================================ */

export function computeForTarget({ config, searchLevel, segment, targetKey }) {
  const target = targetDef(config, targetKey);
  const bounds = refBounds(config, targetKey);

  const POD_ceiling = Number(target.pod_ceiling ?? 0.90);
  const S_base = Number(target.base_reference_spacing_m ?? 15);
  const k = Number(target.spacing_exponent_k ?? 1.5);

  // Per-target condition factors
  const F_time = conditionFactor(config, 'time_of_day', segment?.time_of_day || 'day', targetKey);
  const F_weather = conditionFactor(config, 'weather', segment?.weather || 'clear', targetKey);
  const F_detectability = conditionFactor(config, 'detectability_level', segment?.detectability_level ?? 3, targetKey);

  const C_t = F_time * F_weather * F_detectability;
  const S_ref_raw = S_base * C_t;
  const S_ref = clamp(S_ref_raw, bounds.min, bounds.max);
  const E_space = spacingEffectiveness(S_ref, Number(segment?.critical_spacing_m), k);
  const response = responseComponents(searchLevel || {}, config, targetKey);
  const M_resp = response.M_resp;
  const M_comp = completionMultiplier(segment || {});

  const POD_pre = POD_ceiling * E_space * M_resp;
  const POD_final = clamp(POD_pre * M_comp, 0, 0.99);

  return {
    target: targetKey,
    POD_ceiling,
    S_base,
    k,
    min_ref: bounds.min,
    max_ref: bounds.max,
    F_time,
    F_weather,
    F_detectability,
    C_t,
    S_ref_raw,
    S_ref,
    E_space,
    M_resp,
    M_comp,
    POD_pre,
    POD_final,
    auditory_bonus: response.auditory_bonus,
    visual_bonus: response.visual_bonus,
    response_cap: response.cap
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
  const searched = Number(segment?.searched_fraction ?? 1);
  const inaccessible = Number(segment?.inaccessible_fraction ?? 0);

  if (flags.warn_if_critical_spacing_m_lt_1 && spacing < 1) {
    warnings.push('Critical spacing is very small (< 1 m)');
  }
  if (flags.warn_if_critical_spacing_m_gt_50 && spacing > 50) {
    warnings.push('Critical spacing is very large (> 50 m)');
  }
  if (flags['warn_if_searched_fraction_lt_0.5'] && searched < 0.5) {
    warnings.push('Searched fraction is low (< 50%)');
  }
  if (flags['warn_if_inaccessible_fraction_gt_0.4'] && inaccessible > 0.4) {
    warnings.push('Inaccessible fraction is high (> 40%)');
  }

  return warnings;
}
