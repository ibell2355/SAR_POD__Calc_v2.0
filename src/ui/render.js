import { durationMinutes } from '../utils/math.js';

export const LABELS = {
  time_of_day: { day: 'Day', dusk_dawn: 'Dusk/Dawn', night: 'Night' },
  weather: { clear: 'Clear', rain: 'Rain', snow: 'Snow' },
  detectability_level: { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5' },
  type_of_search: {
    active_missing_person: 'Active Missing Person',
    evidence_historical: 'Evidence/Historical'
  },
  active_targets: { adult: 'Adult', child: 'Child', large_clues: 'Large Clues', small_clues: 'Small Clues' },
  responsiveness: { none: 'None', possible: 'Possible', likely: 'Likely' },
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
      ${textField('Your name', 'your_name', state.session.your_name)}
      ${textField('Search name', 'search_name', state.session.search_name, 'Do not include case numbers or subjects\u2019 names')}
      ${textField('Team name', 'team_name', state.session.team_name)}
      ${searchSurvey(state.searchLevel)}
    </section>

    <section class="panel">
      <div class="row between align-center">
        <h2>Segments</h2>
        <button class="btn" data-action="add-segment">Add segment</button>
      </div>
      <div id="segment-list" class="segment-list">
        ${segmentListHtml(state.segments)}
      </div>
    </section>

    <section class="panel">
      <div class="action-grid">
        <button class="btn" data-action="share">Share</button>
        <button class="btn" data-action="view-report">View report</button>
        <button class="btn" data-action="copy-report">Copy report</button>
        <button class="btn btn-danger" data-action="new-session">New session (Clear)</button>
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
      ${textField('Segment name (required)', 'name', segment.name)}
      <div class="grid-2">
        ${numField('Critical spacing (meters)', 'critical_spacing_m', segment.critical_spacing_m, '0.1')}
        ${numField('Area coverage (%)', 'area_coverage_pct', segment.area_coverage_pct, '1')}
      </div>
      <div class="grid-2">
        ${timeField('Segment start time (24h HH:MM)', 'segment_start_time', segment.segment_start_time)}
        ${timeField('Segment end time (24h HH:MM)', 'segment_end_time', segment.segment_end_time)}
      </div>
      <p id="duration-display" class="subtle">${d === null ? 'Duration: Invalid time' : `Duration: ${d} min`}</p>

      <h3>Time of day</h3>
      ${radioChips('time_of_day', LABELS.time_of_day, segment.time_of_day)}
      <h3>Weather</h3>
      ${radioChips('weather', LABELS.weather, segment.weather)}
      <h3>Detectability level (1\u20135)</h3>
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

  let html = `<p class="pod-large">POD ${podPct}</p>`;

  if (primary) {
    html += `<p><strong>Primary target:</strong> ${esc(prettyTarget(primary))}</p>`;
  }

  if (results.length > 1) {
    html += '<div style="margin-top:6px">' +
      results.map((r) =>
        `<span style="margin-right:12px">${esc(prettyTarget(r.target))}: ${(r.POD_final * 100).toFixed(1)}%</span>`
      ).join('') + '</div>';
  }

  if (!results.length) {
    html += '<p class="subtle">Select targets on the landing page.</p>';
  }

  if (primaryResult) {
    html += `
      <details style="margin-top:8px">
        <summary>Calculation details</summary>
        <dl class="pod-detail-list">
          <dt>S_base</dt><dd>${n(primaryResult.S_base)}</dd>
          <dt>C_t (condition)</dt><dd>${n(primaryResult.C_t)}</dd>
          <dt>S_ref</dt><dd>${n(primaryResult.S_ref)} m</dd>
          <dt>E_space</dt><dd>${n(primaryResult.E_space)}</dd>
          <dt>M_resp</dt><dd>${n(primaryResult.M_resp)}</dd>
          <dt>M_comp</dt><dd>${n(primaryResult.M_comp)}</dd>
          <dt>POD_pre</dt><dd>${n(primaryResult.POD_pre)}</dd>
          <dt>POD_final</dt><dd>${n(primaryResult.POD_final)}</dd>
        </dl>
      </details>`;
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
          <li><strong>Your name:</strong> ${esc(state.session.your_name || '\u2014')}</li>
          <li><strong>Search name:</strong> ${esc(state.session.search_name || '\u2014')}</li>
          <li><strong>Team name:</strong> ${esc(state.session.team_name || '\u2014')}</li>
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
    `Your name: ${state.session.your_name || '\u2014'}`,
    `Search name: ${state.session.search_name || '\u2014'}`,
    `Team name: ${state.session.team_name || '\u2014'}`,
    ''
  ];

  state.segments.forEach((seg, i) => {
    lines.push(`--- Segment ${i + 1}: ${seg.name || 'Unnamed'} ---`);

    const inputs = [
      `Critical spacing: ${seg.critical_spacing_m} m`,
      `Area coverage: ${seg.area_coverage_pct}%`,
      `Time: ${seg.segment_start_time}\u2013${seg.segment_end_time}`,
      `Time of day: ${LABELS.time_of_day[seg.time_of_day] || seg.time_of_day}`,
      `Weather: ${LABELS.weather[seg.weather] || seg.weather}`,
      `Detectability: ${seg.detectability_level}`
    ];
    lines.push(`Inputs: ${inputs.join(' | ')}`);

    (seg.results || []).forEach((r) => {
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
  return `
    <div class="survey-group" id="search-survey" data-search-type="${s.type_of_search}">
      <h3>Type of Search</h3>
      ${radioChips('type_of_search', LABELS.type_of_search, s.type_of_search)}

      <div class="active-only">
        <h3>Searching For</h3>
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

      <div class="evidence-only">
        <h3>Searching For</h3>
        <p class="subtle" style="margin:0 0 4px"><strong>Remains state</strong></p>
        ${radioChips('remains_state', LABELS.remains_state, s.remains_state)}
        <p class="subtle" style="margin:6px 0 4px"><strong>Evidence classes</strong></p>
        ${checkboxChips('evidence_classes', LABELS.evidence_classes, s.evidence_classes)}
      </div>
    </div>`;
}

function configNotice(valid, error) {
  if (valid) return '';
  return `<p class="config-error">${esc(error || 'Configuration could not be loaded. Using safe defaults.')}</p>`;
}

function reportSegmentHtml(segment, index) {
  const results = segment.results || [];
  const inputs = [
    `Critical spacing: ${segment.critical_spacing_m} m`,
    `Area coverage: ${segment.area_coverage_pct}%`,
    `Time: ${segment.segment_start_time}\u2013${segment.segment_end_time}`,
    `Time of day: ${LABELS.time_of_day[segment.time_of_day] || segment.time_of_day}`,
    `Weather: ${LABELS.weather[segment.weather] || segment.weather}`,
    `Detectability: ${segment.detectability_level}`
  ];

  return `
    <div class="report-segment">
      <h3>Segment ${index}: ${esc(segment.name || 'Unnamed')}</h3>
      ${results.length
        ? `<p>${results.map((r) => `<strong>${esc(prettyTarget(r.target))}:</strong> ${(r.POD_final * 100).toFixed(1)}%`).join(' &middot; ')}</p>`
        : '<p class="subtle">No targets selected.</p>'}
      <h4>Inputs</h4>
      <ul>${inputs.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
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
  return `<label>${esc(label)}<input name="${name}" value="${esc(value || '')}"/>${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
}

function numField(label, name, value, step) {
  return `<label>${esc(label)}<input type="number" step="${step}" name="${name}" value="${esc(value ?? '')}"/></label>`;
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
