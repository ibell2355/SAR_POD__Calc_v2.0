import test from 'node:test';
import assert from 'node:assert/strict';
import { completionMultiplier, inferPrimaryTarget, responseMultiplier, spacingEffectiveness, selectedTargets, computeForTarget, generateQaWarnings } from '../src/model/podEngine.js';

/* ================================================================
   Test config matching SAR_POD_V2_config.yaml structure
   ================================================================ */

const config = {
  targets: {
    adult:                  { group: 'active_missing_person', pod_ceiling: 0.97, base_reference_spacing_m: 25, spacing_exponent_k: 1.4 },
    child:                  { group: 'active_missing_person', pod_ceiling: 0.96, base_reference_spacing_m: 20, spacing_exponent_k: 1.5 },
    large_clues:            { group: 'active_missing_person', pod_ceiling: 0.93, base_reference_spacing_m: 12, spacing_exponent_k: 1.7 },
    small_clues:            { group: 'active_missing_person', pod_ceiling: 0.88, base_reference_spacing_m: 5,  spacing_exponent_k: 2.0 },
    intact_remains:         { group: 'evidence_historical',   pod_ceiling: 0.95, base_reference_spacing_m: 14, spacing_exponent_k: 1.7 },
    large_evidence:         { group: 'evidence_historical',   pod_ceiling: 0.92, base_reference_spacing_m: 12, spacing_exponent_k: 1.8 },
    small_evidence:         { group: 'evidence_historical',   pod_ceiling: 0.86, base_reference_spacing_m: 5,  spacing_exponent_k: 2.1 }
  },
  primary_target_hierarchy: {
    active_missing_person: ['adult', 'child', 'large_clues', 'small_clues'],
    evidence_historical: { order: ['intact_remains', 'large_evidence', 'small_evidence'] }
  },
  condition_factors: {
    time_of_day: {
      day:       { adult: 1.00, child: 1.00, large_clues: 1.00, small_clues: 1.00, intact_remains: 1.00, large_evidence: 1.00, small_evidence: 1.00 },
      dusk_dawn: { adult: 0.90, child: 0.90, large_clues: 0.82, small_clues: 0.72, intact_remains: 0.84, large_evidence: 0.82, small_evidence: 0.72 },
      night:     { adult: 0.72, child: 0.70, large_clues: 0.58, small_clues: 0.42, intact_remains: 0.60, large_evidence: 0.58, small_evidence: 0.42 }
    },
    weather: {
      clear: { adult: 1.00, child: 1.00, large_clues: 1.00, small_clues: 1.00, intact_remains: 1.00, large_evidence: 1.00, small_evidence: 1.00 },
      rain:  { adult: 0.90, child: 0.90, large_clues: 0.84, small_clues: 0.74, intact_remains: 0.86, large_evidence: 0.84, small_evidence: 0.74 },
      snow:  { adult: 0.82, child: 0.82, large_clues: 0.74, small_clues: 0.60, intact_remains: 0.76, large_evidence: 0.74, small_evidence: 0.60 }
    },
    detectability_level: {
      '1': { adult: 1.10, child: 1.08, large_clues: 1.05, small_clues: 1.00, intact_remains: 1.05, large_evidence: 1.05, small_evidence: 1.00 },
      '3': { adult: 0.88, child: 0.86, large_clues: 0.76, small_clues: 0.62, intact_remains: 0.78, large_evidence: 0.76, small_evidence: 0.62 },
      '5': { adult: 0.60, child: 0.58, large_clues: 0.44, small_clues: 0.30, intact_remains: 0.46, large_evidence: 0.44, small_evidence: 0.30 }
    }
  },
  reference_spacing_bounds_m: {
    min_by_target: { adult: 3, child: 3, large_clues: 2, small_clues: 1, intact_remains: 2, large_evidence: 2, small_evidence: 1 },
    max_by_target: { adult: 40, child: 35, large_clues: 25, small_clues: 10, intact_remains: 28, large_evidence: 25, small_evidence: 10 }
  },
  response_model: {
    enabled_for_groups: ['active_missing_person'],
    auditory_bonus: { none: 0, possible: 0.05, likely: 0.10 },
    visual_bonus: { none: 0, possible: 0.03, likely: 0.07 },
    max_total_multiplier: 1.25
  },
  completion_model: { use_strict_subtractive_formula: true },
  qa_flags: {
    warn_if_critical_spacing_m_lt_1: true,
    warn_if_critical_spacing_m_gt_50: true,
    'warn_if_searched_fraction_lt_0.5': true,
    'warn_if_inaccessible_fraction_gt_0.4': true
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

test('response multiplier capped at 1.25 for active group', () => {
  const mult = responseMultiplier(
    { type_of_search: 'active_missing_person', auditory: 'likely', visual: 'likely' },
    config,
    'adult'
  );
  assert.ok(Math.abs(mult - 1.17) < 0.0001); // 1 + 0.10 + 0.07 = 1.17 (under cap)
});

test('response multiplier is 1 for evidence_historical targets', () => {
  const mult = responseMultiplier(
    { type_of_search: 'evidence_historical', auditory: 'likely', visual: 'likely' },
    config,
    'intact_remains'
  );
  assert.equal(mult, 1);
});

test('completion multiplier strict subtractive', () => {
  assert.ok(Math.abs(completionMultiplier({ searched_fraction: 0.8, inaccessible_fraction: 0.1 }) - 0.7) < 0.0001);
  assert.equal(completionMultiplier({ searched_fraction: 1.0, inaccessible_fraction: 0.0 }), 1);
  assert.equal(completionMultiplier({ searched_fraction: 0.3, inaccessible_fraction: 0.5 }), 0);
  assert.equal(completionMultiplier({ searched_fraction: 1.5, inaccessible_fraction: 0.0 }), 1);
});

test('target selection and hierarchy inference - active', () => {
  const s = { type_of_search: 'active_missing_person', active_targets: ['child', 'adult'] };
  const targets = selectedTargets(s);
  assert.deepEqual(targets, ['child', 'adult']);
  assert.equal(inferPrimaryTarget(targets, config, 'active_missing_person'), 'adult');
});

test('target selection and hierarchy inference - evidence', () => {
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

test('computeForTarget uses per-target values', () => {
  const segment = {
    time_of_day: 'day',
    weather: 'clear',
    detectability_level: 1,
    critical_spacing_m: 15,
    searched_fraction: 1.0,
    inaccessible_fraction: 0.0
  };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none' };
  const result = computeForTarget({ config, searchLevel, segment, targetKey: 'adult' });

  // Per-target values from config
  assert.equal(result.POD_ceiling, 0.97);
  assert.equal(result.S_base, 25);
  assert.equal(result.k, 1.4);

  // Detect level 1, adult = 1.10
  assert.equal(result.F_detectability, 1.10);

  // C_t = 1.0 * 1.0 * 1.10 = 1.10
  assert.ok(Math.abs(result.C_t - 1.10) < 0.0001);

  // S_ref_raw = 25 * 1.10 = 27.5, within bounds [3, 40]
  assert.ok(Math.abs(result.S_ref - 27.5) < 0.0001);

  // E_space = min(1, (27.5/15)^1.4) = min(1, 1.833^1.4) > 1 → 1
  assert.equal(result.E_space, 1);

  // M_resp = 1 (no bonus)
  assert.equal(result.M_resp, 1);

  // M_comp = max(0, min(1, 1.0 - 0.0)) = 1
  assert.equal(result.M_comp, 1);

  // POD_final = clamp(0.97 * 1 * 1 * 1, 0, 0.99) = 0.97
  assert.ok(Math.abs(result.POD_final - 0.97) < 0.0001);
});

test('computeForTarget with conditions reduces POD', () => {
  const segment = {
    time_of_day: 'night',
    weather: 'snow',
    detectability_level: 5,
    critical_spacing_m: 15,
    searched_fraction: 0.8,
    inaccessible_fraction: 0.1
  };
  const searchLevel = { type_of_search: 'active_missing_person', auditory: 'none', visual: 'none' };
  const result = computeForTarget({ config, searchLevel, segment, targetKey: 'adult' });

  // C_t = 0.72 * 0.82 * 0.60 = 0.35424
  assert.ok(Math.abs(result.C_t - 0.35424) < 0.0001);

  // S_ref_raw = 25 * 0.35424 = 8.856, within bounds [3, 40]
  assert.ok(Math.abs(result.S_ref - 8.856) < 0.001);

  // M_comp = max(0, min(1, 0.8 - 0.1)) = 0.7
  assert.ok(Math.abs(result.M_comp - 0.7) < 0.0001);

  // POD should be much lower
  assert.ok(result.POD_final < 0.5);
  assert.ok(result.POD_final > 0);
});

test('QA warnings fire on extreme values', () => {
  const seg1 = { critical_spacing_m: 0.5, searched_fraction: 0.3, inaccessible_fraction: 0.5 };
  const warnings = generateQaWarnings(seg1, config);
  assert.equal(warnings.length, 3);

  const seg2 = { critical_spacing_m: 60, searched_fraction: 1.0, inaccessible_fraction: 0 };
  const warnings2 = generateQaWarnings(seg2, config);
  assert.equal(warnings2.length, 1);
  assert.ok(warnings2[0].includes('> 50'));
});

test('QA warnings empty for normal values', () => {
  const seg = { critical_spacing_m: 15, searched_fraction: 1.0, inaccessible_fraction: 0 };
  const warnings = generateQaWarnings(seg, config);
  assert.equal(warnings.length, 0);
});
