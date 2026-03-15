import { clamp } from '../utils/math.js';

/* ================================================================
   Report Data — single source of truth for plain-text and upload

   Both the human-readable report and the structured upload JSON
   are derived from the same data object built here.
   ================================================================ */

/* ---- Label maps (display names for report output) ---- */

const SEARCH_FOR = { missing_person: 'Missing Person', historical_article: 'Historical Article', evidence: 'Evidence' };
const VISIBILITY = { low: 'Low', medium: 'Medium', high: 'High' };
const AUDITORY = { none: 'Not Expected', possible: 'Possible', likely: 'Likely' };
const VISUAL = { evade: 'Expected to Evade', none: 'Not Expected', possible: 'Possible', likely: 'Likely' };
const TIME_OF_DAY = { day: 'Day', dusk_dawn: 'Dusk/Dawn', night: 'Night' };
const WEATHER = { clear: 'Clear', rain: 'Raining', snow: 'Snowing' };
const VEG = { '1': '1 - Low Vegetation', '2': '2 - Low/Moderate Vegetation', '3': '3 - Moderate Vegetation', '4': '4 - Moderate/High Vegetation', '5': '5 - High Vegetation' };
const TERRAIN = { '1': '1 - Minimal Micro-terrain', '2': '2 - Minimal/Moderate Micro-terrain', '3': '3 - Moderate Micro-terrain', '4': '4 - Moderate/Extensive Micro-terrain', '5': '5 - Extensive Micro-terrain' };
const EXT = { '1': '1 - Strongly Favorable', '2': '2 - Somewhat Favorable', '3': '3 - Neutral', '4': '4 - Somewhat Adverse', '5': '5 - Strongly Adverse' };
const BURIAL = { '1': '1 - Fully Exposed', '2': '2 - Light Cover', '3': '3 - Moderate Cover', '4': '4 - Heavy Cover', '5': '5 - Completely Buried' };

/* ================================================================
   Segment key — stable identity for a named segment

   Normalizes the segment name so that "Segment 1", " segment  1 ",
   and "SEGMENT 1" all map to the same key: "segment-1".
   ================================================================ */

export function segmentKey(name) {
  return (name || 'unnamed')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unnamed';
}

/* ================================================================
   Report ID — deterministic fingerprint of one exact report

   Hashes only the fields that define the SEARCH RESULT identity:
   search configuration + segment inputs. Excludes:
   - session metadata (your_name, search_name, team_name)
   - generated_at / timestamps
   - computed outputs (POD, W_eff — deterministic from inputs)
   - display labels (uses raw values for stability)

   - Same segment_key + same report_id  = duplicate re-upload
   - Same segment_key + different report_id = new search of same segment
   ================================================================ */

export function reportId(searchLevel, segment) {
  const s = searchLevel;
  const fp = JSON.stringify([
    // Segment instance identity (UUID distinguishes same-name segments)
    segment.id,
    // Search-level settings that affect the calculation
    s.search_for,
    s.visibility,
    s.auditory || null,
    s.visual || null,
    // Segment inputs (raw values, not display labels)
    segment.name || 'Unnamed',
    segment.num_searchers || 1,
    segment.actual_spacing_m,
    segment.time_of_day,
    segment.weather,
    segment.vegetation_density,
    segment.micro_terrain_complexity,
    segment.extenuating_factors,
    segment.burial_or_cover,
  ]);
  return 'rpt-' + hash64(fp);
}

/* ================================================================
   Build structured report data for one segment
   ================================================================ */

export function buildSegmentReportData(state, segment, generatedAt) {
  const s = state.searchLevel;
  const r = segment.result || {};
  const searchType = s.search_for;
  const isMissing = searchType === 'missing_person';

  const impacts = computeCoefficientImpacts(r, isMissing);

  return {
    generated_at: generatedAt,
    search: {
      your_name: state.session.your_name || '\u2014',
      search_name: state.session.search_name || '\u2014',
      team_name: state.session.team_name || '\u2014',
      search_for: SEARCH_FOR[s.search_for] || s.search_for,
      visibility: VISIBILITY[s.visibility] || s.visibility || 'Medium',
      auditory: isMissing ? (AUDITORY[s.auditory] || s.auditory) : null,
      visual: isMissing ? (VISUAL[s.visual] || s.visual) : null,
    },
    segment: {
      name: segment.name || 'Unnamed',
      num_searchers: segment.num_searchers || 1,
      actual_spacing_m: segment.actual_spacing_m,
      time_of_day: TIME_OF_DAY[segment.time_of_day] || segment.time_of_day,
      weather: WEATHER[segment.weather] || segment.weather,
      vegetation_density: VEG[String(segment.vegetation_density)] || String(segment.vegetation_density),
      micro_terrain_complexity: TERRAIN[String(segment.micro_terrain_complexity)] || String(segment.micro_terrain_complexity),
      extenuating_factors: isMissing ? (EXT[String(segment.extenuating_factors)] || String(segment.extenuating_factors)) : null,
      burial_or_cover: !isMissing ? (BURIAL[String(segment.burial_or_cover)] || String(segment.burial_or_cover)) : null,
      notes: segment.notes || {},
      base_sweep_width_m: r.base_sweep_width_m ?? null,
      effective_sweep_width_m: r.W_eff ?? null,
      coverage_factor: r.coverage_factor ?? null,
      final_pod: r.POD ?? null,
      final_pod_pct: r.POD != null ? `${(r.POD * 100).toFixed(0)}%` : '\u2014',
      qa_warnings: segment.qaWarnings || [],
      coefficient_impacts: impacts,
    },
  };
}

/* ================================================================
   Coefficient impact calculation

   For each factor, computes what POD would be if that factor were
   neutral (1.0), then reports the difference in percentage points.
   ================================================================ */

function computeCoefficientImpacts(r, isMissing) {
  if (!r || r.actual_spacing_m <= 0) return [];

  const factors = [
    { name: 'Visibility', value: r.K_visibility },
    { name: 'Time of Day', value: r.K_time },
    { name: 'Weather', value: r.K_weather },
    { name: 'Vegetation Density', value: r.K_veg },
    { name: 'Micro-terrain Complexity', value: r.K_terrain },
  ];

  if (isMissing) {
    factors.push({ name: 'Extenuating Factors', value: r.K_extenuating });
  } else {
    factors.push({ name: 'Burial / Cover', value: r.K_burial });
  }

  if (r.M_resp != null && r.M_resp !== 1) {
    factors.push({ name: 'Subject Response', value: r.M_resp, isResponse: true });
  }

  const actualPOD = r.POD;
  const spacing = r.actual_spacing_m;
  const base = r.base_sweep_width_m;
  const bMin = r.w_eff_min;
  const bMax = r.w_eff_max;

  return factors.map((f) => {
    let C_t_adj, M_resp_adj;
    if (f.isResponse) {
      C_t_adj = r.C_t;
      M_resp_adj = 1;
    } else {
      C_t_adj = f.value !== 0 ? r.C_t / f.value : r.C_t;
      M_resp_adj = r.M_resp;
    }
    const W_eff_adj = clamp(base * C_t_adj * M_resp_adj, bMin, bMax);
    const cf_adj = W_eff_adj / spacing;
    const pod_adj = Math.min(1 - Math.exp(-cf_adj), 0.99);
    const impact = (actualPOD - pod_adj) * 100;

    return {
      name: f.name,
      value: Math.round(f.value * 10000) / 10000,
      impact_percent: Math.round(impact * 10) / 10,
    };
  });
}

/* ================================================================
   Plain-text report for one segment
   ================================================================ */

export function segmentReportText(d) {
  const lines = [
    'SAR POD Calculator \u2014 Segment Report',
    `Generated: ${d.generated_at}`,
    '',
    'Search Information',
    `  Your Name: ${d.search.your_name}`,
    `  Search Name: ${d.search.search_name}`,
    `  Team Name: ${d.search.team_name}`,
    `  Search For: ${d.search.search_for}`,
  ];

  const visImpact = findImpact(d.segment.coefficient_impacts, 'Visibility');
  lines.push(`  Visibility: ${d.search.visibility}${fmtImpact(visImpact)}`);

  if (d.search.auditory != null) {
    lines.push(`  Auditory Responsiveness: ${d.search.auditory}`);
  }
  if (d.search.visual != null) {
    lines.push(`  Visual Responsiveness: ${d.search.visual}`);
  }

  const respImpact = findImpact(d.segment.coefficient_impacts, 'Subject Response');
  if (respImpact) {
    lines.push(`  Subject Response${fmtImpact(respImpact)}`);
  }

  lines.push('');
  lines.push(`Segment: ${d.segment.name}`);
  lines.push(`  Searchers: ${d.segment.num_searchers}`);
  lines.push(`  Actual Spacing: ${d.segment.actual_spacing_m} m`);

  const segFactors = [
    ['Time of Day', d.segment.time_of_day],
    ['Weather', d.segment.weather],
    ['Vegetation Density', d.segment.vegetation_density],
    ['Micro-terrain Complexity', d.segment.micro_terrain_complexity],
  ];
  if (d.segment.extenuating_factors != null) {
    segFactors.push(['Extenuating Factors', d.segment.extenuating_factors]);
  }
  if (d.segment.burial_or_cover != null) {
    segFactors.push(['Burial / Cover', d.segment.burial_or_cover]);
  }

  for (const [label, value] of segFactors) {
    const imp = findImpact(d.segment.coefficient_impacts, label);
    lines.push(`  ${label}: ${value}${fmtImpact(imp)}`);
  }

  const noteFields = [
    ['vegetation_density', 'Vegetation Density'],
    ['micro_terrain_complexity', 'Micro-terrain Complexity'],
  ];
  if (d.segment.extenuating_factors != null) noteFields.push(['extenuating_factors', 'Extenuating Factors']);
  if (d.segment.burial_or_cover != null) noteFields.push(['burial_or_cover', 'Burial / Cover']);
  for (const [key, label] of noteFields) {
    const note = d.segment.notes[key];
    if (note && note.trim()) lines.push(`    ${label} Note: ${note.trim()}`);
  }

  lines.push('');
  if (d.segment.effective_sweep_width_m != null) {
    lines.push(`  Effective Sweep Width: ${fmtNum(d.segment.effective_sweep_width_m)} m`);
  }
  if (d.segment.coverage_factor != null) {
    lines.push(`  Coverage Factor: ${Number(d.segment.coverage_factor).toFixed(2)}`);
  }
  lines.push('');
  lines.push(`POD: ${d.segment.final_pod_pct}`);

  return lines.join('\n');
}

/* ================================================================
   Upload payload for one segment

   Includes report_id and segment_key for dedup/identity:
   - Same segment_key + same report_id  → duplicate re-upload
   - Same segment_key + different report_id → new report for same segment
   ================================================================ */

export function segmentUploadPayload(d, reportText, searchLevel, segment) {
  const sKey = segmentKey(d.segment.name);
  const rId = reportId(searchLevel, segment);

  return {
    report_id: rId,
    segment_key: sKey,
    generated_at: d.generated_at,
    search: {
      your_name: d.search.your_name,
      search_name: d.search.search_name,
      team_name: d.search.team_name,
      search_for: d.search.search_for,
      search_inputs: {
        visibility: d.search.visibility,
        ...(d.search.auditory != null ? { auditory_responsiveness: d.search.auditory } : {}),
        ...(d.search.visual != null ? { visual_responsiveness: d.search.visual } : {}),
      },
    },
    segment: {
      segment_name: d.segment.name,
      segment_inputs: {
        num_searchers: d.segment.num_searchers,
        actual_spacing_m: d.segment.actual_spacing_m,
        time_of_day: d.segment.time_of_day,
        weather: d.segment.weather,
        vegetation_density: d.segment.vegetation_density,
        micro_terrain_complexity: d.segment.micro_terrain_complexity,
        ...(d.segment.extenuating_factors != null ? { extenuating_factors: d.segment.extenuating_factors } : {}),
        ...(d.segment.burial_or_cover != null ? { burial_or_cover: d.segment.burial_or_cover } : {}),
      },
      effective_sweep_width_m: d.segment.effective_sweep_width_m,
      coverage_factor: d.segment.coverage_factor,
      coefficient_impacts: d.segment.coefficient_impacts,
      final_pod: d.segment.final_pod,
    },
    report_text: reportText,
  };
}

/* ---- Helpers ---- */

function findImpact(impacts, name) {
  return (impacts || []).find((i) => i.name === name) || null;
}

function fmtImpact(imp) {
  if (!imp || imp.impact_percent === 0) return '';
  const sign = imp.impact_percent > 0 ? '+' : '';
  return ` (${sign}${imp.impact_percent.toFixed(1)}% POD)`;
}

function fmtNum(v) {
  const num = Number(v || 0);
  return num >= 1000 ? num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : num.toFixed(1);
}

/* ---- Deterministic 64-bit hash (dual djb2) ---- */

function hash64(str) {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) & 0xffffffff;
    h2 = ((h2 << 5) + h2 + c) & 0xffffffff;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') +
         (h2 >>> 0).toString(16).padStart(8, '0');
}
