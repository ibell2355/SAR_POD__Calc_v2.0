import { loadConfig } from './model/configLoader.js';
import { computeForTarget, inferPrimaryTarget, selectedTargets } from './model/podEngine.js';
import { buildReportText, renderLandingPage, renderReportPage, renderSegmentPage } from './ui/render.js';

const STORAGE_KEY = 'sar_v2_session';
const IS_DEV = ['localhost', '127.0.0.1'].includes(window.location.hostname);

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
  bootAttempted: false,
  bootSettled: false,
  fatalError: null,
  version: '0.0.0',
  diagnostics: '',
  online: navigator.onLine,
  isDev: IS_DEV,
  savedState: 'Saved',
  view: 'landing',
  editingSegmentId: null,
  session: { your_name: '', search_name: '', team_name: '' },
  searchLevel: { ...defaultSearch },
  segments: []
};

start();

async function start() {
  app.bootAttempted = true;
  try {
    const [{ config, diagnostics, path, errors, valid }, version] = await Promise.all([loadConfig(), getVersion()]);
    app.config = config;
    app.diagnostics = diagnostics;
    app.version = version;
    app.configPath = path;
    app.configErrors = errors || [];
    app.configValid = valid;

    const migrationInfo = hydrate();
    logDevDiagnostics({ configPath: path, configValid: valid, configErrors: errors || [], migrationCount: migrationInfo.count, swVersion: 'v3' });

    bindNetwork();
    safeRender();
    registerServiceWorker();
  } catch (error) {
    console.error('[Startup Fatal]', error);
    app.config = app.config || {};
    app.diagnostics = `Fatal startup error: ${error.message}`;
    app.configPath = app.configPath || './config/SAR_POD_V2_config.yaml';
    app.configErrors = [{ code: 'STARTUP_FATAL', path: app.configPath, message: 'Application startup failed', cause: error.message }];
    app.configValid = false;
    bindNetwork();
    showFatalError(error);
  } finally {
    app.bootSettled = true;
    disableSkeleton();
  }
}

function ensureMountNodes() {
  const appRoot = document.querySelector('#app') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }));
  let headerRoot = appRoot.querySelector('#app-header');
  if (!headerRoot) {
    headerRoot = document.createElement('div');
    headerRoot.id = 'app-header';
    appRoot.appendChild(headerRoot);
  }
  let mainRoot = appRoot.querySelector('#app-main');
  if (!mainRoot) {
    mainRoot = document.createElement('main');
    mainRoot.id = 'app-main';
    appRoot.appendChild(mainRoot);
  }
  return { appRoot, headerRoot, mainRoot };
}

function render() {
  const { appRoot, headerRoot, mainRoot } = ensureMountNodes();
  headerRoot.innerHTML = '';
  headerRoot.className = 'topbar';
  headerRoot.innerHTML = `
    <div class="brand">
      <img src="./assets/logo-placeholder.svg" alt="PSAR Logo" />
      <div>
        <h1>PSAR POD Calculator</h1>
        <p>Parallel Sweep (V1) · v${app.version}</p>
      </div>
    </div>
    <span class="status-pill ${app.online ? 'online' : 'offline'}">${app.online ? 'Online' : 'Offline'} / Offline ready</span>
  `;

  if (app.view === 'segment') {
    const segment = app.segments.find((s) => s.id === app.editingSegmentId);
    if (!segment) {
      app.view = 'landing';
      return render();
    }
    renderSegmentPage(mainRoot, app, segment, { results: segment.results, primaryTarget: segment.primaryTarget });
  } else if (app.view === 'report') {
    renderReportPage(mainRoot, app, format24h(new Date()));
  } else {
    renderLandingPage(mainRoot, app);
  }
  bindInputs(appRoot);
}

function safeRender() {
  try {
    refreshDevDiagnostics();
    render();
    app.fatalError = null;
  } catch (error) {
    showFatalError(error);
  } finally {
    disableSkeleton();
  }
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
  safeRender();
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
  if (action === 'reset-local-data') {
    localStorage.clear();
    await clearIndexedDbSafe();
    window.location.reload();
    return;
  }
  if (action === 'force-refresh-assets' && IS_DEV) {
    await forceRefreshAssets();
    return;
  }
  autosave();
  safeRender();
}

function recomputeAllSegments() {
  app.segments.forEach(recomputeSegment);
}

function recomputeSegment(segment) {
  const targets = selectedTargets(app.searchLevel || {});
  segment.primaryTarget = inferPrimaryTarget(targets, app.config || {});
  segment.results = targets.map((target) => computeForTarget({ config: app.config || {}, searchLevel: app.searchLevel || {}, segment, targetKey: target }));
}

function autosave() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ session: app.session, searchLevel: app.searchLevel, segments: app.segments }));
  app.savedState = `Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

function hydrate() {
  const raw = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!raw) return { count: 0 };
  const migrationInfo = migratePersistedState(raw);
  app.session = migrationInfo.state.session;
  app.searchLevel = migrationInfo.state.searchLevel;
  app.segments = migrationInfo.state.segments;
  recomputeAllSegments();
  return { count: migrationInfo.count };
}

function migratePersistedState(raw) {
  let count = 0;
  const migratedSegments = (raw?.segments || []).map((segment) => {
    const next = {
      ...defaultSegment(),
      ...segment,
      id: segment?.id || crypto.randomUUID(),
      name: segment?.name || '',
      segment_start_time: segment?.segment_start_time || '08:00',
      segment_end_time: segment?.segment_end_time || '09:00',
      time_of_day: segment?.time_of_day || 'day',
      weather: segment?.weather || 'clear',
      detectability_level: Number(segment?.detectability_level ?? 3)
    };

    if (next.critical_spacing_m == null && segment?.actual_spacing_m != null) {
      next.critical_spacing_m = Number(segment.actual_spacing_m);
      count += 1;
    }
    if (next.area_coverage_pct == null) {
      if (segment?.searched_fraction != null) {
        next.area_coverage_pct = Math.round(Number(segment.searched_fraction) * 100);
      } else {
        next.area_coverage_pct = 100;
      }
      count += 1;
    }

    next.critical_spacing_m = clampNumber(next.critical_spacing_m, 15, 0.1, 10000);
    next.area_coverage_pct = clampNumber(next.area_coverage_pct, 100, 0, 100);
    next.results = Array.isArray(next.results) ? next.results : [];
    next.primaryTarget = next.primaryTarget || null;
    return next;
  });

  const mergedSearch = { ...defaultSearch, ...(raw?.searchLevel || {}) };
  mergedSearch.active_targets = Array.isArray(mergedSearch.active_targets) ? mergedSearch.active_targets : [...defaultSearch.active_targets];
  mergedSearch.evidence_classes = Array.isArray(mergedSearch.evidence_classes) ? mergedSearch.evidence_classes : [];

  return {
    count,
    state: {
      session: { ...app.session, ...(raw?.session || {}) },
      searchLevel: mergedSearch,
      segments: migratedSegments
    }
  };
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
  window.addEventListener('online', () => { app.online = true; safeRender(); });
  window.addEventListener('offline', () => { app.online = false; safeRender(); });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./service-worker.js').then((registration) => {
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          app.newVersionAvailable = true;
          safeRender();
          setTimeout(() => window.location.reload(), 1500);
        }
      });
    });
  }).catch((error) => {
    if (IS_DEV) console.warn('SW registration failed:', error);
  });
}

function logDevDiagnostics({ configPath, configValid, configErrors, migrationCount, swVersion }) {
  if (!IS_DEV) return;
  app.migrationCount = migrationCount;
  app.swVersion = swVersion;
  app.devDiagnostics = {
    appVersion: app.version,
    configPath,
    configValid,
    migrationCount,
    segmentsLoaded: app.segments.length,
    route: app.view,
    swVersion,
    configErrorsCount: configErrors.length
  };
  console.group('[SAR POD Calculator startup diagnostics]');
  console.log('config:', { path: configPath, valid: configValid, errors: configErrors.length });
  console.log('migration count:', migrationCount);
  console.log('service worker version:', swVersion);
  console.groupEnd();
}


function refreshDevDiagnostics() {
  if (!IS_DEV || !app.devDiagnostics) return;
  app.devDiagnostics = {
    ...app.devDiagnostics,
    appVersion: app.version,
    configPath: app.configPath,
    configValid: app.configValid,
    migrationCount: app.migrationCount || 0,
    segmentsLoaded: app.segments.length,
    route: app.view,
    swVersion: app.swVersion || 'v3'
  };
}

function disableSkeleton() {
  document.body.classList.remove('loading-skeleton');
  document.querySelector('#app')?.classList.remove('loading-skeleton');
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clampNumber(value, fallback, min, max) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function showFatalError(error) {
  const { mainRoot } = ensureMountNodes();
  app.fatalError = error;
  mainRoot.innerHTML = `
    <section class="page-wrap">
      <article class="card notice notice-error" role="alert">
        <h2>Fatal startup error</h2>
        <p>${escapeHtml(error?.message || 'Unknown render error')}</p>
        <p class="small"><strong>Config path attempted:</strong> ${escapeHtml(app.configPath || './config/SAR_POD_V2_config.yaml')}</p>
        ${IS_DEV && error?.stack ? `<details><summary>Stack</summary><pre>${escapeHtml(error.stack)}</pre></details>` : ''}
        <button data-action="reset-local-data" class="btn-danger">Reset local data</button>
      </article>
    </section>
  `;
  bindInputs(document.querySelector('#app'));
}

async function clearIndexedDbSafe() {
  if (!('indexedDB' in window) || !indexedDB?.databases) return;
  const dbs = await indexedDB.databases();
  await Promise.all((dbs || []).map((db) => db?.name && new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(db.name);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  })));
}

async function forceRefreshAssets() {
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  const registration = await navigator.serviceWorker?.getRegistration?.();
  if (registration) await registration.unregister();
  window.location.reload();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function format24h(date) {
  return date.toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}
