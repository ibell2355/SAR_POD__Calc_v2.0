import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePOD,
  spacingForTargetPOD,
  responseMultiplier,
  responseComponents,
  generateQaWarnings
} from '../src/model/podEngine.js';

/* ================================================================
   v3 POD engine — real-export coverage

   The previous v2 test file in this slot (hazard-rate calibration,
   completion multiplier, target hierarchy, spacingEffectiveness, etc.)
   targeted a different model and is preserved only in git history. v3
   uses the spacing-based POD model:

     coverage_factor = W_eff / clamp(actual_spacing_m, lower, upper)
     POD = clamp(1 - exp(-coverage_factor), 0, 0.99)

   These tests call the real v3 exports against a minimal config that
   matches the shape of config/SAR_POD_V3_config.yaml. They complement
   tests/v3-sanity.test.js, which exercises the math inline without
   importing the engine.
   ================================================================ */

const N5 = { '1': 1.0, '2': 1.0, '3': 1.0, '4': 1.0, '5': 1.0 };

function buildConfig(overrides = {}) {
  const base = {
    search_types: {
      missing_person: { base_sweep_width_m: 10 },
      historical: { base_sweep_width_m: 1 },
      article_evidence: { base_sweep_width_m: 3 }
    },
    w_eff_bounds_m: { min: 0.5, max: 100 },
    spacing_limits: {
      missing_person: {
        vegetation_1: { lower_spacing_limit: 10, upper_spacing_limit: 40 },
        vegetation_2: { lower_spacing_limit: 9, upper_spacing_limit: 40 },
        vegetation_3: { lower_spacing_limit: 8, upper_spacing_limit: 40 },
        vegetation_4: { lower_spacing_limit: 7, upper_spacing_limit: 40 },
        vegetation_5: { lower_spacing_limit: 6, upper_spacing_limit: 40 }
      },
      historical: {
        vegetation_3: { lower_spacing_limit: 8, upper_spacing_limit: 40 }
      },
      article_evidence: {
        vegetation_3: { lower_spacing_limit: 8, upper_spacing_limit: 40 }
      }
    },
    visibility_lower_limit_adjustment: { low: 4, medium: 2, high: 0 },
    response_model: {
      enabled_for: ['missing_person'],
      auditory_multiplier: { none: 1.0, possible: 1.10, likely: 1.20 },
      visual_multiplier: { evade: 0.5, none: 1.0, possible: 1.05, likely: 1.10 },
      max_total_multiplier: 1.25
    },
    condition_factors: {
      missing_person: {
        visibility: { low: 0.8, medium: 1.0, high: 1.2 },
        time_of_day: { day: 1.0, dusk_dawn: 0.8, night: 0.5 },
        weather: { clear: 1.0, rain: 0.9, snow: 0.8 },
        vegetation_density: { '1': 1.5, '2': 1.25, '3': 1.0, '4': 0.75, '5': 0.5 },
        micro_terrain_complexity: { '1': 1.10, '2': 1.05, '3': 1.0, '4': 0.90, '5': 0.80 },
        extenuating_factors: { '1': 1.06, '2': 1.03, '3': 1.0, '4': 0.95, '5': 0.9 }
      },
      historical: {
        visibility: { low: 0.8, medium: 1.0, high: 1.2 },
        time_of_day: { day: 1.0, dusk_dawn: 0.8, night: 0.5 },
        weather: { clear: 1.0, rain: 0.9, snow: 0.8 },
        vegetation_density: N5,
        micro_terrain_complexity: N5,
        extenuating_factors: N5
      }
    },
    qa_flags: { warn_if_spacing_m_gt: 50 }
  };
  return { ...base, ...overrides };
}

function neutralSegment(overrides = {}) {
  return {
    time_of_day: 'day',
    weather: 'clear',
    vegetation_density: 3,
    micro_terrain_complexity: 3,
    extenuating_factors: 3,
    burial_or_cover: 3,
    num_searchers: 4,
    actual_spacing_m: 10,
    ...overrides
  };
}

function neutralSearch(overrides = {}) {
  return {
    search_for: 'missing_person',
    visibility: 'medium',
    auditory: 'none',
    visual: 'none',
    ...overrides
  };
}

/* ================================================================
   computePOD — end-to-end behavior against real exports
   ================================================================ */

describe('computePOD (v3 spacing-based)', () => {
  it('all-neutral inputs → C_t = 1, M_resp = 1, W_eff = base_sweep_width', () => {
    const config = buildConfig();
    const r = computePOD({
      config,
      searchLevel: neutralSearch(),
      segment: neutralSegment()
    });
    assert.ok(Math.abs(r.C_t - 1) < 1e-9, `Expected C_t=1, got ${r.C_t}`);
    assert.equal(r.M_resp, 1);
    assert.equal(r.W_eff, 10);
  });

  it('coverage_factor = W_eff / effective_spacing, POD = 1 - exp(-cf)', () => {
    // base_sweep_width=10, all factors=1 → W_eff=10
    // veg=3 → spacing limits [8, 40]; vis=medium → lower adj=2 → effective lower=6
    // actual_spacing=10 sits within [6, 40] → effective_spacing=10
    // coverage_factor = 10/10 = 1 → POD = 1 - exp(-1) ≈ 0.6321
    const r = computePOD({
      config: buildConfig(),
      searchLevel: neutralSearch(),
      segment: neutralSegment({ actual_spacing_m: 10 })
    });
    assert.equal(r.effective_spacing_m, 10);
    assert.ok(Math.abs(r.coverage_factor - 1) < 1e-9);
    assert.ok(Math.abs(r.POD - (1 - Math.exp(-1))) < 1e-9);
  });

  it('POD clamped to 0.99 max even with extreme inputs', () => {
    // Push W_eff to its upper bound (100) via an absurd visibility coefficient,
    // so coverage_factor = 100 / effective_spacing is large enough to drive
    // 1 - exp(-cf) above 0.99 regardless of how spacing clamps.
    const config = buildConfig({
      condition_factors: {
        missing_person: {
          visibility: { medium: 50 },
          time_of_day: { day: 1 },
          weather: { clear: 1 },
          vegetation_density: N5,
          micro_terrain_complexity: N5,
          extenuating_factors: N5
        }
      }
    });
    const r = computePOD({
      config,
      searchLevel: neutralSearch(),
      segment: neutralSegment()
    });
    assert.equal(r.W_eff, 100);
    assert.ok(r.coverage_factor >= 5, `expected coverage_factor >= 5, got ${r.coverage_factor}`);
    assert.equal(r.POD, 0.99);
  });

  it('zero / missing actual_spacing produces POD = 0', () => {
    const config = buildConfig();
    const r1 = computePOD({
      config,
      searchLevel: neutralSearch(),
      segment: neutralSegment({ actual_spacing_m: 0 })
    });
    const r2 = computePOD({
      config,
      searchLevel: neutralSearch(),
      segment: neutralSegment({ actual_spacing_m: -5 })
    });
    assert.equal(r1.POD, 0);
    assert.equal(r1.coverage_factor, 0);
    assert.equal(r2.POD, 0);
  });

  it('visibility coefficient scales C_t and therefore W_eff', () => {
    const config = buildConfig();
    const seg = neutralSegment();
    const rLow = computePOD({ config, searchLevel: neutralSearch({ visibility: 'low' }), segment: seg });
    const rMed = computePOD({ config, searchLevel: neutralSearch({ visibility: 'medium' }), segment: seg });
    const rHigh = computePOD({ config, searchLevel: neutralSearch({ visibility: 'high' }), segment: seg });

    assert.ok(rLow.K_visibility === 0.8 && rMed.K_visibility === 1.0 && rHigh.K_visibility === 1.2);
    assert.ok(rLow.W_eff < rMed.W_eff && rMed.W_eff < rHigh.W_eff);
    assert.ok(rLow.POD < rMed.POD && rMed.POD < rHigh.POD);
  });

  it('W_eff clamps to w_eff_bounds.max', () => {
    // Force a huge product via stacked coefficients; expect clamp at 100
    const config = buildConfig({
      condition_factors: {
        missing_person: {
          visibility: { medium: 50 }, // absurd, just to exercise the clamp
          time_of_day: { day: 1 },
          weather: { clear: 1 },
          vegetation_density: N5,
          micro_terrain_complexity: N5,
          extenuating_factors: N5
        }
      }
    });
    const r = computePOD({
      config,
      searchLevel: neutralSearch(),
      segment: neutralSegment()
    });
    assert.equal(r.W_eff, 100);
  });

  it('spacing limits clamp effective_spacing for the POD calc', () => {
    const config = buildConfig();
    // veg=3, missing_person → [lower=8, upper=40]; vis=medium → lower adj=2 → effective lower=6
    const tooTight = computePOD({
      config,
      searchLevel: neutralSearch(),
      segment: neutralSegment({ actual_spacing_m: 1 })
    });
    assert.equal(tooTight.spacing_lower_limit, 6);
    assert.equal(tooTight.effective_spacing_m, 6, 'spacing below lower bound should clamp up');

    const tooLoose = computePOD({
      config,
      searchLevel: neutralSearch(),
      segment: neutralSegment({ actual_spacing_m: 9999 })
    });
    assert.equal(tooLoose.spacing_upper_limit, 40);
    assert.equal(tooLoose.effective_spacing_m, 40, 'spacing above upper bound should clamp down');
  });

  it('low visibility increases the lower-spacing limit adjustment effect', () => {
    // visibility_lower_limit_adjustment: low=4, medium=2, high=0
    // base lower at veg=3 is 8; adjusted lower = 8 - adjustment
    const config = buildConfig();
    const seg = neutralSegment({ actual_spacing_m: 1 }); // force the lower clamp
    const rLow = computePOD({ config, searchLevel: neutralSearch({ visibility: 'low' }), segment: seg });
    const rMed = computePOD({ config, searchLevel: neutralSearch({ visibility: 'medium' }), segment: seg });
    const rHigh = computePOD({ config, searchLevel: neutralSearch({ visibility: 'high' }), segment: seg });

    assert.equal(rLow.spacing_lower_limit, 4);
    assert.equal(rMed.spacing_lower_limit, 6);
    assert.equal(rHigh.spacing_lower_limit, 8);
  });

  it('defensive defaults: missing condition_factor axis falls back to 1.0', () => {
    const config = buildConfig();
    delete config.condition_factors.missing_person.vegetation_density;
    const r = computePOD({
      config,
      searchLevel: neutralSearch(),
      segment: neutralSegment({ vegetation_density: 5 }) // would normally drive K_veg=0.5
    });
    assert.equal(r.K_veg, 1, 'missing axis should default to 1');
  });

  it('defensive defaults: missing w_eff_bounds keys use sane fallbacks (min=0.5, max=100)', () => {
    const config = buildConfig();
    delete config.w_eff_bounds_m;
    const r = computePOD({
      config,
      searchLevel: neutralSearch(),
      segment: neutralSegment()
    });
    assert.equal(r.w_eff_min, 0.5);
    assert.equal(r.w_eff_max, 100);
  });
});

/* ================================================================
   responseMultiplier / responseComponents
   ================================================================ */

describe('response model', () => {
  it('disabled for non-missing_person search types → M_resp = 1', () => {
    const config = buildConfig();
    const m = responseMultiplier(neutralSearch({ search_for: 'historical', auditory: 'likely', visual: 'likely' }), config);
    assert.equal(m, 1);
    const components = responseComponents(neutralSearch({ search_for: 'historical', auditory: 'likely', visual: 'likely' }), config);
    assert.equal(components.M_resp, 1);
    assert.equal(components.auditory_multiplier, 1);
    assert.equal(components.visual_multiplier, 1);
  });

  it('enabled for missing_person → multiplies auditory and visual', () => {
    const config = buildConfig();
    // likely(1.20) * likely(1.10) = 1.32 → capped at 1.25
    const m = responseMultiplier(neutralSearch({ auditory: 'likely', visual: 'likely' }), config);
    assert.equal(m, 1.25, 'should clamp at max_total_multiplier');

    // possible(1.10) * none(1.0) = 1.10 → no cap
    const m2 = responseMultiplier(neutralSearch({ auditory: 'possible', visual: 'none' }), config);
    assert.ok(Math.abs(m2 - 1.10) < 1e-9);
  });

  it('visual=evade pulls M_resp below 1', () => {
    const config = buildConfig();
    // none(1.0) * evade(0.5) = 0.5
    const m = responseMultiplier(neutralSearch({ auditory: 'none', visual: 'evade' }), config);
    assert.equal(m, 0.5);
  });

  it('response cap applied through computePOD', () => {
    const config = buildConfig();
    const r = computePOD({
      config,
      searchLevel: neutralSearch({ auditory: 'likely', visual: 'likely' }),
      segment: neutralSegment()
    });
    assert.equal(r.M_resp, 1.25);
    // base=10, C_t=1, M_resp=1.25 → W_eff=12.5
    assert.equal(r.W_eff, 12.5);
  });
});

/* ================================================================
   spacingForTargetPOD — reverse calc helper
   ================================================================ */

describe('spacingForTargetPOD', () => {
  it('returns spacing such that 1 - exp(-W_eff/spacing) = target', () => {
    // For target POD = 0.6321 (= 1 - exp(-1)), spacing should equal W_eff
    const s = spacingForTargetPOD(10, 1 - Math.exp(-1));
    assert.ok(Math.abs(s - 10) < 1e-9);
  });

  it('returns null for invalid inputs', () => {
    assert.equal(spacingForTargetPOD(0, 0.5), null);
    assert.equal(spacingForTargetPOD(-5, 0.5), null);
    assert.equal(spacingForTargetPOD(10, 0), null);
    assert.equal(spacingForTargetPOD(10, 1), null);
  });
});

/* ================================================================
   generateQaWarnings
   ================================================================ */

describe('generateQaWarnings', () => {
  it('no warnings on normal inputs', () => {
    const config = buildConfig();
    const w = generateQaWarnings(neutralSegment(), config);
    assert.deepEqual(w, []);
  });

  it('flags zero or missing actual_spacing_m', () => {
    const config = buildConfig();
    const w = generateQaWarnings(neutralSegment({ actual_spacing_m: 0 }), config);
    assert.equal(w.length, 1);
    assert.match(w[0], /Actual spacing is missing or zero/);
  });

  it('flags spacing larger than warn_if_spacing_m_gt', () => {
    const config = buildConfig();
    const w = generateQaWarnings(neutralSegment({ actual_spacing_m: 75 }), config);
    assert.equal(w.length, 1);
    assert.match(w[0], /> 50/);
  });

  it('flags zero or missing num_searchers', () => {
    const config = buildConfig();
    const w = generateQaWarnings(neutralSegment({ num_searchers: 0 }), config);
    assert.equal(w.length, 1);
    assert.match(w[0], /Number of searchers is missing or zero/);
  });

  it('threshold is configurable via qa_flags.warn_if_spacing_m_gt', () => {
    const config = buildConfig({ qa_flags: { warn_if_spacing_m_gt: 20 } });
    const w = generateQaWarnings(neutralSegment({ actual_spacing_m: 25 }), config);
    assert.equal(w.length, 1);
    assert.match(w[0], /> 20/);
  });
});
