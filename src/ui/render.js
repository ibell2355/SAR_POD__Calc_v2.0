import { durationMinutes } from '../utils/math.js';

export const LABELS = {
  time_of_day: { day: 'Day', dusk_dawn: 'Dusk/Dawn', night: 'Night' },
  weather: { clear: 'Clear', rain: 'Raining', snow: 'Snowing' },
  detectability_level: {
    '1': '1 - Low Concealment',
    '2': '2 - Low/Moderate Concealment',
    '3': '3 - Moderate Concealment',
    '4': '4 - Moderate/High Concealment',
    '5': '5 - High Concealment'
  },
  type_of_search: {
    active_missing_person: 'Active Missing Person',
    evidence_historical: 'Evidence/Historical'
  },
  active_targets: { adult: 'Adult', child: 'Child', large_clues: 'Large Clues', small_clues: 'Small Clues' },
  responsiveness: { none: 'None', possible: 'Possible', likely: 'Likely' },
  evidence_categories: { remains: 'Remains', evidence: 'Evidence' },
  remains_state: {
    intact_remains: 'Intact Remains',
    partially_skeletonized: 'Partially Skeletonized',
    skeletal_remains: 'Skeletal Remains'
  },
  evidence_classes: { large_evidence: 'Large Evidence', small_evidence: 'Small Evidence' }
};

/* ================================================================
   Landing page
   ================================================================ */

export function renderHome(root, state, savedLabel, configValid, configError) {
  root.innerHTML = `
    ${configNotice(configValid, configError)}

    <section class="panel">
      <div class="row between align-center">
        <h2>Session</h2>
        <span id="save-indicator" class="subtle">${esc(savedLabel)}</span>
      </div>
      ${textField('Your Name', 'your_name', state.session.your_name)}
      ${textField('Search Name', 'search_name', state.session.search_name, 'Do not include case numbers or subjects\u2019 names')}
      ${textField('Team Name', 'team_name', state.session.team_name)}
      ${searchSurvey(state.searchLevel)}
    </section>

    <section class="panel">
      <div class="row between align-center">
        <h2>Segments</h2>
        <button class="btn" data-action="add-segment">Add Segment</button>
      </div>
      <div id="segment-list" class="segment-list">
        ${segmentListHtml(state.segments)}
      </div>
    </section>

    <section class="panel">
      <div class="action-grid">
        <button class="btn" data-action="share">Share</button>
        <button class="btn" data-action="view-report">View Report</button>
        <button class="btn" data-action="copy-report">Copy Report</button>
        <button class="btn btn-danger" data-action="new-session">New Session (Clear)</button>
      </div>
      <p class="subtle" style="text-align:center;margin-top:8px">All data stays on your device. Nothing is sent to any server.</p>
    </section>
  `;
}

/* ================================================================
   Segment list (also used for partial updates)
   ================================================================ */

export function segmentListHtml(segments) {
  if (!segments.length) return '<p class="subtle">No segments yet. Add a segment to begin.</p>';
  return segments.map((seg, i) => {
    const primary = seg.primaryTarget;
    const result = (seg.results || []).find((r) => r.target === primary);
    const pod = result ? `${(result.POD_final * 100).toFixed(0)}%` : '\u2014';
    return `
      <button class="segment-card" data-action="edit-segment" data-id="${esc(seg.id)}">
        <div>
          <strong>${esc(seg.name || `Segment ${i + 1}`)}</strong>
          <div class="segment-meta">${esc(seg.segment_start_time)}\u2013${esc(seg.segment_end_time)}</div>
        </div>
        <span class="pod-badge">${pod}</span>
      </button>`;
  }).join('');
}

/* ================================================================
   Segment edit page
   ================================================================ */

export function renderSegment(root, segment, computed, savedLabel, configValid, configError) {
  const d = durationMinutes(segment.segment_start_time, segment.segment_end_time);
  root.innerHTML = `
    ${configNotice(configValid, configError)}

    <div class="row between align-center" style="margin-bottom:12px">
      <button class="btn" data-action="go-home">\u2190 Back</button>
      <span id="save-indicator" class="subtle">${esc(savedLabel)}</span>
    </div>

    <section class="panel">
      <h2>Edit Segment</h2>
      ${textField('Segment Name', 'name', segment.name)}
      <div class="grid-2">
        ${numField('Critical Spacing (m)', 'critical_spacing_m', segment.critical_spacing_m, '0.1', 'Distance between searchers')}
        ${numField('Area Coverage (%)', 'area_coverage_pct', segment.area_coverage_pct, '1', 'Account for incomplete segments or unsearchable area.')}
      </div>
      <div class="grid-2">
        ${timeField('Segment Start Time', 'segment_start_time', segment.segment_start_time)}
        ${timeField('Segment End Time', 'segment_end_time', segment.segment_end_time)}
      </div>
      <p id="duration-display" class="subtle">${d === null ? 'Duration: Invalid time' : `Duration: ${d} min`}</p>

      <h3>Time of Day</h3>
      ${radioChips('time_of_day', LABELS.time_of_day, segment.time_of_day)}
      <h3>Weather</h3>
      ${radioChips('weather', LABELS.weather, segment.weather)}
      <h3>Vegetation / Terrain / Detectability</h3>
      <span class="hint">Consider all factors that would make your primary subject more difficult to spot. For example, evidence buried in duff layer, snow cover, hiding places, natural shelters, or hard-to-spot natural shelters, dense vegetation, etc.</span>
      ${radioChips('detectability_level', LABELS.detectability_level, String(segment.detectability_level))}
    </section>

    <div class="sticky-result" id="pod-result">
      ${podResultHtml(segment, computed)}
    </div>
  `;
}

/* ================================================================
   POD result panel (also used for partial updates)
   ================================================================ */

export function podResultHtml(segment, computed) {
  const results = computed.results || [];
  const primary = computed.primaryTarget;
  const primaryResult = results.find((r) => r.target === primary);
  const podPct = primaryResult ? `${(primaryResult.POD_final * 100).toFixed(1)}%` : '\u2014';

  // Average POD = mean of all targets
  let avgPct = '\u2014';
  if (results.length > 0) {
    const avg = results.reduce((sum, r) => sum + r.POD_final, 0) / results.length;
    avgPct = `${(avg * 100).toFixed(1)}%`;
  }

  let html = `<p class="pod-large">Primary POD: ${podPct}</p>`;
  html += `<p class="pod-average">Average POD: ${avgPct}</p>`;

  if (results.length > 1) {
    html += '<div style="margin-top:6px">' +
      results.map((r) =>
        `<span style="margin-right:12px">${esc(prettyTarget(r.target))}: ${(r.POD_final * 100).toFixed(1)}%</span>`
      ).join('') + '</div>';
  }

  if (!results.length) {
    html += '<p class="subtle">Select targets on the landing page.</p>';
  }

  return html;
}

/* ================================================================
   Report page
   ================================================================ */

export function renderReport(root, state, version, generatedAt, configValid, configError) {
  root.innerHTML = `
    <div class="row between" style="margin-bottom:12px">
      <button class="btn" data-action="go-home">\u2190 Back</button>
      <button class="btn btn-primary" data-action="print">Print</button>
    </div>

    <section class="panel report-panel">
      <article>
        <h2>SAR POD Calculator \u2014 Report</h2>
        <p class="subtle">App version: ${esc(version)}</p>
        <p class="subtle">Generated: ${esc(generatedAt)}</p>

        <h3>Session</h3>
        <ul>
          <li><strong>Your Name:</strong> ${esc(state.session.your_name || '\u2014')}</li>
          <li><strong>Search Name:</strong> ${esc(state.session.search_name || '\u2014')}</li>
          <li><strong>Team Name:</strong> ${esc(state.session.team_name || '\u2014')}</li>
        </ul>

        ${(state.segments || []).map((seg, i) => reportSegmentHtml(seg, i + 1)).join('')}
      </article>
    </section>
  `;
}

/* ================================================================
   Plaintext report (share / copy)
   ================================================================ */

export function buildReportText(state, version, generatedAt) {
  const lines = [
    'SAR POD Calculator \u2014 Report',
    `App version: ${version}`,
    `Generated: ${generatedAt}`,
    '',
    `Your Name: ${state.session.your_name || '\u2014'}`,
    `Search Name: ${state.session.search_name || '\u2014'}`,
    `Team Name: ${state.session.team_name || '\u2014'}`,
    ''
  ];

  state.segments.forEach((seg, i) => {
    lines.push(`--- Segment ${i + 1}: ${seg.name || 'Unnamed'} ---`);

    const inputs = [
      `Critical Spacing: ${seg.critical_spacing_m} m`,
      `Area Coverage: ${seg.area_coverage_pct}%`,
      `Time: ${seg.segment_start_time}\u2013${seg.segment_end_time}`,
      `Time of Day: ${LABELS.time_of_day[seg.time_of_day] || seg.time_of_day}`,
      `Weather: ${LABELS.weather[seg.weather] || seg.weather}`,
      `Vegetation / Terrain / Detectability: ${seg.detectability_level}`
    ];
    lines.push(`Inputs: ${inputs.join(' | ')}`);

    // Primary POD
    const results = seg.results || [];
    const primaryResult = results.find((r) => r.target === seg.primaryTarget);
    if (primaryResult) {
      lines.push(`Primary POD: ${(primaryResult.POD_final * 100).toFixed(1)}%`);
    }

    // Average POD
    if (results.length > 0) {
      const avg = results.reduce((sum, r) => sum + r.POD_final, 0) / results.length;
      lines.push(`Average POD: ${(avg * 100).toFixed(1)}%`);
    }

    results.forEach((r) => {
      lines.push(`  ${prettyTarget(r.target)}: ${(r.POD_final * 100).toFixed(1)}%`);
      lines.push(reportDetailText(seg, r));
    });
    lines.push('');
  });

  return lines.join('\n');
}

/* ================================================================
   Internal helpers
   ================================================================ */

function searchSurvey(s) {
  const cats = s.evidence_categories || [];
  return `
    <div class="survey-group" id="search-survey" data-search-type="${s.type_of_search}">
      <h3>Type of Search</h3>
      ${radioChips('type_of_search', LABELS.type_of_search, s.type_of_search)}

      <div class="active-only">
        <h3>Searching For</h3>
        <span class="hint">Select all that apply</span>
        ${checkboxChips('active_targets', LABELS.active_targets, s.active_targets)}
        <h3>Subject Responsiveness</h3>
        <div class="grid-2">
          <div>
            <p class="subtle" style="margin:0 0 4px"><strong>Auditory</strong></p>
            ${radioChips('auditory', LABELS.responsiveness, s.auditory)}
          </div>
          <div>
            <p class="subtle" style="margin:0 0 4px"><strong>Visual</strong></p>
            ${radioChips('visual', LABELS.responsiveness, s.visual)}
          </div>
        </div>
      </div>

      <div class="evidence-only" id="evidence-cats" data-has-remains="${cats.includes('remains')}" data-has-evidence="${cats.includes('evidence')}">
        <h3>Searching For</h3>
        <span class="hint">Select all that apply</span>
        ${checkboxChips('evidence_categories', LABELS.evidence_categories, cats)}
        <div class="remains-options">
          <p class="subtle" style="margin:6px 0 4px"><strong>Remains State</strong></p>
          ${radioChips('remains_state', LABELS.remains_state, s.remains_state)}
        </div>
        <div class="evidence-options">
          <p class="subtle" style="margin:6px 0 4px"><strong>Evidence Classes</strong></p>
          ${checkboxChips('evidence_classes', LABELS.evidence_classes, s.evidence_classes)}
        </div>
      </div>
    </div>`;
}

function configNotice(valid, error) {
  if (valid) return '';
  return `<p class="config-error">${esc(error || 'Configuration could not be loaded. Using safe defaults.')}</p>`;
}

function reportSegmentHtml(segment, index) {
  const results = segment.results || [];
  const primaryResult = results.find((r) => r.target === segment.primaryTarget);
  const inputs = [
    `Critical Spacing: ${segment.critical_spacing_m} m`,
    `Area Coverage: ${segment.area_coverage_pct}%`,
    `Time: ${segment.segment_start_time}\u2013${segment.segment_end_time}`,
    `Time of Day: ${LABELS.time_of_day[segment.time_of_day] || segment.time_of_day}`,
    `Weather: ${LABELS.weather[segment.weather] || segment.weather}`,
    `Vegetation / Terrain / Detectability: ${segment.detectability_level}`
  ];

  // Primary POD
  const primaryPod = primaryResult ? `${(primaryResult.POD_final * 100).toFixed(1)}%` : '\u2014';

  // Average POD
  let avgPod = '\u2014';
  if (results.length > 0) {
    const avg = results.reduce((sum, r) => sum + r.POD_final, 0) / results.length;
    avgPod = `${(avg * 100).toFixed(1)}%`;
  }

  return `
    <div class="report-segment">
      <h3>Segment ${index}: ${esc(segment.name || 'Unnamed')}</h3>
      <p class="pod-large" style="font-size:1.4rem">Primary POD: ${primaryPod}</p>
      <p class="pod-average">Average POD: ${avgPod}</p>
      ${results.length
        ? `<p>${results.map((r) => `<strong>${esc(prettyTarget(r.target))}:</strong> ${(r.POD_final * 100).toFixed(1)}%`).join(' &middot; ')}</p>`
        : '<p class="subtle">No targets selected.</p>'}
      <h4>Inputs</h4>
      <ul>${inputs.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
      <p class="hint" style="margin-top:12px;font-style:italic">For development only</p>
      ${results.map((r) => reportDetailHtml(segment, r)).join('')}
    </div>`;
}

function reportDetailHtml(segment, r) {
  const aud = r.auditory_bonus ?? 0;
  const vis = r.visual_bonus ?? 0;
  return `
    <details class="report-detail">
      <summary>Detailed Calculation \u2014 ${esc(prettyTarget(r.target))}</summary>
      <pre>Base values:
  POD_ceiling = ${n(r.POD_ceiling)},  S_base = ${n(r.S_base)},  k = ${n(r.k)}

Condition multipliers:
  F_time = ${n(r.F_time)},  F_weather = ${n(r.F_weather)},  F_detectability = ${n(r.F_detectability)}
  C_t = F_time \u00d7 F_weather \u00d7 F_detectability = ${n(r.C_t)}

Reference spacing:
  S_ref_raw = S_base \u00d7 C_t = ${n(r.S_base)} \u00d7 ${n(r.C_t)} = ${n(r.S_ref_raw)}
  S_ref = clamp(${n(r.S_ref_raw)}, min=${n(r.min_ref)}, max=${n(r.max_ref)}) = ${n(r.S_ref)}

Spacing effectiveness:
  E_space = min(1, (S_ref / critical_spacing)^k)
          = min(1, (${n(r.S_ref)} / ${n(segment.critical_spacing_m)})^${n(r.k)})
          = ${n(r.E_space)}

Response multiplier:
  auditory_bonus = ${n(aud)},  visual_bonus = ${n(vis)},  cap = ${n(r.response_cap)}
  M_resp = min(cap, 1 + aud + vis) = ${n(r.M_resp)}

Completion multiplier:
  M_comp = clamp(area_coverage / 100, 0, 1)
         = clamp(${n(segment.area_coverage_pct)} / 100, 0, 1)
         = ${n(r.M_comp)}

Final:
  POD_pre  = POD_ceiling \u00d7 E_space \u00d7 M_resp
           = ${n(r.POD_ceiling)} \u00d7 ${n(r.E_space)} \u00d7 ${n(r.M_resp)}
           = ${n(r.POD_pre)}
  POD_final = clamp(POD_pre \u00d7 M_comp, 0, 0.99)
            = clamp(${n(r.POD_pre)} \u00d7 ${n(r.M_comp)}, 0, 0.99)
            = ${n(r.POD_final)}</pre>
    </details>`;
}

function reportDetailText(segment, r) {
  const aud = r.auditory_bonus ?? 0;
  const vis = r.visual_bonus ?? 0;
  return [
    `    C_t=${n(r.C_t)}  S_ref=${n(r.S_ref)}  E_space=${n(r.E_space)}`,
    `    M_resp=${n(r.M_resp)}  M_comp=${n(r.M_comp)}`,
    `    POD_pre=${n(r.POD_pre)}  POD_final=${n(r.POD_final)}`
  ].join('\n');
}

/* ---- Form field generators ---- */

function radioChips(name, options, current) {
  return `<div class="chip-row">${Object.entries(options).map(([val, label]) =>
    `<label class="chip"><input type="radio" name="${name}" value="${val}"${String(current) === String(val) ? ' checked' : ''}><span>${label}</span></label>`
  ).join('')}</div>`;
}

function checkboxChips(name, options, current = []) {
  return `<div class="chip-row">${Object.entries(options).map(([val, label]) =>
    `<label class="chip"><input type="checkbox" name="${name}" value="${val}"${(current || []).includes(val) ? ' checked' : ''}><span>${label}</span></label>`
  ).join('')}</div>`;
}

function textField(label, name, value, hint = '') {
  return `<label>${esc(label)}${hint ? `<span class="hint">${hint}</span>` : ''}<input name="${name}" value="${esc(value || '')}"/></label>`;
}

function numField(label, name, value, step, hint = '') {
  return `<label>${esc(label)}${hint ? `<span class="hint">${hint}</span>` : ''}<input type="number" step="${step}" name="${name}" value="${esc(value ?? '')}"/></label>`;
}

function timeField(label, name, value) {
  return `<label>${esc(label)}<input type="time" name="${name}" value="${esc(value || '')}"/></label>`;
}

/* ---- Formatting ---- */

function prettyTarget(key) {
  return (key || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function n(v) { return Number(v ?? 0).toFixed(4); }

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
