import { durationMinutes } from '../utils/math.js';

export function renderProfileSwitcher(el, { profiles, activeId, onSwitch, onAdd }) {
  el.innerHTML = `
    <div class="toolbar">
      <select id="profile-select">
        ${profiles.map((p) => `<option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>${p.name} (${p.callSign})</option>`).join('')}
      </select>
      <button id="add-profile">+ Profile</button>
    </div>
  `;
  el.querySelector('#profile-select').onchange = (e) => onSwitch(e.target.value);
  el.querySelector('#add-profile').onclick = onAdd;
}

export function renderSearchPanel(el, state, onChange) {
  const s = state.searchLevel;
  el.innerHTML = `
    <h2>Search-level Survey</h2>
    <fieldset>
      <legend>Type of Search</legend>
      ${radio('type_of_search', 'active_missing_person', 'Active Missing Person', s.type_of_search)}
      ${radio('type_of_search', 'evidence_historical', 'Evidence/Historical', s.type_of_search)}
    </fieldset>

    <fieldset>
      <legend>Active Missing Person > Searching For</legend>
      ${checkbox('active_targets', 'adult', 'Adult', s.active_targets)}
      ${checkbox('active_targets', 'child', 'Child', s.active_targets)}
      ${checkbox('active_targets', 'large_clues', 'Large Clues', s.active_targets)}
      ${checkbox('active_targets', 'small_clues', 'Small Clues', s.active_targets)}
    </fieldset>

    <fieldset>
      <legend>Active Missing Person > Subject Responsiveness</legend>
      <div class="grid-2">
        <div>
          <div class="small">Auditory</div>
          ${radio('auditory', 'none', 'none', s.auditory)}
          ${radio('auditory', 'possible', 'possible', s.auditory)}
          ${radio('auditory', 'likely', 'likely', s.auditory)}
        </div>
        <div>
          <div class="small">Visual</div>
          ${radio('visual', 'none', 'none', s.visual)}
          ${radio('visual', 'possible', 'possible', s.visual)}
          ${radio('visual', 'likely', 'likely', s.visual)}
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>Evidence/Historical > Searching For</legend>
      <div class="small">Remains state</div>
      ${radio('remains_state', 'intact_remains', 'intact_remains', s.remains_state)}
      ${radio('remains_state', 'partially_skeletonized', 'partially_skeletonized', s.remains_state)}
      ${radio('remains_state', 'skeletal_remains', 'skeletal_remains', s.remains_state)}
      <div class="small">Evidence classes</div>
      ${checkbox('evidence_classes', 'large_evidence', 'large_evidence', s.evidence_classes)}
      ${checkbox('evidence_classes', 'small_evidence', 'small_evidence', s.evidence_classes)}
    </fieldset>
  `;
  bindInputs(el, onChange);
}

export function renderSegmentPanel(el, state, onChange, onSave) {
  const g = state.segment;
  const duration = durationMinutes(g.segment_start_time, g.segment_end_time);
  el.innerHTML = `
    <h2>Segment Survey</h2>
    <div class="grid-2">
      ${inputField('Segment start time (24h HH:MM)', 'segment_start_time', g.segment_start_time, 'time')}
      ${inputField('Segment end time (24h HH:MM)', 'segment_end_time', g.segment_end_time, 'time')}
      ${selectField('Time of day', 'time_of_day', ['day', 'dusk_dawn', 'night'], g.time_of_day)}
      ${selectField('Weather', 'weather', ['clear', 'rain', 'snow'], g.weather)}
      ${selectField('Detectability level', 'detectability_level', ['1', '2', '3', '4', '5'], String(g.detectability_level))}
      ${inputField('Critical spacing (meters)', 'critical_spacing_m', g.critical_spacing_m, 'number')}
      ${inputField('Area coverage (%)', 'area_coverage_pct', g.area_coverage_pct, 'number')}
    </div>
    <p class="small">Duration: ${duration === null ? 'invalid time format' : `${duration} min`}</p>
    <button id="save-segment">Save segment</button>
  `;
  bindInputs(el, onChange);
  el.querySelector('#save-segment').onclick = onSave;
}

export function renderResults(el, state) {
  const { results, primaryTarget, diagnostics } = state;
  el.innerHTML = `
    <h2>Results</h2>
    ${diagnostics ? `<p class="error">Config warning:\n${diagnostics}</p>` : '<p class="ok">Config validated.</p>'}
    <p><strong>Inferred primary target:</strong> ${primaryTarget || '—'}</p>
    <div class="results-grid">
      ${(results || []).map((r) => `
        <div class="result-item">
          <strong>${r.target}</strong>: POD ${r.POD_final.toFixed(3)}
          <details>
            <summary>Details</summary>
            <pre>${JSON.stringify({ C_t: r.C_t, S_ref: r.S_ref, E_space: r.E_space, M_resp: r.M_resp, M_comp: r.M_comp, POD_pre: r.POD_pre }, null, 2)}</pre>
          </details>
        </div>`).join('') || '<p class="small">Select targets to see output.</p>'}
    </div>
  `;
}

function inputField(label, name, value, type) {
  return `<label>${label}<input type="${type}" name="${name}" value="${value ?? ''}" /></label>`;
}

function selectField(label, name, options, value) {
  return `<label>${label}<select name="${name}">${options.map((o) => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
}

function radio(name, value, label, current) {
  return `<label class="row"><input type="radio" name="${name}" value="${value}" ${value === current ? 'checked' : ''} />${label}</label>`;
}

function checkbox(name, value, label, current = []) {
  const checked = (current || []).includes(value);
  return `<label class="row"><input type="checkbox" name="${name}" value="${value}" ${checked ? 'checked' : ''} />${label}</label>`;
}

function bindInputs(el, onChange) {
  [...el.querySelectorAll('input, select')].forEach((input) => {
    input.oninput = () => onChange(input);
    input.onchange = () => onChange(input);
  });
}
