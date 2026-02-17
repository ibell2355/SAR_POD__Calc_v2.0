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

export function renderLandingPage(el, app) {
  const savedLabel = app.savedState;
  el.innerHTML = `
    ${header(app)}
    <main class="page-wrap">
      ${startupNotice(app)}
      <section class="card">
        <div class="card-title-row"><h2>Session</h2><span class="small saved-pill">${savedLabel}</span></div>
        <div class="grid-3">
          ${textField('Your name', 'your_name', app.session.your_name)}
          ${textField('Search name', 'search_name', app.session.search_name, 'Do not include case numbers or subjects’ names')}
          ${textField('Team name', 'team_name', app.session.team_name)}
        </div>
        ${searchSurvey(app.searchLevel)}
      </section>

      <section class="card">
        <div class="card-title-row"><h2>Segments</h2><button data-action="add-segment" class="btn-secondary">Add segment</button></div>
        <div class="segment-list">
          ${app.segments.length ? app.segments.map((segment, idx) => `
            <button class="segment-row" data-action="edit-segment" data-id="${segment.id}">
              <strong>${segment.name || `Segment ${idx + 1}`}</strong>
              <span class="small">${segment.segment_start_time}–${segment.segment_end_time} · POD targets: ${(segment.results || []).length}</span>
            </button>`).join('') : '<p class="small">No segments yet. Add segment to begin.</p>'}
        </div>
      </section>

      <section class="action-row card">
        <button data-action="share">Share</button>
        <button data-action="view-report">View report</button>
        <button data-action="copy-report">Copy report</button>
        <button data-action="new-session" class="btn-danger">New session (Clear)</button>
      </section>
    </main>
  `;
}

export function renderSegmentPage(el, app, segment, computed) {
  const d = durationMinutes(segment.segment_start_time, segment.segment_end_time);
  el.innerHTML = `
    ${header(app)}
    <main class="page-wrap slim">
      ${startupNotice(app)}
      <section class="card">
        <div class="card-title-row">
          <button data-action="go-home" class="btn-link">← Back</button>
          <h2>Edit Segment</h2>
          <span class="small saved-pill">${app.savedState}</span>
        </div>

        ${textField('Segment name (required)', 'name', segment.name || '')}
        <div class="grid-2">
          ${inputField('Critical spacing (meters)', 'critical_spacing_m', segment.critical_spacing_m, 'number', '0.1')}
          ${inputField('Area coverage (%)', 'area_coverage_pct', segment.area_coverage_pct, 'number', '1')}
          ${inputField('Segment start time (24h HH:MM)', 'segment_start_time', segment.segment_start_time, 'time')}
          ${inputField('Segment end time (24h HH:MM)', 'segment_end_time', segment.segment_end_time, 'time')}
        </div>
        <p class="small">Duration: ${d === null ? 'Invalid time' : `${d} min`}</p>

        <h3>Time of day</h3>
        ${radioChips('time_of_day', LABELS.time_of_day, segment.time_of_day)}
        <h3>Weather</h3>
        ${radioChips('weather', LABELS.weather, segment.weather)}
        <h3>Vegetation/Terrain/Detectability level (1-5)</h3>
        ${radioChips('detectability_level', LABELS.detectability_level, String(segment.detectability_level))}
      </section>

      <section class="card">
        <h3>Live POD</h3>
        <p><strong>Inferred primary target:</strong> ${computed.primaryTarget || '—'}</p>
        ${(computed.results || []).map((r) => `<div class="result-item"><strong>${prettyTarget(r.target)}</strong>: ${(r.POD_final * 100).toFixed(1)}%</div>`).join('') || '<p class="small">Select targets on the landing page.</p>'}
        <details>
          <summary>Details</summary>
          <pre>${JSON.stringify(computed.results || [], null, 2)}</pre>
        </details>
      </section>
    </main>
  `;
}

export function renderReportPage(el, app, generatedAt) {
  el.innerHTML = `
    <main class="page-wrap report">
      ${startupNotice(app)}
      <section class="card">
        <div class="card-title-row">
          <button data-action="go-home" class="btn-link">← Back</button>
          <button data-action="print">Print</button>
        </div>
        <h1>PSAR POD Calculator</h1>
        <p class="small">Parallel Sweep (V1) · v${app.version}</p>
        <p class="small">Generated: ${generatedAt}</p>

        <h3>Session Summary</h3>
        <ul>
          <li>Your name: ${escapeHtml(app.session.your_name || '—')}</li>
          <li>Search name: ${escapeHtml(app.session.search_name || '—')}</li>
          <li>Team name: ${escapeHtml(app.session.team_name || '—')}</li>
        </ul>

        ${(app.segments || []).map((segment, idx) => reportSegment(segment, idx + 1, app.searchLevel)).join('')}
      </section>
    </main>
  `;
}

export function buildReportText(app, generatedAt) {
  const lines = [
    'PSAR POD Calculator',
    `Parallel Sweep (V1) · v${app.version}`,
    `Generated: ${generatedAt}`,
    '',
    `Your name: ${app.session.your_name || '—'}`,
    `Search name: ${app.session.search_name || '—'}`,
    `Team name: ${app.session.team_name || '—'}`,
    ''
  ];
  app.segments.forEach((segment, idx) => {
    lines.push(`Segment ${idx + 1}: ${segment.name || 'Unnamed segment'}`);
    (segment.results || []).forEach((r) => lines.push(`- ${r.target}: ${(r.POD_final * 100).toFixed(1)}%`));
    lines.push('');
  });
  return lines.join('\n');
}

function reportSegment(segment, index, searchLevel) {
  const inputs = [
    `Critical spacing: ${segment.critical_spacing_m} m`,
    `Area coverage: ${segment.area_coverage_pct}%`,
    `Start/End: ${segment.segment_start_time} / ${segment.segment_end_time}`,
    `Time of day: ${LABELS.time_of_day[segment.time_of_day] || segment.time_of_day}`,
    `Weather: ${LABELS.weather[segment.weather] || segment.weather}`,
    `Detectability: ${segment.detectability_level}`
  ];

  return `
    <article class="report-segment">
      <h3>Segment ${index}: ${escapeHtml(segment.name || 'Unnamed segment')}</h3>
      <p>${(segment.results || []).map((r) => `${prettyTarget(r.target)} ${(r.POD_final * 100).toFixed(1)}%`).join(' · ') || 'No selected targets.'}</p>
      <p class="small">Inputs used: ${inputs.join(' · ')}</p>
      ${(segment.results || []).map((r) => reportDetails(searchLevel, segment, r)).join('')}
    </article>
  `;
}

function reportDetails(searchLevel, segment, r) {
  const auditory = r.auditory_bonus ?? 0;
  const visual = r.visual_bonus ?? 0;
  return `
    <details>
      <summary>${prettyTarget(r.target)} detailed calculation</summary>
      <pre>
Base values:
POD_ceiling=${n(r.POD_ceiling)}, S_base=${n(r.S_base)}, k=${n(r.k)}
Condition multipliers:
F_time=${n(r.F_time)}, F_weather=${n(r.F_weather)}, F_detectability=${n(r.F_detectability)}, C_t=${n(r.C_t)}
Reference spacing:
S_ref_raw = S_base × C_t = ${n(r.S_base)} × ${n(r.C_t)} = ${n(r.S_ref_raw)}
S_ref_clamped = clamp(S_ref_raw, min_ref=${n(r.min_ref)}, max_ref=${n(r.max_ref)}) = ${n(r.S_ref)}
Spacing effectiveness:
E_space = min(1, (S_ref / critical_spacing)^k) = min(1, (${n(r.S_ref)} / ${n(segment.critical_spacing_m)})^${n(r.k)}) = ${n(r.E_space)}
Response multiplier:
auditory bonus=${n(auditory)}, visual bonus=${n(visual)}, cap=${n(r.response_cap)}, final M_resp=${n(r.M_resp)}
Completion multiplier:
M_comp = clamp(area_coverage_pct / 100, 0, 1) = clamp(${n(segment.area_coverage_pct)} / 100, 0, 1) = ${n(r.M_comp)}
Final:
POD_pre = POD_ceiling × E_space × M_resp = ${n(r.POD_ceiling)} × ${n(r.E_space)} × ${n(r.M_resp)} = ${n(r.POD_pre)}
POD_final = clamp(POD_pre × M_comp, 0, 0.99) = clamp(${n(r.POD_pre)} × ${n(r.M_comp)}, 0, 0.99) = ${n(r.POD_final)}
      </pre>
    </details>
  `;
}

function searchSurvey(s) {
  return `
    <div class="survey-group">
      <h3>Type of Search</h3>
      ${radioChips('type_of_search', LABELS.type_of_search, s.type_of_search)}

      <h3>Active Missing Person → Searching For</h3>
      ${checkboxChips('active_targets', LABELS.active_targets, s.active_targets)}

      <h3>Active Missing Person → Subject Responsiveness</h3>
      <div class="grid-2">
        <div><div class="small">Auditory</div>${radioChips('auditory', LABELS.responsiveness, s.auditory)}</div>
        <div><div class="small">Visual</div>${radioChips('visual', LABELS.responsiveness, s.visual)}</div>
      </div>

      <h3>Evidence/Historical → Searching For</h3>
      <div class="small">Remains state</div>
      ${radioChips('remains_state', LABELS.remains_state, s.remains_state)}
      <div class="small">Evidence classes</div>
      ${checkboxChips('evidence_classes', LABELS.evidence_classes, s.evidence_classes)}
    </div>
  `;
}

function header(app) {
  return `
    <header class="topbar">
      <div class="brand">
        <img src="./assets/logo.png" alt="PSAR Logo" onerror="this.style.display='none'" />
        <div>
          <h1>PSAR POD Calculator</h1>
          <p>Parallel Sweep (V1) · v${app.version}</p>
        </div>
      </div>
      <span class="status-pill ${app.online ? 'online' : 'offline'}">${app.online ? 'Online' : 'Offline'} / Offline ready</span>
    </header>
  `;
}

function startupNotice(app) {
  const issues = app.configErrors || [];
  const hasConfigIssue = app.configValid === false;
  const versionNotice = app.newVersionAvailable ? '<div class="notice notice-info">New version available. Refreshing…</div>' : '';
  if (!hasConfigIssue) return versionNotice;

  const conciseMessage = app.diagnostics || 'Configuration failed to load. Emergency defaults are active.';
  return `
    <section class="notice notice-error" role="alert">
      <h2>Startup Configuration Warning</h2>
      <p>${escapeHtml(conciseMessage)}</p>
      <p class="small"><strong>Config path attempted:</strong> ${escapeHtml(app.configPath || './config/SAR_POD_V2_config.yaml')}</p>
      ${issues.length ? `<details><summary>Details</summary><pre>${escapeHtml(JSON.stringify(issues, null, 2))}</pre></details>` : ''}
      <p class="small">The app is running with safe defaults to avoid a blank screen. Validate your config to restore normal calculations.</p>
    </section>
    ${versionNotice}
  `;
}

function radioChips(name, options, current) {
  return `<div class="chip-row">${Object.entries(options).map(([value, label]) => `<label class="chip"><input type="radio" name="${name}" value="${value}" ${String(current) === String(value) ? 'checked' : ''}/><span>${label}</span></label>`).join('')}</div>`;
}
function checkboxChips(name, options, current = []) {
  return `<div class="chip-row">${Object.entries(options).map(([value, label]) => `<label class="chip"><input type="checkbox" name="${name}" value="${value}" ${(current || []).includes(value) ? 'checked' : ''}/><span>${label}</span></label>`).join('')}</div>`;
}
function textField(label, name, value, hint = '') {
  return `<label>${label}<input name="${name}" value="${escapeHtml(value || '')}" />${hint ? `<span class="small">${hint}</span>` : ''}</label>`;
}
function inputField(label, name, value, type, step = '') {
  return `<label>${label}<input type="${type}" ${step ? `step="${step}"` : ''} name="${name}" value="${value ?? ''}"/></label>`;
}

function prettyTarget(key) {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}
function n(value) { return Number(value ?? 0).toFixed(4); }
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
