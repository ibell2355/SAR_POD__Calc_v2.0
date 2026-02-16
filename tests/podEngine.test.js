import test from 'node:test';
import assert from 'node:assert/strict';
import { completionMultiplier, inferPrimaryTarget, responseMultiplier, spacingEffectiveness, selectedTargets } from '../src/model/podEngine.js';
import { durationMinutes } from '../src/utils/math.js';

const config = {
  pod: { target_hierarchy: ['child', 'adult'] },
  active_responsiveness: {
    cap: 1.2,
    auditory: { none: 0, possible: 0.1, likely: 0.2 },
    visual: { none: 0, possible: 0.1, likely: 0.2 }
  }
};

test('spacing effectiveness', () => {
  assert.equal(spacingEffectiveness(10, 20, 1), 0.5);
  assert.equal(spacingEffectiveness(20, 10, 1.5), 1);
});

test('response multiplier cap', () => {
  const mult = responseMultiplier({ type_of_search: 'active_missing_person', auditory: 'likely', visual: 'likely' }, config);
  assert.equal(mult, 1.2);
});

test('completion cap', () => {
  assert.equal(completionMultiplier({ area_coverage_pct: 145 }), 1);
  assert.equal(completionMultiplier({ area_coverage_pct: -4 }), 0);
});

test('end-before-start wraps over midnight duration', () => {
  assert.equal(durationMinutes('23:40', '00:10'), 30);
});

test('target selection and hierarchy inference', () => {
  const s = { type_of_search: 'active_missing_person', active_targets: ['adult', 'child'] };
  const targets = selectedTargets(s);
  assert.deepEqual(targets, ['adult', 'child']);
  assert.equal(inferPrimaryTarget(targets, config), 'child');
});
