import { loadConfig } from './model/configLoader.js';
import { computePOD, generateQaWarnings } from './model/podEngine.js';
import { buildSegmentReportData, segmentReportText, segmentUploadPayload } from './model/reportData.js';
import { getValue, setValue, clearAll } from './storage/db.js';
import {
  renderHome, renderSegment, renderReportList, renderSegmentReport,
  podResultHtml, segmentListHtml, esc
} from './ui/render.js';

/* Signal that all module imports resolved successfully */
window.__psarLoaded = true;

/* ================================================================
   Constants
   ================================================================ */

const UPLOAD_ENDPOINT = 'https://little-river-e034.ian-bell-personal.workers.dev/api/reports';

/* ================================================================
   Defaults
   ================================================================ */

const defaultSearch = {
  search_for: 'missing_person',
  auditory: 'none',
  visual: 'none',
  visibility: 'medium'
};

function newSegment() {
  return {
    id: uid(),
    name: '',
    time_of_day: 'day',
    weather: 'clear',
    vegetation_density: 3,
    micro_terrain_complexity: 3,
    extenuating_factors: 3,
    burial_or_cover: 3,
    num_searchers: 1,
    actual_spacing_m: 10,
    notes: {},
    result: null,
    qaWarnings: []
  };
}

/* ================================================================
   State
   ================================================================ */

const state = {
  session: { your_name: '', search_name: '', team_name: '' },
  searchLevel: structuredClone(defaultSearch),
  segments: []
};

let config = null;
let configValid = true;
let configError = '';
let appVersion = '3.0.0';
let appBuildDate = '';
let saveTimer = null;
let saveState = 'Saved';

/* ================================================================
   Startup
   ================================================================ */

init();

async function init() {
  try {
    const [cfgResult, pkgInfo] = await Promise.all([loadConfig(), fetchPackageInfo()]);

    config = cfgResult.config;
    configValid = cfgResult.valid;
    configError = cfgResult.valid ? '' : (cfgResult.diagnostics || 'Config failed to load.');
    appVersion = pkgInfo.version;
    appBuildDate = pkgInfo.buildDate;

    console.log(`[PSAR POD] v${pkgInfo.version} \u00b7 built ${pkgInfo.buildDate}`);

    document.getElementById('app-version').textContent = pkgInfo.version;
    const stampEl = document.getElementById('build-stamp');
    if (stampEl) stampEl.textContent = `v${pkgInfo.version} \u00b7 ${pkgInfo.buildDate}`;

    initTheme();
    await hydrate();

    const root = document.getElementById('view-root');
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('click', onClick);

    window.addEventListener('hashchange', route);
    window.addEventListener('online', updateConnectivity);
    window.addEventListener('offline', updateConnectivity);
    updateConnectivity();

    route();
    registerSW();
  } catch (err) {
    console.error('Startup:', err);
    const root = document.getElementById('view-root');
    if (root) {
      root.innerHTML = `<div class="panel" style="margin-top:12px">
        <p style="color:var(--danger)">Unable to start: ${esc(err.message)}</p>
      </div>`;
    }
  }
}

/* ================================================================
   Theme (light/dark)
   ================================================================ */

function initTheme() {
  const saved = localStorage.getItem('psar-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  updateThemeButton();
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('psar-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('psar-theme', 'dark');
  }
  updateThemeButton();
}

function updateThemeButton() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.textContent = isDark ? 'Light Mode' : 'Dark Mode';
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#theme-toggle-btn')) toggleTheme();
});

/* ================================================================
   Routing (hash-based)
   ================================================================ */

function route() {
  const hash = location.hash || '#/';
  const root = document.getElementById('view-root');

  if (hash.startsWith('#/segment/')) {
    const id = hash.slice('#/segment/'.length);
    const seg = state.segments.find((s) => s.id === id);
    if (!seg) { location.hash = '#/'; return; }
    renderSegment(root, seg,
      { result: seg.result, qaWarnings: seg.qaWarnings },
      saveState, configValid, configError, config, state.searchLevel.search_for);
  } else if (hash.startsWith('#/report/')) {
    const id = hash.slice('#/report/'.length);
    const seg = state.segments.find((s) => s.id === id);
    if (!seg) { location.hash = '#/reports'; return; }
    const data = buildSegmentReportData(state, seg, formatReportDate(new Date()));
    renderSegmentReport(root, data);
  } else if (hash === '#/reports') {
    renderReportList(root, state.segments);
  } else {
    renderHome(root, state, saveState, configValid, configError, config);
  }
}

/* ================================================================
   Event delegation
   ================================================================ */

function onInput(e) {
  const el = e.target;
  if (el.matches('input[type="text"], input[type="number"], input[type="range"], input:not([type]), textarea')) {
    handleInput(el);
  }
}

function onChange(e) {
  const el = e.target;
  if (el.matches('input[type="radio"], input[type="checkbox"], select')) {
    handleInput(el);
  }
}

function onClick(e) {
  const btn = e.target.closest('[data-action]');
  if (btn) handleAction(btn.dataset.action, btn.dataset.id, btn);
}

/* ================================================================
   Input handling
   ================================================================ */

function handleInput(el) {
  const { name, value } = el;
  const hash = location.hash || '#/';

  if (['your_name', 'search_name', 'team_name'].includes(name)) {
    state.session[name] = value;
    debounceSave();
    return;
  }

  if (hash.startsWith('#/segment/')) {
    const segId = hash.slice('#/segment/'.length);
    const seg = state.segments.find((s) => s.id === segId);
    if (seg) {
      if (name.startsWith('note_')) {
        const noteField = name.slice(5);
        if (!seg.notes) seg.notes = {};
        seg.notes[noteField] = value;
        debounceSave();
        return;
      }

      const segFields = [
        'name', 'num_searchers',
        'actual_spacing_m',
        'time_of_day', 'weather',
        'vegetation_density', 'micro_terrain_complexity', 'extenuating_factors', 'burial_or_cover'
      ];
      if (segFields.includes(name)) {
        const numericFields = [
          'num_searchers',
          'actual_spacing_m',
          'vegetation_density', 'micro_terrain_complexity', 'extenuating_factors', 'burial_or_cover'
        ];
        if (numericFields.includes(name)) {
          seg[name] = value === '' ? '' : Number(value);
        } else {
          seg[name] = value;
        }

        recomputeSegment(seg);

        const podEl = document.getElementById('pod-result');
        if (podEl) podEl.innerHTML = podResultHtml(seg, { result: seg.result, qaWarnings: seg.qaWarnings });

        debounceSave();
        return;
      }
    }
  }

  if (['search_for', 'auditory', 'visual', 'visibility'].includes(name)) {
    state.searchLevel[name] = value;

    if (name === 'search_for') {
      const survey = document.getElementById('search-survey');
      if (survey) survey.dataset.searchType = value;
    }

    recomputeAllSegments();
    const listEl = document.getElementById('segment-list');
    if (listEl) listEl.innerHTML = segmentListHtml(state.segments);
    debounceSave();
    return;
  }
}

/* ================================================================
   Actions
   ================================================================ */

function handleAction(action, id, btn) {
  if (action === 'toggle-note') {
    const field = btn.dataset.field;
    const wrap = document.getElementById(`note-wrap-${field}`);
    if (wrap) {
      const isHidden = wrap.style.display === 'none';
      wrap.style.display = isHidden ? '' : 'none';
      btn.textContent = isHidden ? 'Hide note' : 'Add note';
      if (isHidden) {
        const ta = wrap.querySelector('textarea');
        if (ta) ta.focus();
      }
    }
    return;
  }

  if (action === 'add-segment') {
    const seg = newSegment();
    recomputeSegment(seg);
    state.segments.push(seg);
    debounceSave();
    location.hash = `#/segment/${seg.id}`;
    return;
  }

  if (action === 'edit-segment') {
    location.hash = `#/segment/${id}`;
    return;
  }

  if (action === 'go-home') {
    location.hash = '#/';
    return;
  }

  if (action === 'view-report') {
    location.hash = '#/reports';
    return;
  }

  if (action === 'back-to-reports') {
    location.hash = '#/reports';
    return;
  }

  if (action === 'view-segment-report') {
    location.hash = `#/report/${id}`;
    return;
  }

  if (action === 'print') {
    document.querySelectorAll('.report-detail').forEach((d) => d.setAttribute('open', ''));
    window.print();
    return;
  }

  // Per-segment copy
  if (action === 'copy-segment-report') {
    const seg = state.segments.find((s) => s.id === id);
    if (!seg) return;
    const text = getSegmentReportText(seg);
    copyToClipboard(text);
    showToast('Report copied to clipboard');
    return;
  }

  // Per-segment share
  if (action === 'share-segment-report') {
    const seg = state.segments.find((s) => s.id === id);
    if (!seg) return;
    const text = getSegmentReportText(seg);
    if (navigator.share) {
      navigator.share({ title: `SAR POD \u2014 ${seg.name || 'Segment Report'}`, text }).catch(() => {});
    } else {
      copyToClipboard(text);
      showToast('Report copied to clipboard');
    }
    return;
  }

  // Per-segment upload
  if (action === 'upload-segment') {
    const seg = state.segments.find((s) => s.id === id);
    if (!seg) return;
    uploadSegment(seg, btn);
    return;
  }

  if (action === 'new-session') {
    if (!confirm('Clear all data and start a new session? This cannot be undone.')) return;
    state.session = { your_name: '', search_name: '', team_name: '' };
    state.searchLevel = structuredClone(defaultSearch);
    state.segments = [];
    clearAll();
    localStorage.removeItem('sar_v2_session');
    const atHome = !location.hash || location.hash === '#/' || location.hash === '#';
    location.hash = '#/';
    if (atHome) route();
    return;
  }
}

/* ================================================================
   Report helpers — derive text & payload from same data source
   ================================================================ */

function getSegmentReportText(seg) {
  const data = buildSegmentReportData(state, seg, formatReportDate(new Date()));
  return segmentReportText(data);
}

async function uploadSegment(seg, btn) {
  const data = buildSegmentReportData(state, seg, formatReportDate(new Date()));
  const text = segmentReportText(data);
  const payload = segmentUploadPayload(data, text, state.searchLevel, seg);

  console.log('[PSAR POD] Upload: 1 report', {
    internal_id: seg.id,
    segment_name: seg.name,
    segment_key: payload.segment_key,
    report_id: payload.report_id,
  });

  const origText = btn.textContent;
  btn.textContent = 'Uploading\u2026';
  btn.disabled = true;

  try {
    const resp = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      showToast('Upload successful');
    } else {
      let detail = '';
      try { const body = await resp.json(); detail = body.error || ''; } catch { /* ignore */ }
      console.error(`[PSAR POD] Upload failed: ${resp.status}`, detail);
      showToast(`Upload failed (${resp.status}${detail ? ': ' + detail : ''})`);
    }
  } catch (err) {
    console.error('[PSAR POD] Upload failed:', err);
    if (err instanceof TypeError) {
      showToast('Upload failed \u2014 server unreachable or CORS blocked');
    } else {
      showToast('Upload failed \u2014 check connection');
    }
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
  }
}

/* ================================================================
   Computation
   ================================================================ */

function recomputeAllSegments() {
  state.segments.forEach(recomputeSegment);
}

function recomputeSegment(seg) {
  const cfg = config || {};
  seg.result = computePOD({ config: cfg, searchLevel: state.searchLevel, segment: seg });
  seg.qaWarnings = generateQaWarnings(seg, cfg);
}

/* ================================================================
   Persistence
   ================================================================ */

function debounceSave() {
  saveState = 'Saving\u2026';
  const indicator = document.getElementById('save-indicator');
  if (indicator) indicator.textContent = saveState;

  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await setValue('session', {
        session: state.session,
        searchLevel: state.searchLevel,
        segments: state.segments.map(stripComputed)
      });
      saveState = 'Saved';
    } catch (err) {
      console.error('[PSAR POD] Save failed:', err);
      saveState = 'Save failed';
    }
    const ind = document.getElementById('save-indicator');
    if (ind) ind.textContent = saveState;
  }, 250);
}

async function hydrate() {
  let raw = await getValue('session', null);

  if (!raw) {
    const lsRaw = localStorage.getItem('sar_v2_session');
    if (lsRaw) {
      try { raw = JSON.parse(lsRaw); } catch { /* ignore */ }
      localStorage.removeItem('sar_v2_session');
    }
  }

  if (!raw) return;

  const migrated = migrateState(raw);
  state.session = migrated.session;
  state.searchLevel = migrated.searchLevel;
  state.segments = migrated.segments;
  recomputeAllSegments();

  await setValue('session', {
    session: state.session,
    searchLevel: state.searchLevel,
    segments: state.segments.map(stripComputed)
  });
}

function migrateState(raw) {
  const session = {
    your_name: '',
    search_name: '',
    team_name: '',
    ...(raw.session || {})
  };

  const searchLevel = { ...structuredClone(defaultSearch), ...(raw.searchLevel || {}) };

  if (!searchLevel.search_for && searchLevel.type_of_search) {
    if (searchLevel.type_of_search === 'active_missing_person') {
      searchLevel.search_for = 'missing_person';
    } else if (searchLevel.type_of_search === 'evidence_historical') {
      searchLevel.search_for = 'evidence';
    }
  }
  if (!['missing_person', 'historical_article', 'evidence'].includes(searchLevel.search_for)) {
    searchLevel.search_for = 'missing_person';
  }

  if (!searchLevel.visibility && searchLevel.subject_visibility) {
    searchLevel.visibility = searchLevel.subject_visibility;
  }
  if (!['low', 'medium', 'high'].includes(searchLevel.visibility)) {
    searchLevel.visibility = 'medium';
  }

  delete searchLevel.type_of_search;
  delete searchLevel.subject_visibility;
  delete searchLevel.active_targets;
  delete searchLevel.evidence_classes;
  delete searchLevel.evidence_categories;
  delete searchLevel.remains_state;

  const segments = (raw.segments || []).map((seg) => {
    const next = { ...newSegment(), ...seg };
    next.id = seg.id || uid();
    next.name = seg.name || '';

    if (next.actual_spacing_m == null || next.actual_spacing_m === '') {
      if (seg.critical_spacing_m != null) {
        next.actual_spacing_m = Number(seg.critical_spacing_m);
      } else if (seg.actual_spacing_m != null) {
        next.actual_spacing_m = Number(seg.actual_spacing_m);
      }
    }

    next.num_searchers = clampNum(Number(next.num_searchers), 1, 999, 1);
    next.actual_spacing_m = clampNum(next.actual_spacing_m, 0.1, 10000, 10);
    next.vegetation_density = clampNum(Number(next.vegetation_density), 1, 5, 3);
    next.micro_terrain_complexity = clampNum(Number(next.micro_terrain_complexity), 1, 5, 3);
    next.extenuating_factors = clampNum(Number(next.extenuating_factors), 1, 5, 3);
    next.burial_or_cover = clampNum(Number(next.burial_or_cover), 1, 5, 3);
    if (!next.notes || typeof next.notes !== 'object') next.notes = {};

    delete next.critical_spacing_m;
    delete next.area_coverage_pct;
    delete next.track_length_ind_m;
    delete next.segment_start_time;
    delete next.segment_end_time;
    delete next.searched_fraction;
    delete next.inaccessible_fraction;
    delete next.detectability_level;
    delete next.results;
    delete next.primaryTarget;

    next.result = null;
    return next;
  });

  return { session, searchLevel, segments };
}

/* ================================================================
   Utilities
   ================================================================ */

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fetchPackageInfo() {
  try {
    const pkg = await fetch('./package.json').then((r) => r.json());
    return { version: pkg.version || '3.0.0', buildDate: pkg.buildDate || '' };
  } catch {
    return { version: '3.0.0', buildDate: '' };
  }
}

function updateConnectivity() {
  const online = navigator.onLine;
  const pill = document.getElementById('connectivity-pill');
  if (pill) {
    pill.textContent = online ? 'Online / Offline ready' : 'Offline';
    pill.className = `connectivity-pill ${online ? 'online' : 'offline'}`;
  }
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (isDev) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    return;
  }
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('./service-worker.js')
    .then((reg) => {
      console.log('[PSAR POD] SW registered, scope:', reg.scope);
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(() => {});
}

function showToast(msg, duration = 2500) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  requestAnimationFrame(() => {
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), duration);
  });
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

function formatReportDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function clampNum(val, min, max, fallback) {
  const num = Number(val);
  return Number.isNaN(num) ? fallback : Math.max(min, Math.min(max, num));
}

function stripComputed(seg) {
  const { result, qaWarnings, ...inputs } = seg;
  return inputs;
}
