import { loadConfig } from './model/configLoader.js';
import { computeForTarget, inferPrimaryTarget, selectedTargets } from './model/podEngine.js';
import { buildReportText, renderLandingPage, renderReportPage, renderSegmentPage } from './ui/render.js';

const STORAGE_KEY = 'sar_v2_session';

const defaultSearch = {
  type_of_search: 'active_missing_person',
  active_targets: ['adult'],
  auditory: 'none',
  visual: 'none',
  remains_state: 'intact_remains',
  evidence_classes: []
};

const defaultSegment = () => ({
  id: crypto.randomUUID(),
  name: '',
  segment_start_time: '08:00',
  segment_end_time: '09:00',
  time_of_day: 'day',
  weather: 'clear',
  detectability_level: 3,
  critical_spacing_m: 15,
  area_coverage_pct: 100,
  results: [],
  primaryTarget: null
});

const app = {
  config: null,
  version: '0.0.0',
  diagnostics: '',
  online: navigator.onLine,
  savedState: 'Saved',
  view: 'landing',
  editingSegmentId: null,
  session: { your_name: '', search_name: '', team_name: '' },
  searchLevel: { ...defaultSearch },
  segments: []
};

start();

async function start() {
  const [{ config, diagnostics }, version] = await Promise.all([loadConfig(), getVersion()]);
  app.config = config;
  app.diagnostics = diagnostics;
  app.version = version;
  hydrate();
  bindNetwork();
  render();
  registerServiceWorker();
}

function render() {
  const root = document.querySelector('#app');
  if (app.view === 'segment') {
    const segment = app.segments.find((s) => s.id === app.editingSegmentId);
    renderSegmentPage(root, app, segment, { results: segment.results, primaryTarget: segment.primaryTarget });
  } else if (app.view === 'report') {
    renderReportPage(root, app, format24h(new Date()));
  } else {
    renderLandingPage(root, app);
  }
  bindInputs(root);
}

function bindInputs(root) {
  root.querySelectorAll('input').forEach((input) => {
    input.oninput = () => handleInput(input);
    input.onchange = () => handleInput(input);
  });

  root.querySelectorAll('[data-action]').forEach((btn) => {
    btn.onclick = () => handleAction(btn.dataset.action, btn.dataset.id);
  });
}

function handleInput(input) {
  const { name, value, type, checked } = input;
  const segment = app.segments.find((s) => s.id === app.editingSegmentId);
  if (['your_name', 'search_name', 'team_name'].includes(name)) {
    app.session[name] = value;
  } else if (app.view === 'segment' && segment) {
    if (type === 'number') segment[name] = Number(value);
    else if (name === 'detectability_level') segment[name] = Number(value);
    else segment[name] = value;
    recomputeSegment(segment);
  } else if (['type_of_search', 'auditory', 'visual', 'remains_state'].includes(name)) {
    app.searchLevel[name] = value;
    recomputeAllSegments();
  } else if (['active_targets', 'evidence_classes'].includes(name) && type === 'checkbox') {
    const arr = app.searchLevel[name] || [];
    app.searchLevel[name] = checked ? [...new Set([...arr, value])] : arr.filter((x) => x !== value);
    recomputeAllSegments();
  }
  autosave();
  render();
}

async function handleAction(action, id) {
  if (action === 'add-segment') {
    const s = defaultSegment();
    recomputeSegment(s);
    app.segments.push(s);
    app.editingSegmentId = s.id;
    app.view = 'segment';
  }
  if (action === 'edit-segment') {
    app.editingSegmentId = id;
    app.view = 'segment';
  }
  if (action === 'go-home') app.view = 'landing';
  if (action === 'view-report') app.view = 'report';
  if (action === 'print') window.print();
  if (action === 'copy-report') {
    await navigator.clipboard.writeText(buildReportText(app, format24h(new Date())));
  }
  if (action === 'share') {
    const text = buildReportText(app, format24h(new Date()));
    if (navigator.share) await navigator.share({ title: 'PSAR POD Calculator Report', text });
    else await navigator.clipboard.writeText(text);
  }
  if (action === 'new-session') {
    localStorage.removeItem(STORAGE_KEY);
    app.session = { your_name: '', search_name: '', team_name: '' };
    app.searchLevel = { ...defaultSearch };
    app.segments = [];
    app.view = 'landing';
  }
  autosave();
  render();
}

function recomputeAllSegments() {
  app.segments.forEach(recomputeSegment);
}

function recomputeSegment(segment) {
  const targets = selectedTargets(app.searchLevel);
  segment.primaryTarget = inferPrimaryTarget(targets, app.config);
  segment.results = targets.map((target) => computeForTarget({ config: app.config, searchLevel: app.searchLevel, segment, targetKey: target }));
}

function autosave() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ session: app.session, searchLevel: app.searchLevel, segments: app.segments }));
  app.savedState = `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function hydrate() {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (!raw) return;
  app.session = raw.session || app.session;
  app.searchLevel = raw.searchLevel || app.searchLevel;
  app.segments = raw.segments || [];
  recomputeAllSegments();
}

async function getVersion() {
  try {
    const pkg = await fetch('./package.json').then((r) => r.json());
    return pkg.version;
  } catch {
    return '0.1.2';
  }
}

function bindNetwork() {
  window.addEventListener('online', () => { app.online = true; render(); });
  window.addEventListener('offline', () => { app.online = false; render(); });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
}

function format24h(date) {
  return date.toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}
