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
  responsiveness: { none: 'Not Expected', possible: 'Possible', likely: 'Likely' },
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
        </div>
        <span class="pod-badge">${pod}</span>
      </button>`;
  }).join('');
}

/* ================================================================
   Segment edit page
   ================================================================ */

export function renderSegment(root, segment, computed, savedLabel, configValid, configError) {
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

      <h3>Time of Day</h3>
      ${radioChips('time_of_day', LABELS.time_of_day, segment.time_of_day)}
      <h3>Weather</h3>
      ${radioChips('weather', LABELS.weather, segment.weather)}
      <h3>Vegetation / Terrain / Detectability</h3>
      <span class="hint">Consider all factors that would make your primary subject more difficult to spot. For example, evidence buried under duff layer, snow cover, hiding places, hard-to-spot natural shelters, dense vegetation, etc.</span>
      ${radioChips('detectability_level', LABELS.detectability_level, String(segment.detectability_level), true)}
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

  // QA warnings
  const warnings = computed.qaWarnings || [];
  if (warnings.length) {
    html += '<div style="margin-top:8px;font-size:0.85rem;color:var(--danger)">';
    warnings.forEach((w) => { html += `<p style="margin:2px 0">\u26a0 ${esc(w)}</p>`; });
    html += '</div>';
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

        <h3>Search Information</h3>
        <ul class="report-list">
          <li><strong>Your Name:</strong> ${esc(state.session.your_name || '\u2014')}</li>
          <li><strong>Search Name:</strong> ${esc(state.session.search_name || '\u2014')}</li>
          <li><strong>Team Name:</strong> ${esc(state.session.team_name || '\u2014')}</li>
          ${searchInfoItems(state.searchLevel)}
        </ul>

        <h3>Search Areas</h3>
        ${(state.segments || []).length
          ? (state.segments || []).map((seg) => reportSegmentHtml(seg)).join('')
          : '<p class="subtle">No segments added.</p>'}
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
    'Search Information',
    `Your Name: ${state.session.your_name || '\u2014'}`,
    `Search Name: ${state.session.search_name || '\u2014'}`,
    `Team Name: ${state.session.team_name || '\u2014'}`,
    ...searchInfoText(state.searchLevel),
    '',
    'Search Areas',
    ''
  ];

  state.segments.forEach((seg) => {
    lines.push(`--- ${seg.name || 'Unnamed'} ---`);

    const inputs = [
      `Critical Spacing: ${seg.critical_spacing_m} m`,
      `Area Coverage: ${seg.area_coverage_pct}%`,
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

/* ---- Report helpers ---- */

function searchInfoItems(s) {
  const items = [];
  items.push(`<li><strong>Search Type:</strong> ${esc(LABELS.type_of_search[s.type_of_search] || s.type_of_search)}</li>`);

  if (s.type_of_search === 'active_missing_person') {
    const targets = (s.active_targets || []).map((t) => LABELS.active_targets[t] || t).join(', ');
    items.push(`<li><strong>Searching For:</strong> ${esc(targets)}</li>`);
    items.push(`<li><strong>Auditory Responsiveness:</strong> ${esc(LABELS.responsiveness[s.auditory] || s.auditory)}</li>`);
    items.push(`<li><strong>Visual Responsiveness:</strong> ${esc(LABELS.responsiveness[s.visual] || s.visual)}</li>`);
  } else {
    const cats = (s.evidence_categories || []).map((c) => LABELS.evidence_categories[c] || c).join(', ');
    items.push(`<li><strong>Categories:</strong> ${esc(cats)}</li>`);
    if ((s.evidence_categories || []).includes('remains')) {
      items.push(`<li><strong>Remains State:</strong> ${esc(LABELS.remains_state[s.remains_state] || s.remains_state)}</li>`);
    }
    if ((s.evidence_categories || []).includes('evidence')) {
      const classes = (s.evidence_classes || []).map((c) => LABELS.evidence_classes[c] || c).join(', ');
      items.push(`<li><strong>Evidence Classes:</strong> ${esc(classes)}</li>`);
    }
  }
  return items.join('\n          ');
}

function searchInfoText(s) {
  const lines = [];
  lines.push(`Search Type: ${LABELS.type_of_search[s.type_of_search] || s.type_of_search}`);

  if (s.type_of_search === 'active_missing_person') {
    const targets = (s.active_targets || []).map((t) => LABELS.active_targets[t] || t).join(', ');
    lines.push(`Searching For: ${targets}`);
    lines.push(`Auditory Responsiveness: ${LABELS.responsiveness[s.auditory] || s.auditory}`);
    lines.push(`Visual Responsiveness: ${LABELS.responsiveness[s.visual] || s.visual}`);
  } else {
    const cats = (s.evidence_categories || []).map((c) => LABELS.evidence_categories[c] || c).join(', ');
    lines.push(`Categories: ${cats}`);
    if ((s.evidence_categories || []).includes('remains')) {
      lines.push(`Remains State: ${LABELS.remains_state[s.remains_state] || s.remains_state}`);
    }
    if ((s.evidence_categories || []).includes('evidence')) {
      const classes = (s.evidence_classes || []).map((c) => LABELS.evidence_classes[c] || c).join(', ');
      lines.push(`Evidence Classes: ${classes}`);
    }
  }
  return lines;
}

function reportSegmentHtml(segment) {
  const results = segment.results || [];
  const primaryResult = results.find((r) => r.target === segment.primaryTarget);
  const inputs = [
    `Critical Spacing: ${segment.critical_spacing_m} m`,
    `Area Coverage: ${segment.area_coverage_pct}%`,
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
      <h3>${esc(segment.name || 'Unnamed')}</h3>
      <p class="pod-large" style="font-size:1.4rem">Primary POD: ${primaryPod}</p>
      <p class="report-avg-pod">Average POD: ${avgPod}</p>
      ${results.length
        ? `<p>${results.map((r) => `<strong>${esc(prettyTarget(r.target))}:</strong> ${(r.POD_final * 100).toFixed(1)}%`).join(' &middot; ')}</p>`
        : '<p class="subtle">No targets selected.</p>'}
      <h4 style="margin-bottom:2px">Inputs</h4>
      <ul class="report-list">${inputs.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
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
      <pre>Base values (per-target):
  base_detectability = ${n(r.base_detectability)}
  calibration_constant_k = ${n(r.calibration_constant_k)}
  base_reference_critical_spacing_m = ${n(r.base_reference_critical_spacing_m)}
  spacing_exponent = ${n(r.spacing_exponent)}
  min_effective_actual_spacing = ${n(r.min_effective)}

1. Condition multiplier (per-target):
  F_time = ${n(r.F_time)},  F_weather = ${n(r.F_weather)},  F_detectability = ${n(r.F_detectability)}
  condition_multiplier = F_time \u00d7 F_weather \u00d7 F_detectability = ${n(r.C_t)}

2. Base hazard rate:
  base_hazard_rate = \u2212ln(1 \u2212 base_detectability)
                   = \u2212ln(1 \u2212 ${n(r.base_detectability)}) = ${n(r.base_hazard_rate)}

3. Reference critical spacing:
  S_ref = base_reference_critical_spacing_m \u00d7 condition_multiplier
        = ${n(r.base_reference_critical_spacing_m)} \u00d7 ${n(r.C_t)} = ${n(r.S_ref)}

4. Effective actual critical spacing:
  S_eff_act = max(actual_spacing, min_effective)
            = max(${n(segment.critical_spacing_m)}, ${n(r.min_effective)}) = ${n(r.S_eff_act)}

5. Spacing ratio:
  spacing_ratio = (S_ref / S_eff_act) ^ spacing_exponent
                = (${n(r.S_ref)} / ${n(r.S_eff_act)}) ^ ${n(r.spacing_exponent)}
                = ${n(r.spacing_ratio)}

6. Response multiplier:
  auditory_bonus = ${n(aud)},  visual_bonus = ${n(vis)},  cap = ${n(r.response_cap)}
  M_resp = min(cap, 1 + aud + vis) = ${n(r.M_resp)}

7. Completion multiplier:
  M_comp = clamp(area_coverage_pct / 100, 0, 1)
         = clamp(${n(segment.area_coverage_pct)} / 100, 0, 1)
         = ${n(r.M_comp)}

8. Probability of detection (exponential model):
  exponent = k \u00d7 base_hazard_rate \u00d7 spacing_ratio \u00d7 M_resp
           = ${n(r.calibration_constant_k)} \u00d7 ${n(r.base_hazard_rate)} \u00d7 ${n(r.spacing_ratio)} \u00d7 ${n(r.M_resp)}
  POD_raw  = 1 \u2212 exp(\u2212exponent) = ${n(r.POD_raw)}
  POD_final = clamp(POD_raw \u00d7 M_comp, 0, 0.99)
            = clamp(${n(r.POD_raw)} \u00d7 ${n(r.M_comp)}, 0, 0.99)
            = ${n(r.POD_final)}</pre>
    </details>`;
}

function reportDetailText(segment, r) {
  return [
    `    C_t=${n(r.C_t)}  hazard=${n(r.base_hazard_rate)}  S_ref=${n(r.S_ref)}  S_eff_act=${n(r.S_eff_act)}`,
    `    spacing_ratio=${n(r.spacing_ratio)}  M_resp=${n(r.M_resp)}  M_comp=${n(r.M_comp)}`,
    `    POD_raw=${n(r.POD_raw)}  POD_final=${n(r.POD_final)}`
  ].join('\n');
}

/* ---- Form field generators ---- */

function radioChips(name, options, current, vertical = false) {
  const cls = vertical ? 'chip-col' : 'chip-row';
  return `<div class="${cls}">${Object.entries(options).map(([val, label]) =>
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
