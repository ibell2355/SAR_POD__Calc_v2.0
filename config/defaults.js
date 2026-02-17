/* Emergency fallback matching SAR_POD_V2_config.yaml structure.
   Used only when config cannot be loaded or parsed. */

const ALL_ONE = { adult: 1, child: 1, large_clues: 1, small_clues: 1, intact_remains: 1, partially_skeletonized: 1, skeletal_remains: 1, large_evidence: 1, small_evidence: 1 };

export const emergencyDefaults = {
  targets: {
    adult:                  { group: 'active_missing_person', base_detectability: 0.8,  calibration_constant_k: 1.0,  base_reference_critical_spacing_m: 8.0, spacing_exponent: 2.0 },
    child:                  { group: 'active_missing_person', base_detectability: 0.9,  calibration_constant_k: 1.05, base_reference_critical_spacing_m: 7.0, spacing_exponent: 2.2 },
    large_clues:            { group: 'active_missing_person', base_detectability: 0.7,  calibration_constant_k: 1.0,  base_reference_critical_spacing_m: 7.0, spacing_exponent: 2.2 },
    small_clues:            { group: 'active_missing_person', base_detectability: 0.5,  calibration_constant_k: 0.95, base_reference_critical_spacing_m: 5.5, spacing_exponent: 2.6 },
    intact_remains:         { group: 'evidence_historical',   base_detectability: 0.6,  calibration_constant_k: 0.95, base_reference_critical_spacing_m: 6.0, spacing_exponent: 2.4 },
    partially_skeletonized: { group: 'evidence_historical',   base_detectability: 0.4,  calibration_constant_k: 0.9,  base_reference_critical_spacing_m: 5.0, spacing_exponent: 2.6 },
    skeletal_remains:       { group: 'evidence_historical',   base_detectability: 0.4,  calibration_constant_k: 0.9,  base_reference_critical_spacing_m: 5.0, spacing_exponent: 2.6 },
    large_evidence:         { group: 'evidence_historical',   base_detectability: 0.7,  calibration_constant_k: 1.0,  base_reference_critical_spacing_m: 7.0, spacing_exponent: 2.2 },
    small_evidence:         { group: 'evidence_historical',   base_detectability: 0.5,  calibration_constant_k: 0.95, base_reference_critical_spacing_m: 5.5, spacing_exponent: 2.6 }
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
    time_of_day: {
      day:       { ...ALL_ONE },
      dusk_dawn: { adult: 0.9, child: 0.9, large_clues: 0.82, small_clues: 0.72, intact_remains: 0.84, partially_skeletonized: 0.78, skeletal_remains: 0.74, large_evidence: 0.82, small_evidence: 0.72 },
      night:     { adult: 0.72, child: 0.7, large_clues: 0.58, small_clues: 0.42, intact_remains: 0.6, partially_skeletonized: 0.5, skeletal_remains: 0.46, large_evidence: 0.58, small_evidence: 0.42 }
    },
    weather: {
      clear: { ...ALL_ONE },
      rain:  { adult: 0.9, child: 0.9, large_clues: 0.84, small_clues: 0.74, intact_remains: 0.86, partially_skeletonized: 0.8, skeletal_remains: 0.76, large_evidence: 0.84, small_evidence: 0.74 },
      snow:  { adult: 0.82, child: 0.82, large_clues: 0.74, small_clues: 0.6, intact_remains: 0.76, partially_skeletonized: 0.66, skeletal_remains: 0.62, large_evidence: 0.74, small_evidence: 0.6 }
    },
    detectability_level: {
      '1': { adult: 1.1, child: 1.08, large_clues: 1.05, small_clues: 1.0, intact_remains: 1.05, partially_skeletonized: 1.0, skeletal_remains: 0.98, large_evidence: 1.05, small_evidence: 1.0 },
      '2': { adult: 1.0, child: 0.98, large_clues: 0.94, small_clues: 0.84, intact_remains: 0.95, partially_skeletonized: 0.9, skeletal_remains: 0.86, large_evidence: 0.94, small_evidence: 0.84 },
      '3': { adult: 0.88, child: 0.86, large_clues: 0.76, small_clues: 0.62, intact_remains: 0.78, partially_skeletonized: 0.7, skeletal_remains: 0.66, large_evidence: 0.76, small_evidence: 0.62 },
      '4': { adult: 0.74, child: 0.72, large_clues: 0.58, small_clues: 0.44, intact_remains: 0.6, partially_skeletonized: 0.52, skeletal_remains: 0.48, large_evidence: 0.58, small_evidence: 0.44 },
      '5': { adult: 0.6, child: 0.58, large_clues: 0.44, small_clues: 0.3, intact_remains: 0.46, partially_skeletonized: 0.38, skeletal_remains: 0.34, large_evidence: 0.44, small_evidence: 0.3 }
    }
  },

  reference_spacing_bounds_m: {
    min_by_target: { adult: 3, child: 3, large_clues: 2, small_clues: 1, intact_remains: 2, partially_skeletonized: 1.5, skeletal_remains: 1.2, large_evidence: 2, small_evidence: 1 },
    max_by_target: { adult: 40, child: 35, large_clues: 25, small_clues: 10, intact_remains: 28, partially_skeletonized: 18, skeletal_remains: 15, large_evidence: 25, small_evidence: 10 }
  },

  response_model: {
    enabled_for_groups: ['active_missing_person'],
    auditory_bonus: { none: 0, possible: 0.05, likely: 0.1 },
    visual_bonus: { none: 0, possible: 0.03, likely: 0.07 },
    max_total_multiplier: 1.25
  },

  completion_model: {
    formula: 'completion_multiplier = clamp(area_coverage_pct / 100, 0, 1)'
  },

  qa_flags: {
    warn_if_critical_spacing_m_lt_1: true,
    warn_if_critical_spacing_m_gt_50: true,
    warn_if_area_coverage_pct_lt_50: true
  }
};
