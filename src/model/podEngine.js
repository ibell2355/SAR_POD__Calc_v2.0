import { clamp } from '../utils/math.js';

/* ================================================================
   Spacing-Based POD Engine

   coverage_factor = W_eff / actual_spacing_m
   POD = clamp(1 - exp(-coverage_factor), 0, 0.99)

   W_eff = clamp(base_sweep_width_m * C_t * M_resp, w_eff_min, w_eff_max)
   C_t   = K_visibility * K_time * K_weather * K_veg
           * K_terrain * K_extenuating * K_burial
   ================================================================ */

/* ================================================================
   Safe accessors — pull per-search-type values from config
   ================================================================ */

function searchTypeDef(config, searchType) {
  return config?.search_types?.[searchType] || {};
}

function conditionFactor(config, searchType, axis, level) {
  return Number(config?.condition_factors?.[searchType]?.[axis]?.[String(level)] ?? 1);
}

function wEffBounds(config) {
  const b = config?.w_eff_bounds_m || {};
  return {
    min: Number(b.min ?? 0.5),
    max: Number(b.max ?? 100)
  };
}

function responseModel(config) {
  const rm = config?.response_model || {};
  return {
    enabled_for: rm.enabled_for || ['missing_person'],
    auditory_multiplier: rm.auditory_multiplier || { none: 1, possible: 1, likely: 1 },
    visual_multiplier: rm.visual_multiplier || { evade: 1, none: 1, possible: 1, likely: 1 },
    max_total_multiplier: Number(rm.max_total_multiplier ?? 1.25)
  };
}

/* ================================================================
   Response multiplier (missing_person only)
   ================================================================ */

export function responseMultiplier(searchLevel, config) {
  const rm = responseModel(config);
  const searchType = searchLevel?.search_for || 'missing_person';

  if (!rm.enabled_for.includes(searchType)) return 1;

  const aud = Number(rm.auditory_multiplier[searchLevel?.auditory || 'none'] ?? 1);
  const vis = Number(rm.visual_multiplier[searchLevel?.visual || 'none'] ?? 1);
  return Math.min(rm.max_total_multiplier, aud * vis);
}

export function responseComponents(searchLevel, config) {
  const rm = responseModel(config);
  const searchType = searchLevel?.search_for || 'missing_person';

  if (!rm.enabled_for.includes(searchType)) {
    return { auditory_multiplier: 1, visual_multiplier: 1, cap: rm.max_total_multiplier, M_resp: 1 };
  }

  const auditory_multiplier = Number(rm.auditory_multiplier[searchLevel?.auditory || 'none'] ?? 1);
  const visual_multiplier = Number(rm.visual_multiplier[searchLevel?.visual || 'none'] ?? 1);
  const cap = rm.max_total_multiplier;
  return { auditory_multiplier, visual_multiplier, cap, M_resp: Math.min(cap, auditory_multiplier * visual_multiplier) };
}

/* ================================================================
   Full POD computation — Spacing-Based Model

   1) C_t = product of all condition factors
   2) W_eff = clamp(base_sweep_width * C_t * M_resp, w_eff_min, w_eff_max)
   3) coverage_factor = W_eff / actual_spacing_m
   4) POD = clamp(1 - exp(-coverage_factor), 0, 0.99)
   ================================================================ */

export function computePOD({ config, searchLevel, segment }) {
  const searchType = searchLevel?.search_for || 'missing_person';
  const typeDef = searchTypeDef(config, searchType);
  const bounds = wEffBounds(config);

  const base_sweep_width_m = Number(typeDef.base_sweep_width_m ?? 10);

  // Condition factors
  const K_visibility = conditionFactor(config, searchType, 'visibility', searchLevel?.visibility || 'medium');
  const K_time = conditionFactor(config, searchType, 'time_of_day', segment?.time_of_day || 'day');
  const K_weather = conditionFactor(config, searchType, 'weather', segment?.weather || 'clear');
  const K_veg = conditionFactor(config, searchType, 'vegetation_density', segment?.vegetation_density ?? 3);
  const K_terrain = conditionFactor(config, searchType, 'micro_terrain_complexity', segment?.micro_terrain_complexity ?? 3);
  const K_extenuating = conditionFactor(config, searchType, 'extenuating_factors', segment?.extenuating_factors ?? 3);
  const K_burial = conditionFactor(config, searchType, 'burial_or_cover', segment?.burial_or_cover ?? 3);

  // 1. Condition multiplier (product of all active coefficients)
  const C_t = K_visibility * K_time * K_weather * K_veg * K_terrain * K_extenuating * K_burial;

  // 2. Response multiplier (missing_person only)
  const response = responseComponents(searchLevel || {}, config);
  const M_resp = response.M_resp;

  // 3. Effective sweep width
  const w_eff_min = bounds.min;
  const w_eff_max = bounds.max;
  const W_eff = clamp(base_sweep_width_m * C_t * M_resp, w_eff_min, w_eff_max);

  // 4. Coverage factor and POD
  const actual_spacing_m = Number(segment?.actual_spacing_m || 0);
  let coverage_factor = 0;
  let POD = 0;
  if (actual_spacing_m > 0) {
    coverage_factor = W_eff / actual_spacing_m;
    POD = clamp(1 - Math.exp(-coverage_factor), 0, 0.99);
  }

  return {
    search_type: searchType,
    base_sweep_width_m,
    K_visibility, K_time, K_weather, K_veg, K_terrain, K_extenuating, K_burial,
    C_t,
    M_resp,
    auditory_multiplier: response.auditory_multiplier,
    visual_multiplier: response.visual_multiplier,
    response_cap: response.cap,
    W_eff, w_eff_min, w_eff_max,
    actual_spacing_m,
    coverage_factor,
    POD
  };
}

/* ================================================================
   Reverse calculation — spacing for a target POD
   spacing = W_eff / -ln(1 - targetPOD)
   ================================================================ */

export function spacingForTargetPOD(wEff, targetPOD) {
  if (wEff <= 0 || targetPOD <= 0 || targetPOD >= 1) return null;
  return wEff / (-Math.log(1 - targetPOD));
}

/* ================================================================
   QA warning flags
   ================================================================ */

export function generateQaWarnings(segment, config) {
  const warnings = [];
  const flags = config?.qa_flags || {};
  const spacing = Number(segment?.actual_spacing_m || 0);
  const numSearchers = Number(segment?.num_searchers || 0);

  if (spacing <= 0) {
    warnings.push('Actual spacing is missing or zero');
  } else if (flags.warn_if_spacing_m_gt && spacing > flags.warn_if_spacing_m_gt) {
    warnings.push(`Spacing is very large (> ${flags.warn_if_spacing_m_gt} m)`);
  }
  if (!numSearchers || numSearchers <= 0) {
    warnings.push('Number of searchers is missing or zero');
  }

  return warnings;
}
