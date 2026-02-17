/* Emergency fallback matching SAR_POD_V2_config.yaml structure.
   Used only when config cannot be loaded or parsed. */

const ALL_DAY = { adult: 1, child: 1, large_clues: 1, small_clues: 1, intact_remains: 1, partially_skeletonized: 1, skeletal_remains: 1, large_evidence: 1, small_evidence: 1 };

export const emergencyDefaults = {
  targets: {
    adult:                  { group: 'active_missing_person', pod_ceiling: 0.97, base_reference_spacing_m: 25, spacing_exponent_k: 1.4 },
    child:                  { group: 'active_missing_person', pod_ceiling: 0.96, base_reference_spacing_m: 20, spacing_exponent_k: 1.5 },
    large_clues:            { group: 'active_missing_person', pod_ceiling: 0.93, base_reference_spacing_m: 12, spacing_exponent_k: 1.7 },
    small_clues:            { group: 'active_missing_person', pod_ceiling: 0.88, base_reference_spacing_m: 5,  spacing_exponent_k: 2.0 },
    intact_remains:         { group: 'evidence_historical',   pod_ceiling: 0.95, base_reference_spacing_m: 14, spacing_exponent_k: 1.7 },
    partially_skeletonized: { group: 'evidence_historical',   pod_ceiling: 0.91, base_reference_spacing_m: 10, spacing_exponent_k: 1.9 },
    skeletal_remains:       { group: 'evidence_historical',   pod_ceiling: 0.87, base_reference_spacing_m: 8,  spacing_exponent_k: 2.0 },
    large_evidence:         { group: 'evidence_historical',   pod_ceiling: 0.92, base_reference_spacing_m: 12, spacing_exponent_k: 1.8 },
    small_evidence:         { group: 'evidence_historical',   pod_ceiling: 0.86, base_reference_spacing_m: 5,  spacing_exponent_k: 2.1 }
  },

  primary_target_hierarchy: {
    active_missing_person: ['adult', 'child', 'large_clues', 'small_clues'],
    evidence_historical: {
      order: ['intact_remains', 'partially_skeletonized', 'skeletal_remains', 'large_evidence', 'small_evidence']
    }
  },

  condition_factors: {
    time_of_day: {
      day:       { ...ALL_DAY },
      dusk_dawn: { adult: 0.90, child: 0.90, large_clues: 0.82, small_clues: 0.72, intact_remains: 0.84, partially_skeletonized: 0.78, skeletal_remains: 0.74, large_evidence: 0.82, small_evidence: 0.72 },
      night:     { adult: 0.72, child: 0.70, large_clues: 0.58, small_clues: 0.42, intact_remains: 0.60, partially_skeletonized: 0.50, skeletal_remains: 0.46, large_evidence: 0.58, small_evidence: 0.42 }
    },
    weather: {
      clear: { ...ALL_DAY },
      rain:  { adult: 0.90, child: 0.90, large_clues: 0.84, small_clues: 0.74, intact_remains: 0.86, partially_skeletonized: 0.80, skeletal_remains: 0.76, large_evidence: 0.84, small_evidence: 0.74 },
      snow:  { adult: 0.82, child: 0.82, large_clues: 0.74, small_clues: 0.60, intact_remains: 0.76, partially_skeletonized: 0.66, skeletal_remains: 0.62, large_evidence: 0.74, small_evidence: 0.60 }
    },
    detectability_level: {
      '1': { adult: 1.10, child: 1.08, large_clues: 1.05, small_clues: 1.00, intact_remains: 1.05, partially_skeletonized: 1.00, skeletal_remains: 0.98, large_evidence: 1.05, small_evidence: 1.00 },
      '2': { adult: 1.00, child: 0.98, large_clues: 0.94, small_clues: 0.84, intact_remains: 0.95, partially_skeletonized: 0.90, skeletal_remains: 0.86, large_evidence: 0.94, small_evidence: 0.84 },
      '3': { adult: 0.88, child: 0.86, large_clues: 0.76, small_clues: 0.62, intact_remains: 0.78, partially_skeletonized: 0.70, skeletal_remains: 0.66, large_evidence: 0.76, small_evidence: 0.62 },
      '4': { adult: 0.74, child: 0.72, large_clues: 0.58, small_clues: 0.44, intact_remains: 0.60, partially_skeletonized: 0.52, skeletal_remains: 0.48, large_evidence: 0.58, small_evidence: 0.44 },
      '5': { adult: 0.60, child: 0.58, large_clues: 0.44, small_clues: 0.30, intact_remains: 0.46, partially_skeletonized: 0.38, skeletal_remains: 0.34, large_evidence: 0.44, small_evidence: 0.30 }
    }
  },

  reference_spacing_bounds_m: {
    min_by_target: { adult: 3, child: 3, large_clues: 2, small_clues: 1, intact_remains: 2, partially_skeletonized: 1.5, skeletal_remains: 1.2, large_evidence: 2, small_evidence: 1 },
    max_by_target: { adult: 40, child: 35, large_clues: 25, small_clues: 10, intact_remains: 28, partially_skeletonized: 18, skeletal_remains: 15, large_evidence: 25, small_evidence: 10 }
  },

  response_model: {
    enabled_for_groups: ['active_missing_person'],
    auditory_bonus: { none: 0, possible: 0.05, likely: 0.10 },
    visual_bonus: { none: 0, possible: 0.03, likely: 0.07 },
    max_total_multiplier: 1.25
  },

  completion_model: {
    use_strict_subtractive_formula: true
  },

  qa_flags: {
    warn_if_critical_spacing_m_lt_1: true,
    warn_if_critical_spacing_m_gt_50: true,
    'warn_if_searched_fraction_lt_0.5': true,
    'warn_if_inaccessible_fraction_gt_0.4': true
  }
};
