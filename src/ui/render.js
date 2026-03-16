import { spacingForTargetPOD } from '../model/podEngine.js';
import { hasRefImages } from './imageViewer.js';

export const LABELS = {
  time_of_day: { day: 'Day', dusk_dawn: 'Dusk/Dawn', night: 'Night' },
  weather: { clear: 'Clear', rain: 'Raining', snow: 'Snowing' },
  search_for: {
    missing_person: 'Missing Person',
    historical: 'Historical',
    article_evidence: 'Article/Evidence'
  },
  auditory_responsiveness: { none: 'Not Expected', possible: 'Possible', likely: 'Likely' },
  visual_responsiveness: { evade: 'Expected to Evade', none: 'Not Expected', possible: 'Possible', likely: 'Likely' },
  visibility: { low: 'Low', medium: 'Medium', high: 'High' }
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
        <button class="btn" data-action="view-report">View Report</button>
        <button class="btn btn-danger" data-action="new-session">New Session (Clear All Data)</button>
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
    const result = seg.result;
    const pod = result ? `${(result.POD * 100).toFixed(0)}%` : '\u2014';
    return `
      <div class="segment-row">
        <button class="segment-card" data-action="edit-segment" data-id="${esc(seg.id)}">
          <div>
            <strong>${esc(seg.name || `Segment ${i + 1}`)}</strong>
          </div>
          <span class="pod-badge">${pod}</span>
        </button>
        <button class="btn btn-danger btn-sm segment-delete" data-action="delete-segment" data-id="${esc(seg.id)}" title="Delete segment">\u00d7</button>
      </div>`;
  }).join('');
}

/* ================================================================
   Segment edit page
   ================================================================ */

export function renderSegment(root, segment, computed, savedLabel, configValid, configError, config, searchType) {
  root.innerHTML = `
    ${configNotice(configValid, configError)}

    <div class="row between align-center" style="margin-bottom:12px">
      <button class="btn" data-action="go-home">\u2190 Back</button>
      <span id="save-indicator" class="subtle">${esc(savedLabel)}</span>
    </div>

    <section class="panel">
      <h2>Edit Segment</h2>
      ${textField('Segment Name', 'name', segment.name)}
      ${segmentNoteSection(segment)}

      <h3>Searchers</h3>
      ${numField('Number of Searchers', 'num_searchers', segment.num_searchers, '1', tooltip(config, 'num_searchers'), 1, 999)}

      <h3>Spacing</h3>
      ${numField('Actual Spacing Used (m)', 'actual_spacing_m', segment.actual_spacing_m, '0.1', tooltip(config, 'actual_spacing'), 0.1)}
      <span class="hint">Estimated spacing for target POD under current conditions</span>
      <div id="spacing-helpers" class="spacing-helpers">
        ${spacingHelpersHtml(computed.result)}
      </div>

      <h3>Time of Day</h3>
      ${radioChips('time_of_day', LABELS.time_of_day, segment.time_of_day)}
      <h3>Weather</h3>
      ${radioChips('weather', LABELS.weather, segment.weather)}

      <h3>Vegetation Density</h3>
      ${tooltip(config, 'vegetation_density')}
      ${radioChips('vegetation_density', VEGETATION_DENSITY_LABELS, String(segment.vegetation_density || 3), 'tight', 'vegetation_density')}
      ${noteSection('vegetation_density', segment)}
      <h3>Micro-terrain Complexity</h3>
      ${tooltip(config, 'micro_terrain_complexity')}
      ${radioChips('micro_terrain_complexity', MICRO_TERRAIN_LABELS, String(segment.micro_terrain_complexity || 3), 'tight', 'micro_terrain_complexity')}
      ${noteSection('micro_terrain_complexity', segment)}
      ${searchType !== 'missing_person' ? `
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
   POD result panel (also used for partial updates)
   ================================================================ */

export function podResultHtml(segment, computed) {
  const result = computed.result;
  const podPct = result ? `${(result.POD * 100).toFixed(0)}%` : '\u2014';

  let html = `<p class="pod-large">POD: ${podPct}</p>`;

  if (computed.qaWarnings && computed.qaWarnings.length) {
    html += `<div style="margin-top:6px;font-size:0.85rem;color:var(--danger)">${computed.qaWarnings.map((w) => `<p style="margin:2px 0">\u26a0 ${esc(w)}</p>`).join('')}</div>`;
  }

  if (!result || result.actual_spacing_m <= 0) {
    html += '<p class="subtle">Enter spacing to calculate POD.</p>';
  }

  return html;
}

/* ================================================================
   Spacing helpers — estimated spacing for target POD thresholds
   ================================================================ */

export function spacingHelpersHtml(result) {
  if (!result || result.W_eff <= 0) {
    return '<div class="computed-output">63% POD: \u2014</div><div class="computed-output">83% POD: \u2014</div>';
  }
  const s63 = spacingForTargetPOD(result.W_eff, 0.63);
  const s83 = spacingForTargetPOD(result.W_eff, 0.83);
  const fmt63 = s63 != null ? `${Math.round(s63)} m` : '\u2014';
  const fmt83 = s83 != null ? `${Math.round(s83)} m` : '\u2014';
  return `<div class="computed-output">63% POD: ${fmt63}</div><div class="computed-output">83% POD: ${fmt83}</div>`;
}

/* ================================================================
   Report selection page — lists segments with per-segment actions
   ================================================================ */

export function renderReportList(root, segments) {
  const segCards = segments.length
    ? segments.map((seg, i) => {
        const pod = seg.result ? `${(seg.result.POD * 100).toFixed(0)}%` : '\u2014';
        return `
          <div class="report-seg-card">
            <div class="row between align-center">
              <strong>${esc(seg.name || `Segment ${i + 1}`)}</strong>
              <span class="pod-badge">${pod}</span>
            </div>
            <div class="report-seg-actions">
              <button class="btn btn-sm" data-action="view-segment-report" data-id="${esc(seg.id)}">View Report</button>
              <button class="btn btn-sm" data-action="share-segment-report" data-id="${esc(seg.id)}">Share</button>
              <button class="btn btn-sm" data-action="copy-segment-report" data-id="${esc(seg.id)}">Copy Report</button>
              <button class="btn btn-sm btn-primary" data-action="upload-segment" data-id="${esc(seg.id)}">Upload</button>
            </div>
          </div>`;
      }).join('')
    : '<p class="subtle">No segments to report.</p>';

  root.innerHTML = `
    <div class="row between align-center" style="margin-bottom:12px">
      <button class="btn" data-action="go-home">\u2190 Back</button>
    </div>

    <section class="panel">
      <h2>Segment Reports</h2>
      <div class="segment-list">${segCards}</div>
    </section>
  `;
}

/* ================================================================
   Single segment report view — renders report data as formatted HTML
   ================================================================ */

export function renderSegmentReport(root, reportData) {
  const d = reportData;
  const seg = d.segment;

  let searchInfoHtml = `
    <li><strong>Your Name:</strong> ${esc(d.search.your_name)}</li>
    <li><strong>Search Name:</strong> ${esc(d.search.search_name)}</li>
    <li><strong>Team Name:</strong> ${esc(d.search.team_name)}</li>
    <li><strong>Search For:</strong> ${esc(d.search.search_for)}</li>
    <li><strong>Visibility:</strong> ${esc(d.search.visibility)}${impactBadge(seg.coefficient_impacts, 'Visibility')}</li>`;

  if (d.search.auditory != null) {
    searchInfoHtml += `<li><strong>Auditory Responsiveness:</strong> ${esc(d.search.auditory)}${impactBadge(seg.coefficient_impacts, 'Auditory Responsiveness')}</li>`;
  }
  if (d.search.visual != null) {
    searchInfoHtml += `<li><strong>Visual Responsiveness:</strong> ${esc(d.search.visual)}${impactBadge(seg.coefficient_impacts, 'Visual Responsiveness')}</li>`;
  }

  const segFactors = [
    ['Time of Day', seg.time_of_day],
    ['Weather', seg.weather],
    ['Vegetation Density', seg.vegetation_density],
    ['Micro-terrain Complexity', seg.micro_terrain_complexity],
  ];
  if (seg.extenuating_factors != null) segFactors.push(['Extenuating Factors', seg.extenuating_factors]);
  if (seg.burial_or_cover != null) segFactors.push(['Burial / Cover', seg.burial_or_cover]);

  const NOTE_KEY_MAP = {
    'Vegetation Density': 'vegetation_density',
    'Micro-terrain Complexity': 'micro_terrain_complexity',
    'Extenuating Factors': 'extenuating_factors',
    'Burial / Cover': 'burial_or_cover',
  };

  const segInputHtml = [
    `<li><strong>Searchers:</strong> ${seg.num_searchers}</li>`,
    `<li><strong>Actual Spacing:</strong> ${seg.actual_spacing_m} m</li>`,
    ...segFactors.flatMap(([label, value]) => {
      const items = [`<li><strong>${esc(label)}:</strong> ${esc(value)}${impactBadge(seg.coefficient_impacts, label)}</li>`];
      const noteKey = NOTE_KEY_MAP[label];
      const note = noteKey && seg.notes[noteKey];
      if (note && note.trim()) {
        items.push(`<li style="list-style:none;padding-left:1.5em" class="subtle"><em>${esc(label)} Note:</em> ${esc(note.trim())}</li>`);
      }
      return items;
    }),
  ].join('');

  root.innerHTML = `
    <div class="row between align-center" style="margin-bottom:12px">
      <button class="btn" data-action="back-to-reports">\u2190 Back</button>
      <button class="btn btn-primary" data-action="print">Print</button>
    </div>

    <section class="panel report-panel">
      <article>
        <h2>SAR POD Calculator \u2014 Segment Report</h2>
        <p class="subtle">Generated: ${esc(d.generated_at)}</p>

        <h3>Search Information</h3>
        <ul class="report-list">${searchInfoHtml}</ul>

        <h3>Segment: ${esc(seg.name)}</h3>
        ${seg.segment_note ? `<p class="subtle" style="margin:4px 0 8px"><strong>Segment Note:</strong> ${esc(seg.segment_note)}</p>` : ''}
        <ul class="report-list">${segInputHtml}</ul>

        ${seg.effective_sweep_width_m != null ? `
        <div style="margin-top:12px">
          <p><strong>Effective Sweep Width:</strong> ${fmtNum(seg.effective_sweep_width_m)} m</p>
          <p><strong>Coverage Factor:</strong> ${Number(seg.coverage_factor).toFixed(2)}</p>
        </div>` : ''}

        ${seg.qa_warnings.length
          ? `<div style="margin-top:8px;font-size:0.85rem;color:var(--danger)">${seg.qa_warnings.map((w) => `<p style="margin:2px 0">\u26a0 ${esc(w)}</p>`).join('')}</div>`
          : ''}

        <p class="pod-large" style="margin-top:16px">POD: ${seg.final_pod_pct}</p>
      </article>
    </section>
  `;
}

/* ================================================================
   Internal helpers
   ================================================================ */

function impactBadge(impacts, name) {
  const imp = (impacts || []).find((i) => i.name === name);
  return impactBadgeFromImpact(imp);
}

function impactBadgeFromImpact(imp) {
  if (!imp) return '';
  const sign = imp.impact_percent >= 0 ? '+' : '';
  const cls = imp.impact_percent > 0 ? 'impact-positive' : imp.impact_percent < 0 ? 'impact-negative' : 'impact-neutral';
  return ` <span class="${cls}">${sign}${imp.impact_percent.toFixed(1)}% POD</span>`;
}

function searchSurvey(s, config) {
  return `
    <div class="survey-group" id="search-survey" data-search-type="${s.search_for}">
      <h3>Search For</h3>
      ${radioChips('search_for', LABELS.search_for, s.search_for)}

      <div class="missing-person-only">
        <h3>Subject Response</h3>
        <p class="subtle" style="margin:0 0 4px"><strong>Auditory</strong></p>
        ${tooltip(config, 'auditory')}
        ${radioChips('auditory', LABELS.auditory_responsiveness, s.auditory)}
        <p class="subtle" style="margin:10px 0 4px"><strong>Visual</strong></p>
        ${tooltip(config, 'visual')}
        ${radioChips('visual', LABELS.visual_responsiveness, s.visual)}
      </div>

      <h3>Visibility</h3>
      ${tooltip(config, 'visibility')}
      ${radioChips('visibility', LABELS.visibility, s.visibility || 'medium')}
    </div>`;
}

function configNotice(valid, error) {
  if (valid) return '';
  return `<p class="config-error">${esc(error || 'Configuration could not be loaded. Using safe defaults.')}</p>`;
}

/* ---- Tooltip from config ---- */

function tooltip(config, key) {
  const text = config?.ui_tooltips?.[key] || '';
  return text ? `<span class="hint">${esc(text)}</span>` : '';
}

/* ---- Note toggle + textarea ---- */

function segmentNoteSection(segment) {
  const note = segment.segment_note || '';
  const open = note.length > 0;
  return `<div class="note-section">
      <button class="btn btn-note-toggle" data-action="toggle-note" data-field="segment_note">${open ? 'Hide Segment Note' : 'Add Segment-Wide Note'}</button>
      <span class="hint">Segment level notes (for example, any unsearched areas and/or challenges in the segment). Should be POD related notes only, not to replace proper documentation or CalTopo marking of hazards, etc.</span>
      <div class="note-input" id="note-wrap-segment_note" style="${open ? '' : 'display:none'}">
        <textarea name="segment_note" placeholder="Add a segment-wide note\u2026">${esc(note)}</textarea>
      </div>
    </div>`;
}

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

/* ---- Reference image button ---- */

function refImageButton(category, level) {
  return `<button class="btn-ref-images" data-action="view-ref-images" data-category="${category}" data-level="${level}" title="View reference images">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
  </button>`;
}

/* ---- Form field generators ---- */

function radioChips(name, options, current, vertical = false, refCategory = null) {
  const cls = vertical === 'tight' ? 'chip-col-tight' : vertical ? 'chip-col' : 'chip-row';
  const chips = Object.entries(options).map(([val, label]) => {
    const chipHtml = `<label class="chip"><input type="radio" name="${name}" value="${val}"${String(current) === String(val) ? ' checked' : ''}><span>${label}</span></label>`;
    if (refCategory && hasRefImages(refCategory, val)) {
      return `<div class="chip-with-ref">${refImageButton(refCategory, val)}${chipHtml}</div>`;
    }
    return chipHtml;
  }).join('');
  return `<div class="${cls}">${chips}</div>`;
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
