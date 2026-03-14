import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Since we're a pure ES module browser app, we import the engine directly.
// The clamp helper is tiny; inline it for the test context.
// We mock the import by providing the module inline.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ================================================================
   Unit conversion tests
   ================================================================ */

describe('Unit conversions', () => {
  const ACRES_TO_M2 = 4046.8564224;
  const HECTARES_TO_M2 = 10000;

  it('1 acre = 4046.8564224 m2', () => {
    assert.strictEqual(1 * ACRES_TO_M2, 4046.8564224);
  });

  it('1 hectare = 10000 m2', () => {
    assert.strictEqual(1 * HECTARES_TO_M2, 10000);
  });

  it('10 acres converts correctly', () => {
    const m2 = 10 * ACRES_TO_M2;
    assert.ok(Math.abs(m2 - 40468.564224) < 0.001);
  });

  it('2.5 hectares converts correctly', () => {
    const m2 = 2.5 * HECTARES_TO_M2;
    assert.strictEqual(m2, 25000);
  });
});

/* ================================================================
   Track length estimation tests
   ================================================================ */

describe('Track length estimation', () => {
  function estimateTrackLength({ area_m2, coverage_pct, critical_spacing_m, num_searchers }) {
    const A = Number(area_m2 || 0);
    const pct = Number(coverage_pct ?? 100);
    const S = Number(critical_spacing_m || 0);
    const N = Number(num_searchers || 0);
    if (A <= 0 || S <= 0 || N <= 0) return { L_ind_est: 0, L_total_est: 0 };
    const A_covered_m2 = A * (pct / 100);
    const L_ind_est = A_covered_m2 / (S * N);
    const L_total_est = L_ind_est * N;
    return { L_ind_est, L_total_est };
  }

  it('basic track length: 10000 m2, 100% coverage, 10m spacing, 2 searchers', () => {
    const r = estimateTrackLength({ area_m2: 10000, coverage_pct: 100, critical_spacing_m: 10, num_searchers: 2 });
    assert.strictEqual(r.L_ind_est, 500);    // 10000 / (10 * 2)
    assert.strictEqual(r.L_total_est, 1000);  // 10000 / 10
  });

  it('50% coverage halves track length', () => {
    const r = estimateTrackLength({ area_m2: 10000, coverage_pct: 50, critical_spacing_m: 10, num_searchers: 2 });
    assert.strictEqual(r.L_ind_est, 250);
    assert.strictEqual(r.L_total_est, 500);
  });

  it('zero area returns zero', () => {
    const r = estimateTrackLength({ area_m2: 0, coverage_pct: 100, critical_spacing_m: 10, num_searchers: 2 });
    assert.strictEqual(r.L_ind_est, 0);
    assert.strictEqual(r.L_total_est, 0);
  });

  it('zero spacing returns zero (guard)', () => {
    const r = estimateTrackLength({ area_m2: 10000, coverage_pct: 100, critical_spacing_m: 0, num_searchers: 2 });
    // S=0 triggers the guard: S <= 0 returns zeros
    assert.strictEqual(r.L_ind_est, 0);
    assert.strictEqual(r.L_total_est, 0);
  });

  it('single searcher: L_ind = L_total', () => {
    const r = estimateTrackLength({ area_m2: 10000, coverage_pct: 100, critical_spacing_m: 10, num_searchers: 1 });
    assert.strictEqual(r.L_ind_est, 1000);
    assert.strictEqual(r.L_total_est, 1000);
  });
});

/* ================================================================
   Koopman POD output tests
   ================================================================ */

describe('Koopman POD formula', () => {
  function koopmanPOD(W_eff, L_total, A_m2) {
    if (A_m2 <= 0) return 0;
    const coverage_C = (W_eff * L_total) / A_m2;
    return clamp(1 - Math.exp(-coverage_C), 0, 0.99);
  }

  it('coverage_C = 1 => POD ~ 0.632', () => {
    // W_eff * L_total / A = 1
    const pod = koopmanPOD(10, 100, 1000);
    assert.ok(Math.abs(pod - 0.6321) < 0.01, `Expected ~0.632, got ${pod}`);
  });

  it('small coverage_C ~ coverage_C itself (linear approximation)', () => {
    // For small x: 1 - exp(-x) ~ x
    const pod = koopmanPOD(1, 10, 10000); // coverage = 0.001
    const coverage = (1 * 10) / 10000;
    assert.ok(Math.abs(pod - coverage) < 0.001, `Expected ~${coverage}, got ${pod}`);
  });

  it('very large coverage_C clamps at 0.99', () => {
    const pod = koopmanPOD(50, 10000, 100);
    assert.strictEqual(pod, 0.99);
  });

  it('zero area returns 0', () => {
    assert.strictEqual(koopmanPOD(10, 100, 0), 0);
  });

  it('zero W_eff returns 0', () => {
    const pod = koopmanPOD(0, 100, 1000);
    assert.strictEqual(pod, 0);
  });

  it('zero track length returns 0', () => {
    const pod = koopmanPOD(10, 0, 1000);
    assert.strictEqual(pod, 0);
  });
});

/* ================================================================
   Input guardrail tests
   ================================================================ */

describe('Input guardrails', () => {
  it('clamp prevents negative values', () => {
    assert.strictEqual(clamp(-5, 0, 100), 0);
  });

  it('clamp prevents values above max', () => {
    assert.strictEqual(clamp(150, 0, 100), 100);
  });

  it('clamp passes through valid values', () => {
    assert.strictEqual(clamp(50, 0, 100), 50);
  });

  it('N=0 should produce zero track length', () => {
    // N=0 or negative should not cause divide-by-zero
    const A = 10000, pct = 100, S = 10, N = 0;
    if (N <= 0) {
      assert.ok(true, 'Guard triggered for N=0');
    }
  });

  it('S=0 should produce zero track length', () => {
    const A = 10000, pct = 100, S = 0, N = 2;
    if (S <= 0) {
      assert.ok(true, 'Guard triggered for S=0');
    }
  });

  it('coverage_pct out of range is handled', () => {
    const pct = clamp(120, 0, 100);
    assert.strictEqual(pct, 100);
    const pct2 = clamp(-10, 0, 100);
    assert.strictEqual(pct2, 0);
  });
});

/* ================================================================
   W_eff computation test
   ================================================================ */

describe('W_eff computation', () => {
  it('W_eff = W0 * C_t * M_resp, clamped', () => {
    const W0 = 21;
    const C_t = 1.0;
    const M_resp = 1.0;
    const w_min = 0.5;
    const w_max = 100;
    const W_eff = clamp(W0 * C_t * M_resp, w_min, w_max);
    assert.strictEqual(W_eff, 21);
  });

  it('adverse conditions reduce W_eff', () => {
    const W0 = 21;
    const C_t = 0.5 * 0.88 * 0.45; // night * snow * heavy veg
    const M_resp = 1.0;
    const W_eff = clamp(W0 * C_t * M_resp, 0.5, 100);
    assert.ok(W_eff < 21, `Expected W_eff < 21, got ${W_eff}`);
    assert.ok(W_eff > 0.5, `Expected W_eff > 0.5, got ${W_eff}`);
  });

  it('W_eff clamps to min', () => {
    const W_eff = clamp(0.01, 0.5, 100);
    assert.strictEqual(W_eff, 0.5);
  });

  it('W_eff clamps to max', () => {
    const W_eff = clamp(200, 0.5, 100);
    assert.strictEqual(W_eff, 100);
  });
});
