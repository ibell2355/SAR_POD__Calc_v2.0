import test from 'node:test';
import assert from 'node:assert/strict';
import { completionMultiplier, inferPrimaryTarget, responseMultiplier, spacingEffectiveness, selectedTargets, computeForTarget, generateQaWarnings } from '../src/model/podEngine.js';

/* ================================================================
   Test config matching SAR_POD_V2_config.yaml structure
   ================================================================ */

const config = {
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
    active_missing_person: { order: ['adult', 'child', 'large_clues', 'small_clues'] },
    evidence_historical: { order: ['intact_remains', 'partially_skeletonized', 'skeletal_remains', 'large_evidence', 'small_evidence'] }
  },
  condition_factors: (() => {
    const N5 = { '1': 1.0, '2': 1.0, '3': 1.0, '4': 1.0, '5': 1.0 };
    return {
      adult:                  { time_of_day: { day: 1.0, dusk_dawn: 0.9, night: 0.72 }, weather: { clear: 1.0, rain: 0.9, snow: 0.82 }, detectability_level: { '1': 1.1, '2': 1.0, '3': 0.88, '4': 0.74, '5': 0.6 }, vegetation_density: N5, micro_terrain_complexity: N5, extenuating_factors: N5 },
      child:                  { time_of_day: { day: 1.0, dusk_dawn: 0.9, night: 0.7 },  weather: { clear: 1.0, rain: 0.9, snow: 0.82 }, detectability_level: { '1': 1.08, '2': 0.98, '3': 0.86, '4': 0.72, '5': 0.58 }, vegetation_density: N5, micro_terrain_complexity: N5, extenuating_factors: N5 },
      large_clues:            { time_of_day: { day: 1.0, dusk_dawn: 0.82, night: 0.58 }, weather: { clear: 1.0, rain: 0.84, snow: 0.74 }, detectability_level: { '1': 1.05, '2': 0.94, '3': 0.76, '4': 0.58, '5': 0.44 }, vegetation_density: N5, micro_terrain_complexity: N5, extenuating_factors: N5 },
      small_clues:            { time_of_day: { day: 1.0, dusk_dawn: 0.72, night: 0.42 }, weather: { clear: 1.0, rain: 0.74, snow: 0.6 },  detectability_level: { '1': 1.0, '2': 0.84, '3': 0.62, '4': 0.44, '5': 0.3 }, vegetation_density: N5, micro_terrain_complexity: N5, extenuating_factors: N5 },
      intact_remains:         { time_of_day: { day: 1.0, dusk_dawn: 0.84, night: 0.6 },  weather: { clear: 1.0, rain: 0.86, snow: 0.76 }, detectability_level: { '1': 1.05, '2': 0.95, '3': 0.78, '4': 0.6, '5': 0.46 }, vegetation_density: N5, micro_terrain_complexity: N5, burial_or_cover: N5 },
      partially_skeletonized: { time_of_day: { day: 1.0, dusk_dawn: 0.78, night: 0.5 },  weather: { clear: 1.0, rain: 0.8, snow: 0.66 },  detectability_level: { '1': 1.0, '2': 0.9, '3': 0.7, '4': 0.52, '5': 0.38 }, vegetation_density: N5, micro_terrain_complexity: N5, burial_or_cover: N5 },
      skeletal_remains:       { time_of_day: { day: 1.0, dusk_dawn: 0.74, night: 0.46 }, weather: { clear: 1.0, rain: 0.76, snow: 0.62 }, detectability_level: { '1': 0.98, '2': 0.86, '3': 0.66, '4': 0.48, '5': 0.34 }, vegetation_density: N5, micro_terrain_complexity: N5, burial_or_cover: N5 },
      large_evidence:         { time_of_day: { day: 1.0, dusk_dawn: 0.82, night: 0.58 }, weather: { clear: 1.0, rain: 0.84, snow: 0.74 }, detectability_level: { '1': 1.05, '2': 0.94, '3': 0.76, '4': 0.58, '5': 0.44 }, vegetation_density: N5, micro_terrain_complexity: N5, burial_or_cover: N5 },
      small_evidence:         { time_of_day: { day: 1.0, dusk_dawn: 0.72, night: 0.42 }, weather: { clear: 1.0, rain: 0.74, snow: 0.6 },  detectability_level: { '1': 1.0, '2': 0.84, '3': 0.62, '4': 0.44, '5': 0.3 }, vegetation_density: N5, micro_terrain_complexity: N5, burial_or_cover: N5 }
    };
  })(),
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
  qa_flags: {
    warn_if_critical_spacing_m_lt_1: true,
    warn_if_critical_spacing_m_gt_50: true,
    warn_if_area_coverage_pct_lt_50: true
  }
};

/* ================================================================
   Tests
   ================================================================ */

/* --- 1. base_hazard_rate maps base_detectability correctly --- */

test('base_hazard_rate: when all multipliers are 1, POD equals base_detectability', () => {
  // Adult: base_detectability = 0.8, k = 1.0
  // With day/clear/level-2 (all factors = 1.0), spacing = 8m = base_reference,
  // actual >= min_effective (8 >= 3), so S_eff_act = 8.
  // S_ref = 8 * 1.0 = 8, spacing_ratio = (8/8)^2 = 1.
  // hazard = -ln(1 - 0.8) = 1.6094..., exponent = 1 * 1.6094 * 1 * 1 = 1.6094
  // POD_raw = 1 - exp(-1.6094) = 0.8 (exact calibration property)
  const segment = { time_of_day: 'day', weather: 'clear', detectability_level: 2, critical_spacing_m: 8, area_coverage_pct: 100 };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none' };
  const r = computeForTarget({ config, searchLevel, segment, targetKey: 'adult' });

  const expected_hazard = -Math.log(1 - 0.8);
  assert.ok(Math.abs(r.base_hazard_rate - expected_hazard) < 0.0001);
  assert.ok(Math.abs(r.POD_final - 0.8) < 0.0001, `Expected POD ~0.8, got ${r.POD_final}`);
});

/* --- 2. effective_actual_spacing clamps benefit of tight spacing --- */

test('effective_actual_spacing: actual below min_effective uses min_effective', () => {
  // Adult min_effective = 3m. If actual = 1m, S_eff_act should be 3m (not 1m).
  const segment = { time_of_day: 'day', weather: 'clear', detectability_level: 2, critical_spacing_m: 1, area_coverage_pct: 100 };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none' };
  const r = computeForTarget({ config, searchLevel, segment, targetKey: 'adult' });

  assert.equal(r.S_eff_act, 3, 'S_eff_act should be clamped to min_effective=3');
  assert.equal(r.min_effective, 3);

  // Verify same result as if actual = 3m (since both clamp to 3)
  const segment3 = { ...segment, critical_spacing_m: 3 };
  const r3 = computeForTarget({ config, searchLevel, segment: segment3, targetKey: 'adult' });
  assert.ok(Math.abs(r.POD_final - r3.POD_final) < 0.0001, 'POD should be identical when both clamp to min');
});

/* --- 3. detectability_level numeric input resolves via string key --- */

test('detectability_level: skipped for active_missing_person, applied for evidence', () => {
  // Active: detectability_level is ignored (F_detectability = 1.0)
  const segActive = { time_of_day: 'day', weather: 'clear', detectability_level: 3, critical_spacing_m: 8, area_coverage_pct: 100 };
  const searchActive = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none' };
  const rActive = computeForTarget({ config, searchLevel: searchActive, segment: segActive, targetKey: 'adult' });
  assert.ok(Math.abs(rActive.F_detectability - 1.0) < 0.0001, 'F_detectability should be 1.0 for active_missing_person');

  // Evidence: detectability_level applies via conditionFactor
  const segEvidence = { time_of_day: 'day', weather: 'clear', detectability_level: 3, critical_spacing_m: 6, area_coverage_pct: 100 };
  const searchEvidence = { type_of_search: 'evidence_historical', auditory: 'none', visual: 'none' };
  const rEvidence = computeForTarget({ config, searchLevel: searchEvidence, segment: segEvidence, targetKey: 'intact_remains' });
  assert.ok(Math.abs(rEvidence.F_detectability - 0.78) < 0.0001, 'detectability_level 3 for intact_remains should be 0.78');
});

/* --- 4. response_model: disabled groups force M_resp = 1.0 --- */

test('response_model: M_resp = 1 for evidence_historical (disabled group)', () => {
  const segment = { time_of_day: 'day', weather: 'clear', detectability_level: 2, critical_spacing_m: 6, area_coverage_pct: 100 };
  const searchLevel = { type_of_search: 'evidence_historical', auditory: 'likely', visual: 'likely' };

  // intact_remains is evidence_historical → response disabled
  const r = computeForTarget({ config, searchLevel, segment, targetKey: 'intact_remains' });
  assert.equal(r.M_resp, 1, 'M_resp should be 1 for evidence_historical group');

  // adult is active_missing_person → response enabled
  const r2 = computeForTarget({ config, searchLevel, segment: { ...segment, critical_spacing_m: 8 }, targetKey: 'adult' });
  assert.ok(r2.M_resp > 1, 'M_resp should be > 1 for active_missing_person group with likely responsiveness');
  assert.ok(Math.abs(r2.M_resp - 1.17) < 0.0001, 'M_resp should be 1 + 0.10 + 0.07 = 1.17');
});

/* --- 5. completion_multiplier as final hard cap --- */

test('completion_multiplier: area_coverage_pct is a final hard cap on POD', () => {
  // 100% coverage → full POD
  assert.equal(completionMultiplier({ area_coverage_pct: 100 }), 1);
  // 50% coverage → halves POD
  assert.ok(Math.abs(completionMultiplier({ area_coverage_pct: 50 }) - 0.5) < 0.0001);
  // 0% coverage → zero POD
  assert.equal(completionMultiplier({ area_coverage_pct: 0 }), 0);
  // Clamps above 100 and below 0
  assert.equal(completionMultiplier({ area_coverage_pct: 150 }), 1);
  assert.equal(completionMultiplier({ area_coverage_pct: -10 }), 0);

  // Verify M_comp actually scales final POD
  const segment80 = { time_of_day: 'day', weather: 'clear', detectability_level: 2, critical_spacing_m: 8, area_coverage_pct: 80 };
  const segment100 = { ...segment80, area_coverage_pct: 100 };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none' };
  const r80 = computeForTarget({ config, searchLevel, segment: segment80, targetKey: 'adult' });
  const r100 = computeForTarget({ config, searchLevel, segment: segment100, targetKey: 'adult' });

  assert.ok(Math.abs(r80.M_comp - 0.8) < 0.0001);
  assert.ok(Math.abs(r80.POD_final - r100.POD_raw * 0.8) < 0.0001, 'POD_final at 80% coverage should be POD_raw * 0.8');
});

/* --- 6. final POD clamp to 0.99 --- */

test('POD clamped to 0.99 max even with extreme inputs', () => {
  // Use very high k to force POD_raw above 0.99
  const highKConfig = {
    ...config,
    targets: {
      ...config.targets,
      adult: { ...config.targets.adult, calibration_constant_k: 10.0 }
    }
  };
  const segment = { time_of_day: 'day', weather: 'clear', detectability_level: 1, critical_spacing_m: 3, area_coverage_pct: 100 };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'likely', visual: 'likely' };
  const r = computeForTarget({ config: highKConfig, searchLevel, segment, targetKey: 'adult' });

  assert.ok(r.POD_raw > 0.99, `POD_raw should exceed 0.99 before clamping, got ${r.POD_raw}`);
  assert.equal(r.POD_final, 0.99);
});

/* ================================================================
   Additional tests
   ================================================================ */

test('spacing ratio (raw, uncapped)', () => {
  // spacingEffectiveness(S_ref, S_eff_act, exponent) = (S_ref / S_eff_act) ^ exponent
  assert.equal(spacingEffectiveness(10, 20, 1), 0.5);
  assert.equal(spacingEffectiveness(5, 0, 1.4), 0);
  // NOT capped at 1 — if S_ref > S_eff_act, ratio > 1
  const ratio = spacingEffectiveness(20, 10, 2);
  assert.ok(Math.abs(ratio - 4) < 0.0001, 'spacing ratio can exceed 1');
});

test('target selection - active missing person', () => {
  const s = { type_of_search: 'active_missing_person', active_targets: ['child', 'adult'] };
  const targets = selectedTargets(s);
  assert.deepEqual(targets, ['child', 'adult']);
  assert.equal(inferPrimaryTarget(targets, config, 'active_missing_person'), 'adult');
});

test('target selection - evidence/historical', () => {
  const s = {
    type_of_search: 'evidence_historical',
    evidence_categories: ['remains', 'evidence'],
    remains_state: 'intact_remains',
    evidence_classes: ['large_evidence']
  };
  const targets = selectedTargets(s);
  assert.deepEqual(targets, ['intact_remains', 'large_evidence']);
  assert.equal(inferPrimaryTarget(targets, config, 'evidence_historical'), 'intact_remains');
});

test('computeForTarget with harsh conditions reduces POD', () => {
  const segment = {
    time_of_day: 'night',
    weather: 'snow',
    critical_spacing_m: 15,
    area_coverage_pct: 70
  };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none' };
  const r = computeForTarget({ config, searchLevel, segment, targetKey: 'adult' });

  // C_t = F_time(0.72) * F_weather(0.82) = 0.5904 (detectability_level not applied for active)
  assert.ok(Math.abs(r.C_t - 0.5904) < 0.0001);
  assert.ok(Math.abs(r.M_comp - 0.7) < 0.0001);
  assert.ok(r.POD_final < 0.3);
  assert.ok(r.POD_final > 0);
});

test('QA warnings fire on extreme values', () => {
  const seg1 = { critical_spacing_m: 0.5, area_coverage_pct: 30 };
  const warnings = generateQaWarnings(seg1, config);
  assert.equal(warnings.length, 2);

  const seg2 = { critical_spacing_m: 60, area_coverage_pct: 100 };
  const warnings2 = generateQaWarnings(seg2, config);
  assert.equal(warnings2.length, 1);
  assert.ok(warnings2[0].includes('> 50'));
});

test('QA warnings empty for normal values', () => {
  const seg = { critical_spacing_m: 15, area_coverage_pct: 100 };
  const warnings = generateQaWarnings(seg, config);
  assert.equal(warnings.length, 0);
});

/* ================================================================
   New factor tests (v2.2)
   ================================================================ */

test('subject_visibility: low reduces C_t, high increases C_t', () => {
  const segment = { time_of_day: 'day', weather: 'clear', detectability_level: 2, critical_spacing_m: 8, area_coverage_pct: 100, vegetation_density: 3, micro_terrain_complexity: 3, extenuating_factors: 3 };
  const searchLow = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none', subject_visibility: 'low' };
  const searchMed = { ...searchLow, subject_visibility: 'medium' };
  const searchHigh = { ...searchLow, subject_visibility: 'high' };

  const rLow = computeForTarget({ config, searchLevel: searchLow, segment, targetKey: 'adult' });
  const rMed = computeForTarget({ config, searchLevel: searchMed, segment, targetKey: 'adult' });
  const rHigh = computeForTarget({ config, searchLevel: searchHigh, segment, targetKey: 'adult' });

  assert.ok(rLow.C_t < rMed.C_t, 'Low visibility should reduce C_t');
  assert.ok(rHigh.C_t > rMed.C_t, 'High visibility should increase C_t');
  assert.ok(Math.abs(rLow.F_visibility - 0.80) < 0.0001);
  assert.ok(Math.abs(rMed.F_visibility - 1.0) < 0.0001);
  assert.ok(Math.abs(rHigh.F_visibility - 1.20) < 0.0001);
});

test('condition_factors: default value 3 gives factor 1.0 for vegetation/terrain/extenuating', () => {
  const segment = { time_of_day: 'day', weather: 'clear', detectability_level: 2, critical_spacing_m: 8, area_coverage_pct: 100, vegetation_density: 3, micro_terrain_complexity: 3, extenuating_factors: 3 };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none', subject_visibility: 'medium' };
  const r = computeForTarget({ config, searchLevel, segment, targetKey: 'adult' });

  assert.ok(Math.abs(r.F_veg - 1.0) < 0.0001);
  assert.ok(Math.abs(r.F_terrain - 1.0) < 0.0001);
  assert.ok(Math.abs(r.F_extenuating - 1.0) < 0.0001);
  // burial_or_cover axis doesn't exist for active targets — falls back to 1.0
  assert.ok(Math.abs(r.F_burial - 1.0) < 0.0001);
});

test('condition_factors: evidence target uses burial_or_cover, not extenuating_factors', () => {
  const segment = { time_of_day: 'day', weather: 'clear', detectability_level: 2, critical_spacing_m: 6, area_coverage_pct: 100, vegetation_density: 3, micro_terrain_complexity: 3, burial_or_cover: 3 };
  const searchLevel = { type_of_search: 'evidence_historical', auditory: 'none', visual: 'none', subject_visibility: 'medium' };
  const r = computeForTarget({ config, searchLevel, segment, targetKey: 'intact_remains' });

  assert.ok(Math.abs(r.F_burial - 1.0) < 0.0001);
  // extenuating_factors axis doesn't exist for evidence targets — falls back to 1.0
  assert.ok(Math.abs(r.F_extenuating - 1.0) < 0.0001);
});

test('visual evade gives negative bonus and reduces M_resp', () => {
  const segment = { time_of_day: 'day', weather: 'clear', detectability_level: 2, critical_spacing_m: 8, area_coverage_pct: 100 };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'evade' };
  const r = computeForTarget({ config, searchLevel, segment, targetKey: 'adult' });

  assert.ok(r.visual_bonus < 0, 'Evade should give negative visual bonus');
  assert.ok(r.M_resp < 1, 'M_resp should be < 1 with evade and no auditory');
  assert.ok(Math.abs(r.M_resp - 0.98) < 0.0001, 'M_resp should be 1 + 0 + (-0.02) = 0.98');
});

test('missing subject_visibility_factor in config falls back to 1.0', () => {
  const minConfig = { ...config };
  delete minConfig.subject_visibility_factor;
  const segment = { time_of_day: 'day', weather: 'clear', detectability_level: 2, critical_spacing_m: 8, area_coverage_pct: 100 };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none', subject_visibility: 'low' };
  const r = computeForTarget({ config: minConfig, searchLevel, segment, targetKey: 'adult' });

  assert.ok(Math.abs(r.F_visibility - 1.0) < 0.0001, 'Should fall back to 1.0 when config key missing');
});

test('missing condition factor axis falls back to 1.0', () => {
  // Create config where adult has no vegetation_density axis
  const minConfig = JSON.parse(JSON.stringify(config));
  delete minConfig.condition_factors.adult.vegetation_density;
  const segment = { time_of_day: 'day', weather: 'clear', detectability_level: 2, critical_spacing_m: 8, area_coverage_pct: 100, vegetation_density: 5 };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none', subject_visibility: 'medium' };
  const r = computeForTarget({ config: minConfig, searchLevel, segment, targetKey: 'adult' });

  assert.ok(Math.abs(r.F_veg - 1.0) < 0.0001, 'Should fall back to 1.0 when condition factor axis missing');
});
