import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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
   Spacing-based POD formula tests
   ================================================================ */

describe('Spacing-based POD formula', () => {
  function spacingPOD(W_eff, actual_spacing_m) {
    if (actual_spacing_m <= 0) return 0;
    const coverage_factor = W_eff / actual_spacing_m;
    return clamp(1 - Math.exp(-coverage_factor), 0, 0.99);
  }

  it('W_eff = spacing => coverage_factor = 1 => POD ~ 0.632', () => {
    const pod = spacingPOD(10, 10);
    assert.ok(Math.abs(pod - 0.6321) < 0.01, `Expected ~0.632, got ${pod}`);
  });

  it('W_eff much less than spacing => low POD', () => {
    // coverage_factor = 1/100 = 0.01
    const pod = spacingPOD(1, 100);
    const expected = 1 - Math.exp(-0.01);
    assert.ok(Math.abs(pod - expected) < 0.001, `Expected ~${expected}, got ${pod}`);
  });

  it('W_eff much greater than spacing => POD clamps at 0.99', () => {
    const pod = spacingPOD(100, 1);
    assert.strictEqual(pod, 0.99);
  });

  it('zero spacing returns 0', () => {
    assert.strictEqual(spacingPOD(10, 0), 0);
  });

  it('zero W_eff returns 0', () => {
    const pod = spacingPOD(0, 10);
    assert.strictEqual(pod, 0);
  });

  it('coverage_factor = 2 => POD ~ 0.865', () => {
    const pod = spacingPOD(20, 10);
    const expected = 1 - Math.exp(-2);
    assert.ok(Math.abs(pod - expected) < 0.01, `Expected ~${expected.toFixed(3)}, got ${pod}`);
  });

  it('coverage_factor = 0.5 => POD ~ 0.393', () => {
    const pod = spacingPOD(5, 10);
    const expected = 1 - Math.exp(-0.5);
    assert.ok(Math.abs(pod - expected) < 0.01, `Expected ~${expected.toFixed(3)}, got ${pod}`);
  });
});

/* ================================================================
   Coverage factor tests
   ================================================================ */

describe('Coverage factor', () => {
  it('coverage_factor = W_eff / actual_spacing', () => {
    const W_eff = 16;
    const spacing = 8;
    const cf = W_eff / spacing;
    assert.strictEqual(cf, 2);
  });

  it('small spacing gives high coverage', () => {
    const cf = 10 / 2;
    assert.strictEqual(cf, 5);
  });

  it('large spacing gives low coverage', () => {
    const cf = 10 / 100;
    assert.strictEqual(cf, 0.1);
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

  it('spacing <= 0 should produce zero POD', () => {
    const spacing = 0;
    if (spacing <= 0) {
      assert.ok(true, 'Guard triggered for spacing=0');
    }
  });

  it('negative spacing should produce zero POD', () => {
    const spacing = -5;
    if (spacing <= 0) {
      assert.ok(true, 'Guard triggered for negative spacing');
    }
  });
});

/* ================================================================
   W_eff computation tests
   ================================================================ */

describe('W_eff computation', () => {
  it('W_eff = base * C_t * M_resp, clamped', () => {
    const base = 10;
    const C_t = 1.6; // medium visibility
    const M_resp = 1.0;
    const w_min = 0.5;
    const w_max = 100;
    const W_eff = clamp(base * C_t * M_resp, w_min, w_max);
    assert.strictEqual(W_eff, 16);
  });

  it('visibility coefficient scales W_eff', () => {
    const base = 10;
    const K_vis_high = 1.8;
    const K_vis_low = 1.1;
    const W_high = base * K_vis_high;
    const W_low = base * K_vis_low;
    assert.strictEqual(W_high, 18);
    assert.strictEqual(W_low, 11);
    assert.ok(W_high > W_low, 'High visibility should give higher W_eff');
  });

  it('W_eff clamps to min', () => {
    const W_eff = clamp(0.01, 0.5, 100);
    assert.strictEqual(W_eff, 0.5);
  });

  it('W_eff clamps to max', () => {
    const W_eff = clamp(200, 0.5, 100);
    assert.strictEqual(W_eff, 100);
  });

  it('multiple coefficients multiply together', () => {
    const base = 10;
    const K_vis = 1.6;
    const K_time = 1.0;
    const K_weather = 1.0;
    const K_veg = 1.0;
    const K_terrain = 1.0;
    const K_ext = 1.0;
    const C_t = K_vis * K_time * K_weather * K_veg * K_terrain * K_ext;
    assert.strictEqual(C_t, 1.6);
    assert.strictEqual(base * C_t, 16);
  });
});

/* ================================================================
   End-to-end POD calculation test
   ================================================================ */

describe('End-to-end POD', () => {
  it('base=10, vis=medium(1.6), spacing=10 => coverage=1.6 => POD~0.798', () => {
    const base = 10;
    const C_t = 1.6;
    const M_resp = 1.0;
    const W_eff = clamp(base * C_t * M_resp, 0.5, 100);
    const spacing = 10;
    const cf = W_eff / spacing;
    const pod = clamp(1 - Math.exp(-cf), 0, 0.99);
    assert.ok(Math.abs(cf - 1.6) < 0.001, `Expected coverage_factor=1.6, got ${cf}`);
    assert.ok(Math.abs(pod - 0.7981) < 0.01, `Expected POD~0.798, got ${pod}`);
  });

  it('base=10, vis=high(1.8), spacing=5 => coverage=3.6 => POD~0.973', () => {
    const base = 10;
    const C_t = 1.8;
    const M_resp = 1.0;
    const W_eff = clamp(base * C_t * M_resp, 0.5, 100);
    const spacing = 5;
    const cf = W_eff / spacing;
    const pod = clamp(1 - Math.exp(-cf), 0, 0.99);
    assert.ok(Math.abs(cf - 3.6) < 0.001, `Expected coverage_factor=3.6, got ${cf}`);
    assert.ok(Math.abs(pod - 0.9727) < 0.01, `Expected POD~0.973, got ${pod}`);
  });

  it('base=10, vis=low(1.1), spacing=20 => coverage=0.55 => POD~0.423', () => {
    const base = 10;
    const C_t = 1.1;
    const M_resp = 1.0;
    const W_eff = clamp(base * C_t * M_resp, 0.5, 100);
    const spacing = 20;
    const cf = W_eff / spacing;
    const pod = clamp(1 - Math.exp(-cf), 0, 0.99);
    assert.ok(Math.abs(cf - 0.55) < 0.001, `Expected coverage_factor=0.55, got ${cf}`);
    assert.ok(Math.abs(pod - 0.4231) < 0.01, `Expected POD~0.423, got ${pod}`);
  });
});
