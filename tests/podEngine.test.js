import test from 'node:test';
import assert from 'node:assert/strict';
import { completionMultiplier, inferPrimaryTarget, responseMultiplier, spacingEffectiveness, selectedTargets, computeForTarget, generateQaWarnings } from '../src/model/podEngine.js';

/* ================================================================
   Test config matching SAR_POD_V2_config.yaml structure
   ================================================================ */

const config = {
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
    active_missing_person: { order: ['adult', 'child', 'large_clues', 'small_clues'] },
    evidence_historical: { order: ['intact_remains', 'partially_skeletonized', 'skeletal_remains', 'large_evidence', 'small_evidence'] }
  },
  condition_factors: {
    adult:                  { time_of_day: { day: 1.0, dusk_dawn: 0.9, night: 0.72 }, weather: { clear: 1.0, rain: 0.9, snow: 0.82 }, detectability_level: { '1': 1.1, '2': 1.0, '3': 0.88, '4': 0.74, '5': 0.6 } },
    child:                  { time_of_day: { day: 1.0, dusk_dawn: 0.9, night: 0.7 },  weather: { clear: 1.0, rain: 0.9, snow: 0.82 }, detectability_level: { '1': 1.08, '2': 0.98, '3': 0.86, '4': 0.72, '5': 0.58 } },
    large_clues:            { time_of_day: { day: 1.0, dusk_dawn: 0.82, night: 0.58 }, weather: { clear: 1.0, rain: 0.84, snow: 0.74 }, detectability_level: { '1': 1.05, '2': 0.94, '3': 0.76, '4': 0.58, '5': 0.44 } },
    small_clues:            { time_of_day: { day: 1.0, dusk_dawn: 0.72, night: 0.42 }, weather: { clear: 1.0, rain: 0.74, snow: 0.6 },  detectability_level: { '1': 1.0, '2': 0.84, '3': 0.62, '4': 0.44, '5': 0.3 } },
    intact_remains:         { time_of_day: { day: 1.0, dusk_dawn: 0.84, night: 0.6 },  weather: { clear: 1.0, rain: 0.86, snow: 0.76 }, detectability_level: { '1': 1.05, '2': 0.95, '3': 0.78, '4': 0.6, '5': 0.46 } },
    partially_skeletonized: { time_of_day: { day: 1.0, dusk_dawn: 0.78, night: 0.5 },  weather: { clear: 1.0, rain: 0.8, snow: 0.66 },  detectability_level: { '1': 1.0, '2': 0.9, '3': 0.7, '4': 0.52, '5': 0.38 } },
    skeletal_remains:       { time_of_day: { day: 1.0, dusk_dawn: 0.74, night: 0.46 }, weather: { clear: 1.0, rain: 0.76, snow: 0.62 }, detectability_level: { '1': 0.98, '2': 0.86, '3': 0.66, '4': 0.48, '5': 0.34 } },
    large_evidence:         { time_of_day: { day: 1.0, dusk_dawn: 0.82, night: 0.58 }, weather: { clear: 1.0, rain: 0.84, snow: 0.74 }, detectability_level: { '1': 1.05, '2': 0.94, '3': 0.76, '4': 0.58, '5': 0.44 } },
    small_evidence:         { time_of_day: { day: 1.0, dusk_dawn: 0.72, night: 0.42 }, weather: { clear: 1.0, rain: 0.74, snow: 0.6 },  detectability_level: { '1': 1.0, '2': 0.84, '3': 0.62, '4': 0.44, '5': 0.3 } }
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
  qa_flags: {
    warn_if_critical_spacing_m_lt_1: true,
    warn_if_critical_spacing_m_gt_50: true,
    warn_if_area_coverage_pct_lt_50: true
  }
};

/* ================================================================
   Tests
   ================================================================ */

test('spacing effectiveness', () => {
  assert.equal(spacingEffectiveness(10, 20, 1), 0.5);
  assert.equal(spacingEffectiveness(20, 10, 1.5), 1);
  assert.equal(spacingEffectiveness(5, 0, 1.4), 0);
});

test('spacing effectiveness caps at 1 when critical_spacing < reference', () => {
  assert.equal(spacingEffectiveness(25, 10, 1.4), 1);
  assert.equal(spacingEffectiveness(25, 25, 1.4), 1);
  assert.equal(spacingEffectiveness(100, 5, 2.0), 1);
});

test('response multiplier capped at 1.25 for active group', () => {
  const mult = responseMultiplier(
    { type_of_search: 'active_missing_person', auditory: 'likely', visual: 'likely' },
    config,
    'adult'
  );
  assert.ok(Math.abs(mult - 1.17) < 0.0001);
});

test('response multiplier is 1 for evidence_historical targets (disabled group)', () => {
  const mult = responseMultiplier(
    { type_of_search: 'evidence_historical', auditory: 'likely', visual: 'likely' },
    config,
    'intact_remains'
  );
  assert.equal(mult, 1);

  const mult2 = responseMultiplier(
    { type_of_search: 'evidence_historical', auditory: 'likely', visual: 'likely' },
    config,
    'partially_skeletonized'
  );
  assert.equal(mult2, 1);
});

test('completion multiplier from area coverage percentage', () => {
  assert.equal(completionMultiplier({ area_coverage_pct: 100 }), 1);
  assert.ok(Math.abs(completionMultiplier({ area_coverage_pct: 80 }) - 0.8) < 0.0001);
  assert.ok(Math.abs(completionMultiplier({ area_coverage_pct: 50 }) - 0.5) < 0.0001);
  assert.equal(completionMultiplier({ area_coverage_pct: 0 }), 0);
});

test('completion multiplier clamps to 0-1 range', () => {
  assert.equal(completionMultiplier({ area_coverage_pct: 150 }), 1);
  assert.equal(completionMultiplier({ area_coverage_pct: -10 }), 0);
});

test('target selection and hierarchy inference - active (uses .order)', () => {
  const s = { type_of_search: 'active_missing_person', active_targets: ['child', 'adult'] };
  const targets = selectedTargets(s);
  assert.deepEqual(targets, ['child', 'adult']);
  assert.equal(inferPrimaryTarget(targets, config, 'active_missing_person'), 'adult');
});

test('target selection and hierarchy inference - evidence (uses .order)', () => {
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

test('detectability_level lookup with numeric input uses string key', () => {
  const segment = {
    time_of_day: 'day',
    weather: 'clear',
    detectability_level: 3,
    critical_spacing_m: 5,
    area_coverage_pct: 100
  };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none' };
  const result = computeForTarget({ config, searchLevel, segment, targetKey: 'adult' });
  assert.ok(Math.abs(result.F_detectability - 0.88) < 0.0001);
});

test('computeForTarget uses exponential formula with per-target values', () => {
  const segment = {
    time_of_day: 'day',
    weather: 'clear',
    detectability_level: 1,
    critical_spacing_m: 5,
    area_coverage_pct: 100
  };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none' };
  const result = computeForTarget({ config, searchLevel, segment, targetKey: 'adult' });

  assert.equal(result.base_detectability, 0.8);
  assert.equal(result.calibration_constant_k, 1.0);
  assert.equal(result.base_reference_critical_spacing_m, 8.0);
  assert.equal(result.spacing_exponent, 2.0);

  assert.ok(Math.abs(result.F_detectability - 1.1) < 0.0001);
  assert.ok(Math.abs(result.C_t - 1.1) < 0.0001);
  assert.ok(Math.abs(result.D_eff - 0.88) < 0.0001);

  assert.equal(result.S_ref_raw, 8.0);
  assert.equal(result.S_ref, 8.0);
  assert.equal(result.E_space, 1);
  assert.equal(result.M_resp, 1);
  assert.equal(result.M_comp, 1);

  const expectedPod = 1 - Math.exp(-1.0 * 0.88 * 1 * 1);
  assert.ok(Math.abs(result.POD_final - expectedPod) < 0.0001);
});

test('computeForTarget with harsh conditions reduces POD', () => {
  const segment = {
    time_of_day: 'night',
    weather: 'snow',
    detectability_level: 5,
    critical_spacing_m: 15,
    area_coverage_pct: 70
  };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none' };
  const result = computeForTarget({ config, searchLevel, segment, targetKey: 'adult' });

  assert.ok(Math.abs(result.C_t - 0.35424) < 0.0001);
  assert.ok(Math.abs(result.D_eff - 0.283392) < 0.0001);
  assert.equal(result.S_ref_raw, 8.0);
  assert.ok(Math.abs(result.M_comp - 0.7) < 0.0001);
  assert.ok(result.POD_final < 0.3);
  assert.ok(result.POD_final > 0);
});

test('POD clamped to 0.99 max even with ideal conditions', () => {
  const highKConfig = {
    ...config,
    targets: {
      ...config.targets,
      adult: { ...config.targets.adult, calibration_constant_k: 10.0 }
    }
  };
  const segment = {
    time_of_day: 'day',
    weather: 'clear',
    detectability_level: 1,
    critical_spacing_m: 3,
    area_coverage_pct: 100
  };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'likely', visual: 'likely' };
  const result = computeForTarget({ config: highKConfig, searchLevel, segment, targetKey: 'adult' });

  assert.ok(result.POD_raw > 0.99, 'POD_raw should exceed 0.99 before clamping');
  assert.equal(result.POD_final, 0.99);
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
