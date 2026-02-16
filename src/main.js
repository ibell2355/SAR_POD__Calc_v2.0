import { loadConfig } from './model/configLoader.js';
import { computeForTarget, inferPrimaryTarget, selectedTargets } from './model/podEngine.js';
import { renderProfileSwitcher, renderSearchPanel, renderSegmentPanel, renderResults } from './ui/render.js';
import { bootstrapProfiles, getActiveProfileId, setActiveProfileId } from './storage/state.js';
import { getAllProfiles, saveProfile } from './storage/db.js';
import { seedProfiles } from './storage/seedData.js';
import { downloadText, parseImportJson, toExportJson, toSegmentCsv } from './export/exporters.js';

let app = {
  config: null,
  diagnostics: '',
  profiles: [],
  activeProfileId: null,
  searchLevel: {
    type_of_search: 'active_missing_person',
    active_targets: ['adult'],
    auditory: 'none',
    visual: 'none',
    remains_state: 'intact_remains',
    evidence_classes: []
  },
  segment: {
    id: crypto.randomUUID(),
    segment_start_time: '08:00',
    segment_end_time: '09:00',
    time_of_day: 'day',
    weather: 'clear',
    detectability_level: 3,
    critical_spacing_m: 15,
    area_coverage_pct: 100
  },
  results: [],
  primaryTarget: null
};

const debouncedRecompute = debounce(recomputeAndRender, 150);

start();

async function start() {
  const loaded = await loadConfig();
  app.config = loaded.config;
  app.diagnostics = loaded.diagnostics;

  app.profiles = await bootstrapProfiles(seedProfiles);
  app.activeProfileId = getActiveProfileId() || app.profiles[0]?.id;
  setActiveProfileId(app.activeProfileId);

  renderAll();
  registerServiceWorker();
}

function renderAll() {
  const active = app.profiles.find((p) => p.id === app.activeProfileId);
  if (active?.missions?.[0]?.searchLevel && Object.keys(active.missions[0].searchLevel).length) {
    app.searchLevel = active.missions[0].searchLevel;
  }
  renderProfileSwitcher(document.querySelector('#profile-switcher'), {
    profiles: app.profiles,
    activeId: app.activeProfileId,
    onSwitch: (id) => {
      app.activeProfileId = id;
      setActiveProfileId(id);
      renderAll();
    },
    onAdd: async () => {
      const name = prompt('Profile name/call-sign');
      if (!name) return;
      const profile = { id: crypto.randomUUID(), name, callSign: name, missions: [{ id: crypto.randomUUID(), name: 'Mission', searchLevel: {}, segments: [] }] };
      await saveProfile(profile);
      app.profiles = await getAllProfiles();
      app.activeProfileId = profile.id;
      setActiveProfileId(profile.id);
      renderAll();
    }
  });

  renderSearchPanel(document.querySelector('#search-level-panel'), app, onSurveyChange);
  renderSegmentPanel(document.querySelector('#segment-panel'), app, onSurveyChange, saveSegment);

  renderToolbar();
  recomputeAndRender();
}

function renderToolbar() {
  const panel = document.querySelector('#segment-panel');
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.innerHTML = `
    <button id="export-json">Export JSON</button>
    <button id="import-json">Import JSON</button>
    <button id="export-csv">Export CSV</button>
    <input id="import-file" type="file" accept="application/json" hidden />
  `;
  panel.appendChild(toolbar);

  toolbar.querySelector('#export-json').onclick = () => downloadText('sar-pod-export.json', toExportJson(app.profiles), 'application/json');
  toolbar.querySelector('#export-csv').onclick = () => {
    const active = app.profiles.find((p) => p.id === app.activeProfileId);
    downloadText('sar-pod-segments.csv', toSegmentCsv(active), 'text/csv');
  };
  toolbar.querySelector('#import-json').onclick = () => toolbar.querySelector('#import-file').click();
  toolbar.querySelector('#import-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const parsed = parseImportJson(await file.text());
    for (const profile of parsed) await saveProfile(profile);
    app.profiles = await getAllProfiles();
    renderAll();
  };
}

function onSurveyChange(input) {
  const { name, value, type, checked } = input;
  if (type === 'checkbox') {
    const arr = app.searchLevel[name] || [];
    app.searchLevel[name] = checked ? [...new Set([...arr, value])] : arr.filter((x) => x !== value);
  } else if (['type_of_search', 'auditory', 'visual', 'remains_state'].includes(name)) {
    app.searchLevel[name] = value;
  } else {
    app.segment[name] = type === 'number' ? Number(value) : value;
  }
  debouncedRecompute();
}

async function saveSegment() {
  const active = app.profiles.find((p) => p.id === app.activeProfileId);
  const mission = active.missions[0];
  mission.searchLevel = app.searchLevel;
  mission.segments.push({ ...app.segment, id: crypto.randomUUID(), results: app.results });
  await saveProfile(active);
  app.profiles = await getAllProfiles();
}

function recomputeAndRender() {
  const targets = selectedTargets(app.searchLevel);
  app.primaryTarget = inferPrimaryTarget(targets, app.config);
  app.results = targets.map((target) =>
    computeForTarget({ config: app.config, searchLevel: app.searchLevel, segment: app.segment, targetKey: target })
  );
  renderResults(document.querySelector('#results-panel'), {
    results: app.results,
    primaryTarget: app.primaryTarget,
    diagnostics: app.diagnostics
  });
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
}
