/* Emergency fallback matching SAR_POD_V2_config.yaml structure.
   Used only when config cannot be loaded or parsed. */

const ALL_TARGETS = ['adult', 'child', 'large_clues', 'small_clues', 'intact_remains', 'partially_skeletonized', 'skeletal_remains', 'large_evidence', 'small_evidence'];

function neutralSegmentWeights() {
  return {
    vegetation_density: { '1': 1.0, '2': 1.0, '3': 1.0, '4': 1.0, '5': 1.0 },
    micro_terrain_complexity: { '1': 1.0, '2': 1.0, '3': 1.0, '4': 1.0, '5': 1.0 },
    extenuating_factors: { '1': 1.0, '2': 1.0, '3': 1.0, '4': 1.0, '5': 1.0 }
  };
}

export const emergencyDefaults = {
  targets: {
    adult:                  { group: 'active_missing_person', base_detectability: 0.8,  calibration_constant_k: 1.0, base_reference_critical_spacing_m: 8.0, spacing_exponent: 2.0 },
    child:                  { group: 'active_missing_person', base_detectability: 0.9,  calibration_constant_k: 1.0, base_reference_critical_spacing_m: 7.0, spacing_exponent: 2.2 },
    large_clues:            { group: 'active_missing_person', base_detectability: 0.7,  calibration_constant_k: 1.0, base_reference_critical_spacing_m: 7.0, spacing_exponent: 2.2 },
    small_clues:            { group: 'active_missing_person', base_detectability: 0.5,  calibration_constant_k: 1.0, base_reference_critical_spacing_m: 5.5, spacing_exponent: 2.6 },
    intact_remains:         { group: 'evidence_historical',   base_detectability: 0.6,  calibration_constant_k: 1.0, base_reference_critical_spacing_m: 6.0, spacing_exponent: 2.4 },
    partially_skeletonized: { group: 'evidence_historical',   base_detectability: 0.4,  calibration_constant_k: 1.0, base_reference_critical_spacing_m: 5.0, spacing_exponent: 2.6 },
    skeletal_remains:       { group: 'evidence_historical',   base_detectability: 0.4,  calibration_constant_k: 1.0, base_reference_critical_spacing_m: 5.0, spacing_exponent: 2.6 },
    large_evidence:         { group: 'evidence_historical',   base_detectability: 0.7,  calibration_constant_k: 1.0, base_reference_critical_spacing_m: 7.0, spacing_exponent: 2.2 },
    small_evidence:         { group: 'evidence_historical',   base_detectability: 0.5,  calibration_constant_k: 1.0, base_reference_critical_spacing_m: 5.5, spacing_exponent: 2.6 }
  },

  primary_target_hierarchy: {
    active_missing_person: {
      order: ['adult', 'child', 'large_clues', 'small_clues']
    },
    evidence_historical: {
      order: ['intact_remains', 'partially_skeletonized', 'skeletal_remains', 'large_evidence', 'small_evidence']
    }
  },

  condition_factors: {
    adult:                  { time_of_day: { day: 1, dusk_dawn: 0.9, night: 0.72 }, weather: { clear: 1, rain: 0.9, snow: 0.82 }, detectability_level: { '1': 1.1, '2': 1.0, '3': 0.88, '4': 0.74, '5': 0.6 } },
    child:                  { time_of_day: { day: 1, dusk_dawn: 0.9, night: 0.7 },  weather: { clear: 1, rain: 0.9, snow: 0.82 }, detectability_level: { '1': 1.08, '2': 0.98, '3': 0.86, '4': 0.72, '5': 0.58 } },
    large_clues:            { time_of_day: { day: 1, dusk_dawn: 0.82, night: 0.58 }, weather: { clear: 1, rain: 0.84, snow: 0.74 }, detectability_level: { '1': 1.05, '2': 0.94, '3': 0.76, '4': 0.58, '5': 0.44 } },
    small_clues:            { time_of_day: { day: 1, dusk_dawn: 0.72, night: 0.42 }, weather: { clear: 1, rain: 0.74, snow: 0.6 },  detectability_level: { '1': 1.0, '2': 0.84, '3': 0.62, '4': 0.44, '5': 0.3 } },
    intact_remains:         { time_of_day: { day: 1, dusk_dawn: 0.84, night: 0.6 },  weather: { clear: 1, rain: 0.86, snow: 0.76 }, detectability_level: { '1': 1.05, '2': 0.95, '3': 0.78, '4': 0.6, '5': 0.46 } },
    partially_skeletonized: { time_of_day: { day: 1, dusk_dawn: 0.78, night: 0.5 },  weather: { clear: 1, rain: 0.8, snow: 0.66 },  detectability_level: { '1': 1.0, '2': 0.9, '3': 0.7, '4': 0.52, '5': 0.38 } },
    skeletal_remains:       { time_of_day: { day: 1, dusk_dawn: 0.74, night: 0.46 }, weather: { clear: 1, rain: 0.76, snow: 0.62 }, detectability_level: { '1': 0.98, '2': 0.86, '3': 0.66, '4': 0.48, '5': 0.34 } },
    large_evidence:         { time_of_day: { day: 1, dusk_dawn: 0.82, night: 0.58 }, weather: { clear: 1, rain: 0.84, snow: 0.74 }, detectability_level: { '1': 1.05, '2': 0.94, '3': 0.76, '4': 0.58, '5': 0.44 } },
    small_evidence:         { time_of_day: { day: 1, dusk_dawn: 0.72, night: 0.42 }, weather: { clear: 1, rain: 0.74, snow: 0.6 },  detectability_level: { '1': 1.0, '2': 0.84, '3': 0.62, '4': 0.44, '5': 0.3 } }
  },

  spacing_bounds_m: {
    min_effective_actual_spacing_m_by_target: { adult: 3, child: 3, large_clues: 2, small_clues: 1, intact_remains: 2, partially_skeletonized: 1.5, skeletal_remains: 1.2, large_evidence: 2, small_evidence: 1 },
    max_effective_actual_spacing_m_by_target: { adult: 40, child: 35, large_clues: 25, small_clues: 10, intact_remains: 28, partially_skeletonized: 18, skeletal_remains: 15, large_evidence: 25, small_evidence: 10 }
  },

  response_model: {
    enabled_for_groups: ['active_missing_person'],
    auditory_bonus: { none: 0, possible: 0.05, likely: 0.1 },
    visual_bonus: { evade: -0.02, none: 0, possible: 0.03, likely: 0.07 },
    max_total_multiplier: 1.25
  },

  subject_visibility_factor: {
    low: 0.80,
    medium: 1.0,
    high: 1.20
  },

  segment_factor_weights: Object.fromEntries(
    ALL_TARGETS.map(t => [t, neutralSegmentWeights()])
  ),

  ui_tooltips: {
    subject_visibility: 'How visible is the subject expected to be? Low = camouflaged or buried. Medium = typical. High = bright clothing or open terrain.',
    vegetation_density: 'Density of vegetation in the search area. 1 = open/sparse, 5 = extremely dense. 3 is neutral.',
    micro_terrain_complexity: 'Complexity of ground surface and micro-terrain features. 1 = flat/simple, 5 = extremely rugged. 3 is neutral.',
    extenuating_factors: 'Other factors affecting detection not captured elsewhere. 1 = favorable, 5 = severely adverse. 3 is neutral.'
  },

  completion_model: {
    formula: 'completion_multiplier = clamp(area_coverage_pct / 100, 0, 1)'
  },

  qa_flags: {
    warn_if_critical_spacing_m_lt_1: true,
    warn_if_critical_spacing_m_gt_50: true,
    'warn_if_searched_fraction_lt_0.5': true,
    'warn_if_inaccessible_fraction_gt_0.4': true
  }
};
