export const LABELS = {
  time_of_day: { day: 'Day', dusk_dawn: 'Dusk/Dawn', night: 'Night' },
  weather: { clear: 'Clear', rain: 'Raining', snow: 'Snowing' },
  type_of_search: {
    active_missing_person: 'Active Missing Person',
    evidence_historical: 'Evidence/Historical'
  },
  active_targets: { adult: 'Adult', child: 'Child', large_clues: 'Large Clues', small_clues: 'Small Clues' },
  auditory_responsiveness: { none: 'Not Expected', possible: 'Possible', likely: 'Likely' },
  visual_responsiveness: { evade: 'Expected to Evade', none: 'Not Expected', possible: 'Possible', likely: 'Likely' },
  subject_visibility: { low: 'Low', medium: 'Medium', high: 'High' },
  evidence_categories: { remains: 'Remains', evidence: 'Evidence' },
  remains_state: {
    intact_remains: 'Intact Remains',
    partially_skeletonized: 'Partially Skeletonized',
    skeletal_remains: 'Skeletal Remains'
  },
  evidence_classes: { large_evidence: 'Large Evidence', small_evidence: 'Small Evidence' }
};

const VEGETATION_DENSITY_LABELS = {
  '1': '1 - Low Vegetation',
  '2': '2 - Low/Moderate Vegetation',
  '3': '3 - Moderate Vegetation',
  '4': '4 - Moderate/High Vegetation',
  '5': '5 - High Vegetation'
};

const MICRO_TERRAIN_LABELS = {
  '1': '1 - Minimal Micro-terrain',
  '2': '2 - Minimal/Moderate Micro-terrain',
  '3': '3 - Moderate Micro-terrain',
  '4': '4 - Moderate/Extensive Micro-terrain',
  '5': '5 - Extensive Micro-terrain'
};

const EXTENUATING_FACTORS_LABELS = {
  '1': '1 - Strongly Favorable',
  '2': '2 - Somewhat Favorable',
  '3': '3 - Neutral',
  '4': '4 - Somewhat Adverse',
  '5': '5 - Strongly Adverse'
};

const BURIAL_OR_COVER_LABELS = {
  '1': '1 - Fully Exposed',
  '2': '2 - Light Cover',
  '3': '3 - Moderate Cover',
  '4': '4 - Heavy Cover',
  '5': '5 - Completely Buried'
};

/* ================================================================
   Landing page
   ================================================================ */

export function renderHome(root, state, savedLabel, configValid, configError, config) {
  root.innerHTML = `
    ${configNotice(configValid, configError)}

    <section class="panel">
      <div class="row between align-center">
        <h2>Search Details</h2>
        <span id="save-indicator" class="subtle">${esc(savedLabel)}</span>
      </div>
      ${textField('Your Name', 'your_name', state.session.your_name)}
      ${textField('Search Name', 'search_name', state.session.search_name, 'Do not include case numbers or subjects\u2019 names')}
      ${textField('Team Name', 'team_name', state.session.team_name)}
      ${searchSurvey(state.searchLevel, config)}
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
    const pod = result ? `${(result.POD_segment * 100).toFixed(0)}%` : '\u2014';
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

export function renderSegment(root, segment, computed, savedLabel, configValid, configError, config, searchType) {
  const trackResult = computed.results?.[0];
  const trackHtml = trackLengthOutputHtml(segment, trackResult);

  root.innerHTML = `
    ${configNotice(configValid, configError)}

    <div class="row between align-center" style="margin-bottom:12px">
      <button class="btn" data-action="go-home">\u2190 Back</button>
      <span id="save-indicator" class="subtle">${esc(savedLabel)}</span>
    </div>

    <section class="panel">
      <h2>Edit Segment</h2>
      ${textField('Segment Name', 'name', segment.name)}

      <h3>Searchers & Area</h3>
      ${numField('Number of Searchers', 'num_searchers', segment.num_searchers, '1', tooltip(config, 'num_searchers'), 1, 999)}
      <span class="hint">Enter area in acres OR hectares (not both)</span>
      <div class="grid-2">
        ${numField('Area (Acres)', 'area_acres', segment.area_acres, '0.1', '', 0, '', segment.area_hectares > 0)}
        ${numField('Area (Hectares)', 'area_hectares', segment.area_hectares, '0.01', '', 0, '', segment.area_acres > 0)}
      </div>

      <div class="grid-2">
        ${numField('Critical Spacing (m)', 'critical_spacing_m', segment.critical_spacing_m, '0.1', 'Distance between searchers', 1, 100)}
        ${numField('Segment Coverage (%)', 'area_coverage_pct', segment.area_coverage_pct, '1', 'Portion of segment actually swept', 0, 100)}
      </div>

      <h3>Track Length (CalTopo)</h3>
      <span class="tooltip-prominent">${esc(config?.ui_tooltips?.track_length_ind || 'Use only if track length is determinable from CalTopo for this segment only. Tracks must be stopped at the start and end of each segment.')}</span>
      ${numField('Individual Track Length (m)', 'track_length_ind_m', segment.track_length_ind_m, '1', 'Leave blank to auto-estimate from spacing + coverage', 0)}

      <div id="track-length-display">
        ${trackHtml}
      </div>

      <h3>Time of Day</h3>
      ${radioChips('time_of_day', LABELS.time_of_day, segment.time_of_day)}
      <h3>Weather</h3>
      ${radioChips('weather', LABELS.weather, segment.weather)}

      <h3>Vegetation Density</h3>
      ${tooltip(config, 'vegetation_density')}
      ${radioChips('vegetation_density', VEGETATION_DENSITY_LABELS, String(segment.vegetation_density || 3), 'tight')}
      ${noteSection('vegetation_density', segment)}
      <h3>Micro-terrain Complexity</h3>
      ${tooltip(config, 'micro_terrain_complexity')}
      ${radioChips('micro_terrain_complexity', MICRO_TERRAIN_LABELS, String(segment.micro_terrain_complexity || 3), 'tight')}
      ${noteSection('micro_terrain_complexity', segment)}
      ${searchType === 'evidence_historical' ? `
      <h3>Burial / Cover</h3>
      ${tooltip(config, 'burial_or_cover')}
      ${radioChips('burial_or_cover', BURIAL_OR_COVER_LABELS, String(segment.burial_or_cover || 3), 'tight')}
      ${noteSection('burial_or_cover', segment)}
      ` : `
      <h3>Extenuating Factors</h3>
      ${tooltip(config, 'extenuating_factors')}
      ${radioChips('extenuating_factors', EXTENUATING_FACTORS_LABELS, String(segment.extenuating_factors || 3), 'tight')}
      ${noteSection('extenuating_factors', segment)}
      `}
    </section>

    <div class="sticky-result" id="pod-result">
      ${podResultHtml(segment, computed)}
    </div>
  `;
}

/* ================================================================
   Track length output (partial update)
   ================================================================ */

export function trackLengthOutputHtml(segment, result) {
  if (!result) return '';
  const src = result.track_source;
  const indLabel = src === 'measured' ? 'Measured individual' : 'Estimated individual';
  return `<div class="track-length-output">
    ${indLabel}: ${fmtNum(result.L_ind_m)} m &middot;
    Total (${result.A_m2 > 0 ? Math.max(Number(segment?.num_searchers || 1), 1) : 0} searchers): ${fmtNum(result.L_total_m)} m
    ${src === 'estimated' ? '<br><span class="hint" style="color:inherit;font-weight:400">Estimated from spacing + coverage</span>' : ''}
  </div>`;
}

/* ================================================================
   POD result panel (also used for partial updates)
   ================================================================ */

export function podResultHtml(segment, computed) {
  const results = computed.results || [];
  const primary = computed.primaryTarget;
  const primaryResult = results.find((r) => r.target === primary);
  const podPct = primaryResult ? `${(primaryResult.POD_segment * 100).toFixed(1)}%` : '\u2014';

  let avgPct = '\u2014';
  if (results.length > 0) {
    const avg = results.reduce((sum, r) => sum + r.POD_segment, 0) / results.length;
    avgPct = `${(avg * 100).toFixed(1)}%`;
  }

  let html = `<p class="pod-large">Primary POD: ${podPct}</p>`;
  html += `<p class="pod-average">Average POD: ${avgPct}</p>`;

  if (results.length > 1) {
    html += '<div style="margin-top:6px">' +
      results.map((r) =>
        `<span style="margin-right:12px">${esc(prettyTarget(r.target))}: ${(r.POD_segment * 100).toFixed(1)}%</span>`
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

export function renderReport(root, state, version, generatedAt, configValid, configError, config) {
  root.innerHTML = `
    <div class="row between" style="margin-bottom:12px">
      <button class="btn" data-action="go-home">\u2190 Back</button>
      <button class="btn btn-primary" data-action="print">Print</button>
    </div>

    <section class="panel report-panel">
      <article>
        <h2>SAR POD Calculator \u2014 Report</h2>
        <p class="subtle">App version: ${esc(version)} (Koopman V3)</p>
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
          ? (state.segments || []).map((seg) => reportSegmentHtml(seg, state.searchLevel.type_of_search)).join('')
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
    `App version: ${version} (Koopman V3)`,
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

  const isEvidence = state.searchLevel.type_of_search === 'evidence_historical';
  state.segments.forEach((seg) => {
    lines.push(`--- ${seg.name || 'Unnamed'} ---`);

    const notes = seg.notes || {};
    const areaStr = seg.area_acres > 0 ? `${seg.area_acres} acres` : seg.area_hectares > 0 ? `${seg.area_hectares} ha` : '\u2014';
    const inputs = [
      `Searchers: ${seg.num_searchers || 1}`,
      `Area: ${areaStr}`,
      `Critical Spacing: ${seg.critical_spacing_m} m`,
      `Coverage: ${seg.area_coverage_pct}%`,
      `Time of Day: ${LABELS.time_of_day[seg.time_of_day] || seg.time_of_day}`,
      `Weather: ${LABELS.weather[seg.weather] || seg.weather}`,
      `Vegetation Density: ${seg.vegetation_density || 3}`,
      `Micro-terrain Complexity: ${seg.micro_terrain_complexity || 3}`,
      isEvidence ? `Burial / Cover: ${seg.burial_or_cover || 3}` : `Extenuating Factors: ${seg.extenuating_factors || 3}`
    ];
    lines.push(`Inputs: ${inputs.join(' | ')}`);

    if (seg.track_length_ind_m > 0) {
      lines.push(`  Individual Track Length (measured): ${seg.track_length_ind_m} m`);
    }

    const noteFields = [
      ['vegetation_density', 'Vegetation Density'],
      ['micro_terrain_complexity', 'Micro-terrain Complexity'],
      isEvidence ? ['burial_or_cover', 'Burial / Cover'] : ['extenuating_factors', 'Extenuating Factors']
    ];
    noteFields.forEach(([key, label]) => {
      const note = notes[key];
      if (note && note.trim()) {
        lines.push(`  ${label} Note: ${note.trim()}`);
      }
    });

    const results = seg.results || [];
    const primaryResult = results.find((r) => r.target === seg.primaryTarget);
    if (primaryResult) {
      lines.push(`Primary POD: ${(primaryResult.POD_segment * 100).toFixed(1)}%`);
    }

    if (results.length > 0) {
      const avg = results.reduce((sum, r) => sum + r.POD_segment, 0) / results.length;
      lines.push(`Average POD: ${(avg * 100).toFixed(1)}%`);
    }

    results.forEach((r) => {
      lines.push(`  ${prettyTarget(r.target)}: ${(r.POD_segment * 100).toFixed(1)}%`);
      lines.push(reportDetailText(seg, r));
    });
    lines.push('');
  });

  return lines.join('\n');
}

/* ================================================================
   Internal helpers
   ================================================================ */

function searchSurvey(s, config) {
  const cats = s.evidence_categories || [];
  return `
    <div class="survey-group" id="search-survey" data-search-type="${s.type_of_search}">
      <h3>Type of Search</h3>
      ${radioChips('type_of_search', LABELS.type_of_search, s.type_of_search)}

      <div class="active-only">
        <h3>Searching For</h3>
        <span class="hint">Select all that apply</span>
        ${checkboxChips('active_targets', LABELS.active_targets, s.active_targets)}
        <h3>Subject</h3>
        <p class="subtle" style="margin:0 0 4px"><strong>Auditory</strong></p>
        ${tooltip(config, 'auditory')}
        ${radioChips('auditory', LABELS.auditory_responsiveness, s.auditory)}
        <p class="subtle" style="margin:10px 0 4px"><strong>Visual</strong></p>
        ${tooltip(config, 'visual')}
        ${radioChips('visual', LABELS.visual_responsiveness, s.visual)}
        <p class="subtle" style="margin:10px 0 4px"><strong>Visibility</strong></p>
        ${tooltip(config, 'subject_visibility')}
        ${radioChips('subject_visibility', LABELS.subject_visibility, s.subject_visibility || 'medium')}
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
    items.push(`<li><strong>Auditory Responsiveness:</strong> ${esc(LABELS.auditory_responsiveness[s.auditory] || s.auditory)}</li>`);
    items.push(`<li><strong>Visual Responsiveness:</strong> ${esc(LABELS.visual_responsiveness[s.visual] || s.visual)}</li>`);
    items.push(`<li><strong>Subject Visibility:</strong> ${esc(LABELS.subject_visibility[s.subject_visibility] || s.subject_visibility || 'Medium')}</li>`);
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
    lines.push(`Auditory Responsiveness: ${LABELS.auditory_responsiveness[s.auditory] || s.auditory}`);
    lines.push(`Visual Responsiveness: ${LABELS.visual_responsiveness[s.visual] || s.visual}`);
    lines.push(`Subject Visibility: ${LABELS.subject_visibility[s.subject_visibility] || s.subject_visibility || 'Medium'}`);
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

function reportInputLi(text, noteText) {
  let html = `<li>${esc(text)}`;
  if (noteText && noteText.trim()) {
    html += `<div class="report-note">Note: ${esc(noteText.trim())}</div>`;
  }
  html += '</li>';
  return html;
}

function reportSegmentHtml(segment, searchType) {
  const results = segment.results || [];
  const primaryResult = results.find((r) => r.target === segment.primaryTarget);
  const isEvidence = searchType === 'evidence_historical';
  const notes = segment.notes || {};
  const areaStr = segment.area_acres > 0 ? `${segment.area_acres} acres` : segment.area_hectares > 0 ? `${segment.area_hectares} ha` : '\u2014';
  const inputItems = [
    reportInputLi(`Searchers: ${segment.num_searchers || 1}`),
    reportInputLi(`Area: ${areaStr}`),
    reportInputLi(`Critical Spacing: ${segment.critical_spacing_m} m`),
    reportInputLi(`Coverage: ${segment.area_coverage_pct}%`),
    segment.track_length_ind_m > 0 ? reportInputLi(`Individual Track Length (measured): ${segment.track_length_ind_m} m`) : '',
    reportInputLi(`Time of Day: ${LABELS.time_of_day[segment.time_of_day] || segment.time_of_day}`),
    reportInputLi(`Weather: ${LABELS.weather[segment.weather] || segment.weather}`),
    reportInputLi(`Vegetation Density: ${segment.vegetation_density || 3}`, notes.vegetation_density),
    reportInputLi(`Micro-terrain Complexity: ${segment.micro_terrain_complexity || 3}`, notes.micro_terrain_complexity),
    isEvidence
      ? reportInputLi(`Burial / Cover: ${segment.burial_or_cover || 3}`, notes.burial_or_cover)
      : reportInputLi(`Extenuating Factors: ${segment.extenuating_factors || 3}`, notes.extenuating_factors)
  ].filter(Boolean);

  const primaryPod = primaryResult ? `${(primaryResult.POD_segment * 100).toFixed(1)}%` : '\u2014';

  let avgPod = '\u2014';
  if (results.length > 0) {
    const avg = results.reduce((sum, r) => sum + r.POD_segment, 0) / results.length;
    avgPod = `${(avg * 100).toFixed(1)}%`;
  }

  return `
    <div class="report-segment">
      <h3>${esc(segment.name || 'Unnamed')}</h3>
      <p class="pod-large" style="font-size:1.4rem">Primary POD: ${primaryPod}</p>
      <p class="report-avg-pod">Average POD: ${avgPod}</p>
      ${results.length
        ? `<p>${results.map((r) => `<strong>${esc(prettyTarget(r.target))}:</strong> ${(r.POD_segment * 100).toFixed(1)}%`).join(' &middot; ')}</p>`
        : '<p class="subtle">No targets selected.</p>'}
      ${(segment.qaWarnings || []).length
        ? `<div style="margin-top:6px;font-size:0.85rem;color:var(--danger)">${segment.qaWarnings.map((w) => `<p style="margin:2px 0">\u26a0 ${esc(w)}</p>`).join('')}</div>`
        : ''}
      <h4 style="margin-bottom:2px">Inputs</h4>
      <ul class="report-list">${inputItems.join('')}</ul>
      ${results.map((r) => reportDetailHtml(segment, r)).join('')}
    </div>`;
}

function reportDetailHtml(segment, r) {
  const aud = r.auditory_bonus ?? 0;
  const vis = r.visual_bonus ?? 0;
  return `
    <details class="report-detail">
      <summary>Koopman Calculation \u2014 ${esc(prettyTarget(r.target))}</summary>
      <pre>Baseline effective search width:
  W0_m = ${n(r.W0_m)}

1. Condition multiplier:
  F_time = ${n(r.F_time)},  F_weather = ${n(r.F_weather)}
  F_visibility = ${n(r.F_visibility)},  F_veg = ${n(r.F_veg)},  F_terrain = ${n(r.F_terrain)}
  F_ext = ${n(r.F_extenuating)},  F_burial = ${n(r.F_burial)}
  C_t = ${n(r.C_t)}

2. Response multiplier:
  auditory_bonus = ${n(aud)},  visual_bonus = ${n(vis)},  cap = ${n(r.response_cap)}
  M_resp = ${n(r.M_resp)}

3. Effective search width:
  W_eff = clamp(W0_m \u00d7 C_t \u00d7 M_resp, ${n(r.w_eff_min)}, ${n(r.w_eff_max)})
        = clamp(${n(r.W0_m)} \u00d7 ${n(r.C_t)} \u00d7 ${n(r.M_resp)}, ...)
        = ${n(r.W_eff)} m

4. Track length (${r.track_source}):
  L_ind = ${n(r.L_ind_m)} m
  L_total = ${n(r.L_total_m)} m

5. Koopman coverage:
  coverage_C = (W_eff \u00d7 L_total) / A
             = (${n(r.W_eff)} \u00d7 ${n(r.L_total_m)}) / ${n(r.A_m2)}
             = ${n(r.coverage_C)}

6. POD (Koopman random search):
  POD = clamp(1 \u2212 exp(\u2212coverage_C), 0, 0.99)
      = clamp(1 \u2212 exp(\u2212${n(r.coverage_C)}), 0, 0.99)
      = ${n(r.POD_segment)}</pre>
    </details>`;
}

function reportDetailText(segment, r) {
  const aud = r.auditory_bonus ?? 0;
  const vis = r.visual_bonus ?? 0;
  return [
    `    --- Koopman Calculation ---`,
    `    W0_m = ${n(r.W0_m)}`,
    `    Condition: F_time=${n(r.F_time)} F_weather=${n(r.F_weather)} F_vis=${n(r.F_visibility)} F_veg=${n(r.F_veg)} F_terrain=${n(r.F_terrain)} F_ext=${n(r.F_extenuating)} F_burial=${n(r.F_burial)}`,
    `    C_t = ${n(r.C_t)}`,
    `    Response: aud=${n(aud)} vis=${n(vis)} M_resp=${n(r.M_resp)}`,
    `    W_eff = clamp(${n(r.W0_m)} * ${n(r.C_t)} * ${n(r.M_resp)}, ${n(r.w_eff_min)}, ${n(r.w_eff_max)}) = ${n(r.W_eff)} m`,
    `    Track (${r.track_source}): L_ind=${n(r.L_ind_m)} m  L_total=${n(r.L_total_m)} m`,
    `    Area = ${n(r.A_m2)} m2`,
    `    coverage_C = (${n(r.W_eff)} * ${n(r.L_total_m)}) / ${n(r.A_m2)} = ${n(r.coverage_C)}`,
    `    POD = clamp(1 - exp(-${n(r.coverage_C)}), 0, 0.99) = ${n(r.POD_segment)}`
  ].join('\n');
}

/* ---- Tooltip from config ---- */

function tooltip(config, key) {
  const text = config?.ui_tooltips?.[key] || '';
  return text ? `<span class="hint">${esc(text)}</span>` : '';
}

/* ---- Note toggle + textarea ---- */

function noteSection(fieldName, segment) {
  const note = (segment.notes && segment.notes[fieldName]) || '';
  const open = note.length > 0;
  return `<div class="note-section">
      <button class="btn btn-note-toggle" data-action="toggle-note" data-field="${fieldName}">${open ? 'Hide note' : 'Add note'}</button>
      <div class="note-input" id="note-wrap-${fieldName}" style="${open ? '' : 'display:none'}">
        <textarea name="note_${fieldName}" placeholder="Add a note\u2026">${esc(note)}</textarea>
      </div>
    </div>`;
}

/* ---- Form field generators ---- */

function radioChips(name, options, current, vertical = false) {
  const cls = vertical === 'tight' ? 'chip-col-tight' : vertical ? 'chip-col' : 'chip-row';
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

function numField(label, name, value, step, hint = '', min = '', max = '', disabled = false) {
  const minAttr = min !== '' ? ` min="${min}"` : '';
  const maxAttr = max !== '' ? ` max="${max}"` : '';
  const disAttr = disabled ? ' disabled' : '';
  return `<label>${esc(label)}${hint ? `<span class="hint">${hint}</span>` : ''}<input type="number" step="${step}"${minAttr}${maxAttr} name="${name}" value="${esc(value ?? '')}"${disAttr}/></label>`;
}

/* ---- Formatting ---- */

function prettyTarget(key) {
  return (key || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function n(v) { return Number(v ?? 0).toFixed(4); }

function fmtNum(v) {
  const num = Number(v || 0);
  return num >= 1000 ? num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : num.toFixed(1);
}

export function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
