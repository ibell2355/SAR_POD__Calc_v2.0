import { clamp } from '../utils/math.js';

/* ================================================================
   V3 — Koopman Random Search POD Engine

   POD_segment = clamp(1 - exp(-coverage_C), 0, 0.99)
   where coverage_C = (W_eff * L_total) / A_m2

   W_eff = clamp(W0_m * C_t * M_resp, w_eff_min, w_eff_max)
   C_t   = F_time * F_weather * F_visibility * F_veg
           * F_terrain * F_extenuating * F_burial
   ================================================================ */

/* ================================================================
   Safe accessors — pull per-target values from config, with fallbacks
   ================================================================ */

function targetDef(config, targetKey) {
  return config?.targets?.[targetKey] || {};
}

function conditionFactor(config, axis, level, targetKey) {
  return Number(config?.condition_factors?.[targetKey]?.[axis]?.[String(level)] ?? 1);
}

function subjectVisibilityFactor(config, level) {
  return Number(config?.subject_visibility_factor?.[level] ?? 1);
}

function wEffBounds(config) {
  const b = config?.w_eff_bounds_m || {};
  return {
    min: Number(b.min ?? 0.5),
    max: Number(b.max ?? 100)
  };
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
   ================================================================ */

export function inferPrimaryTarget(selectedTargets, config, searchType) {
  const hierarchy = config?.primary_target_hierarchy || {};

  if (searchType === 'evidence_historical') {
    const order = hierarchy.evidence_historical?.order || [];
    return order.find((t) => selectedTargets.includes(t)) || selectedTargets[0] || null;
  }

  const order = hierarchy.active_missing_person?.order
    || hierarchy.active_missing_person
    || ['adult', 'child', 'large_clues', 'small_clues'];
  const orderArr = Array.isArray(order) ? order : [];
  return orderArr.find((t) => selectedTargets.includes(t)) || selectedTargets[0] || null;
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
   Track length estimation
   ================================================================ */

export function estimateTrackLength({ area_m2, coverage_pct, critical_spacing_m, num_searchers }) {
  const A = Number(area_m2 || 0);
  const pct = Number(coverage_pct ?? 100);
  const S = Number(critical_spacing_m || 1);
  const N = Number(num_searchers || 1);

  if (A <= 0 || S <= 0 || N <= 0) return { L_ind_est: 0, L_total_est: 0 };

  const A_covered_m2 = A * (pct / 100);
  const L_ind_est = A_covered_m2 / (S * N);
  const L_total_est = L_ind_est * N;

  return { L_ind_est, L_total_est };
}

/* ================================================================
   Full per-target POD computation — Koopman Random Search Model

   1) C_t = product of all condition factors
   2) W_eff = clamp(W0_m * C_t * M_resp, w_eff_min, w_eff_max)
   3) Determine track length (measured or estimated)
   4) coverage_C = (W_eff * L_total) / A_m2
   5) POD_segment = clamp(1 - exp(-coverage_C), 0, 0.99)
   ================================================================ */

export function computeForTarget({ config, searchLevel, segment, targetKey }) {
  if (!_configWarned) { warnMissingConfigKeys(config); _configWarned = true; }

  const target = targetDef(config, targetKey);
  const bounds = wEffBounds(config);

  const W0_m = Number(target.W0_m ?? 10);

  // Condition factors
  const F_time = conditionFactor(config, 'time_of_day', segment?.time_of_day || 'day', targetKey);
  const F_weather = conditionFactor(config, 'weather', segment?.weather || 'clear', targetKey);
  const F_visibility = subjectVisibilityFactor(config, searchLevel?.subject_visibility || 'medium');
  const F_veg = conditionFactor(config, 'vegetation_density', segment?.vegetation_density ?? 3, targetKey);
  const F_terrain = conditionFactor(config, 'micro_terrain_complexity', segment?.micro_terrain_complexity ?? 3, targetKey);
  const F_extenuating = conditionFactor(config, 'extenuating_factors', segment?.extenuating_factors ?? 3, targetKey);
  const F_burial = conditionFactor(config, 'burial_or_cover', segment?.burial_or_cover ?? 3, targetKey);

  // 1. Condition multiplier
  const C_t = F_time * F_weather * F_visibility * F_veg * F_terrain * F_extenuating * F_burial;

  // 2. Response multiplier
  const response = responseComponents(searchLevel || {}, config, targetKey);
  const M_resp = response.M_resp;

  // 3. Effective search width
  const w_eff_min = bounds.min;
  const w_eff_max = bounds.max;
  const W_eff = clamp(W0_m * C_t * M_resp, w_eff_min, w_eff_max);

  // 4. Track length
  const A_m2 = Number(segment?.area_m2 || 0);
  const N = Math.max(Number(segment?.num_searchers || 1), 1);
  const measured_track = Number(segment?.track_length_ind_m || 0);

  let track_source, L_ind_m, L_total_m;
  if (measured_track > 0) {
    track_source = 'measured';
    L_ind_m = measured_track;
    L_total_m = measured_track * N;
  } else {
    track_source = 'estimated';
    const est = estimateTrackLength({
      area_m2: A_m2,
      coverage_pct: segment?.area_coverage_pct ?? 100,
      critical_spacing_m: segment?.critical_spacing_m ?? 15,
      num_searchers: N
    });
    L_ind_m = est.L_ind_est;
    L_total_m = est.L_total_est;
  }

  // 5. Koopman coverage and POD
  let coverage_C = 0;
  let POD_segment = 0;
  if (A_m2 > 0) {
    coverage_C = (W_eff * L_total_m) / A_m2;
    POD_segment = clamp(1 - Math.exp(-coverage_C), 0, 0.99);
  }

  return {
    target: targetKey,
    W0_m,
    F_time, F_weather, F_visibility, F_veg, F_terrain, F_extenuating, F_burial,
    C_t,
    M_resp,
    auditory_bonus: response.auditory_bonus,
    visual_bonus: response.visual_bonus,
    response_cap: response.cap,
    W_eff, w_eff_min, w_eff_max,
    track_source, L_ind_m, L_total_m,
    A_m2,
    coverage_C,
    POD_segment
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
  const numSearchers = Number(segment?.num_searchers || 0);
  const area = Number(segment?.area_m2 || 0);

  if (flags.warn_if_critical_spacing_m_gt && spacing > flags.warn_if_critical_spacing_m_gt) {
    warnings.push(`Critical spacing is very large (> ${flags.warn_if_critical_spacing_m_gt} m)`);
  }
  if (flags.warn_if_area_coverage_pct_lt && pct < flags.warn_if_area_coverage_pct_lt) {
    warnings.push(`Area coverage is low (< ${flags.warn_if_area_coverage_pct_lt}%)`);
  }
  if (!numSearchers || numSearchers <= 0) {
    warnings.push('Number of searchers is missing or zero');
  }
  if (!area || area <= 0) {
    warnings.push('Segment area is missing or zero');
  }

  return warnings;
}
