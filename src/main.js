import { loadConfig } from './model/configLoader.js';
import { computeForTarget, inferPrimaryTarget, selectedTargets, generateQaWarnings } from './model/podEngine.js';
import { getValue, setValue, clearAll } from './storage/db.js';
import {
  renderHome, renderSegment, renderReport,
  buildReportText, podResultHtml, segmentListHtml
} from './ui/render.js';

/* ================================================================
   Defaults
   ================================================================ */

const defaultSearch = {
  type_of_search: 'active_missing_person',
  active_targets: ['adult'],
  auditory: 'none',
  visual: 'none',
  remains_state: 'intact_remains',
  evidence_classes: ['large_evidence'],
  evidence_categories: ['remains']
};

function newSegment() {
  return {
    id: uid(),
    name: '',
    time_of_day: 'day',
    weather: 'clear',
    detectability_level: 3,
    critical_spacing_m: 15,
    area_coverage_pct: 100,
    results: [],
    primaryTarget: null,
    qaWarnings: []
  };
}

/* ================================================================
   State
   ================================================================ */

const state = {
  session: { your_name: '', search_name: '', team_name: '' },
  searchLevel: { ...defaultSearch },
  segments: []
};

let config = null;
let configValid = true;
let configError = '';
let appVersion = '2.1.0';
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

    document.getElementById('app-version').textContent = pkgInfo.version;
    const stampEl = document.getElementById('build-stamp');
    if (stampEl) stampEl.textContent = `v${pkgInfo.version} \u00b7 ${pkgInfo.buildDate}`;

    await hydrate();

    // Event delegation — set up once, never rebind
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
        <p style="color:var(--danger)">Unable to start: ${escapeHtml(err.message)}</p>
      </div>`;
    }
  }
}

/* ================================================================
   Routing (hash-based, like baseline)
   ================================================================ */

function route() {
  const hash = location.hash || '#/';
  const root = document.getElementById('view-root');

  if (hash.startsWith('#/segment/')) {
    const id = hash.slice('#/segment/'.length);
    const seg = state.segments.find((s) => s.id === id);
    if (!seg) { location.hash = '#/'; return; }
    renderSegment(root, seg,
      { results: seg.results, primaryTarget: seg.primaryTarget, qaWarnings: seg.qaWarnings },
      saveState, configValid, configError);
  } else if (hash === '#/report') {
    renderReport(root, state, appVersion, formatReportDate(new Date()), configValid, configError);
  } else {
    renderHome(root, state, saveState, configValid, configError);
  }
}

/* ================================================================
   Event delegation
   ================================================================ */

function onInput(e) {
  const el = e.target;
  if (el.matches('input[type="text"], input[type="number"], input:not([type])')) {
    handleInput(el);
  }
}

function onChange(e) {
  const el = e.target;
  if (el.matches('input[type="radio"], input[type="checkbox"]')) {
    handleInput(el);
  }
}

function onClick(e) {
  const btn = e.target.closest('[data-action]');
  if (btn) handleAction(btn.dataset.action, btn.dataset.id);
}

/* ================================================================
   Input handling (targeted updates, no full re-render)
   ================================================================ */

function handleInput(el) {
  const { name, value, type, checked } = el;
  const hash = location.hash || '#/';

  // ---- Session fields ----
  if (['your_name', 'search_name', 'team_name'].includes(name)) {
    state.session[name] = value;
    debounceSave();
    return;
  }

  // ---- Segment fields (segment edit page) ----
  if (hash.startsWith('#/segment/')) {
    const segId = hash.slice('#/segment/'.length);
    const seg = state.segments.find((s) => s.id === segId);
    if (seg) {
      const segFields = [
        'name', 'critical_spacing_m', 'area_coverage_pct',
        'time_of_day', 'weather', 'detectability_level'
      ];
      if (segFields.includes(name)) {
        if (type === 'number' || name === 'detectability_level'
            || name === 'area_coverage_pct') {
          seg[name] = Number(value);
        } else {
          seg[name] = value;
        }

        recomputeSegment(seg);

        // Partial update: POD panel only
        const podEl = document.getElementById('pod-result');
        if (podEl) podEl.innerHTML = podResultHtml(seg, { results: seg.results, primaryTarget: seg.primaryTarget, qaWarnings: seg.qaWarnings });

        debounceSave();
        return;
      }
    }
  }

  // ---- Search-level radios ----
  if (['type_of_search', 'auditory', 'visual', 'remains_state'].includes(name)) {
    state.searchLevel[name] = value;

    // Toggle survey sections via data attribute
    if (name === 'type_of_search') {
      const survey = document.getElementById('search-survey');
      if (survey) survey.dataset.searchType = value;
    }

    recomputeAllSegments();
    const listEl = document.getElementById('segment-list');
    if (listEl) listEl.innerHTML = segmentListHtml(state.segments);
    debounceSave();
    return;
  }

  // ---- Search-level checkboxes ----
  if (['active_targets', 'evidence_classes', 'evidence_categories'].includes(name) && type === 'checkbox') {
    const arr = state.searchLevel[name] || [];
    const next = checked
      ? [...new Set([...arr, value])]
      : arr.filter((x) => x !== value);

    // Prevent deselecting the last active target
    if (name === 'active_targets' && next.length === 0) {
      el.checked = true;
      return;
    }

    // Prevent deselecting both evidence categories
    if (name === 'evidence_categories' && next.length === 0) {
      el.checked = true;
      return;
    }

    // Prevent deselecting all evidence classes when evidence category is active
    if (name === 'evidence_classes' && next.length === 0
        && (state.searchLevel.evidence_categories || []).includes('evidence')) {
      el.checked = true;
      return;
    }

    state.searchLevel[name] = next;

    // When evidence category is selected, ensure at least one evidence class is checked
    if (name === 'evidence_categories' && next.includes('evidence')) {
      if (!state.searchLevel.evidence_classes || state.searchLevel.evidence_classes.length === 0) {
        state.searchLevel.evidence_classes = ['large_evidence'];
        const checkbox = document.querySelector('input[name="evidence_classes"][value="large_evidence"]');
        if (checkbox) checkbox.checked = true;
      }
    }

    // Update evidence category visibility
    if (name === 'evidence_categories') {
      const catsEl = document.getElementById('evidence-cats');
      if (catsEl) {
        catsEl.dataset.hasRemains = next.includes('remains');
        catsEl.dataset.hasEvidence = next.includes('evidence');
      }
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

function handleAction(action, id) {
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
    location.hash = '#/report';
    return;
  }

  if (action === 'print') {
    window.print();
    return;
  }

  if (action === 'copy-report') {
    const text = buildReportText(state, appVersion, formatReportDate(new Date()));
    copyToClipboard(text);
    showToast('Report copied to clipboard');
    return;
  }

  if (action === 'share') {
    const text = buildReportText(state, appVersion, formatReportDate(new Date()));
    if (navigator.share) {
      navigator.share({ title: 'SAR POD Calculator Report', text }).catch(() => {});
    } else {
      copyToClipboard(text);
      showToast('Report copied to clipboard');
    }
    return;
  }

  if (action === 'new-session') {
    if (!confirm('Clear all data and start a new session?')) return;
    state.session = { your_name: '', search_name: '', team_name: '' };
    state.searchLevel = { ...defaultSearch };
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
   Computation
   ================================================================ */

function recomputeAllSegments() {
  state.segments.forEach(recomputeSegment);
}

function recomputeSegment(seg) {
  const cfg = config || {};
  const targets = selectedTargets(state.searchLevel);
  seg.primaryTarget = inferPrimaryTarget(targets, cfg, state.searchLevel.type_of_search);
  seg.results = targets.map((t) =>
    computeForTarget({ config: cfg, searchLevel: state.searchLevel, segment: seg, targetKey: t })
  );
  seg.qaWarnings = generateQaWarnings(seg, cfg);
}

/* ================================================================
   Persistence (IndexedDB with localStorage migration)
   ================================================================ */

function debounceSave() {
  saveState = 'Saving\u2026';
  const indicator = document.getElementById('save-indicator');
  if (indicator) indicator.textContent = saveState;

  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await setValue('session', {
      session: state.session,
      searchLevel: state.searchLevel,
      segments: state.segments
    });
    saveState = 'Saved';
    const ind = document.getElementById('save-indicator');
    if (ind) ind.textContent = saveState;
  }, 250);
}

async function hydrate() {
  // Try IndexedDB first
  let raw = await getValue('session', null);

  // Migrate from localStorage if IDB is empty
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

  // Persist migrated data to IDB
  await setValue('session', {
    session: state.session,
    searchLevel: state.searchLevel,
    segments: state.segments
  });
}

function migrateState(raw) {
  const session = {
    your_name: '',
    search_name: '',
    team_name: '',
    ...(raw.session || {})
  };

  const searchLevel = { ...defaultSearch, ...(raw.searchLevel || {}) };
  searchLevel.active_targets = Array.isArray(searchLevel.active_targets)
    ? searchLevel.active_targets
    : [...defaultSearch.active_targets];
  searchLevel.evidence_classes = Array.isArray(searchLevel.evidence_classes) && searchLevel.evidence_classes.length > 0
    ? searchLevel.evidence_classes
    : ['large_evidence'];
  searchLevel.evidence_categories = Array.isArray(searchLevel.evidence_categories)
    ? searchLevel.evidence_categories
    : ['remains'];

  const segments = (raw.segments || []).map((seg) => {
    const next = { ...newSegment(), ...seg };
    next.id = seg.id || uid();
    next.name = seg.name || '';

    // Legacy field migration: actual_spacing_m -> critical_spacing_m
    if (next.critical_spacing_m == null && seg.actual_spacing_m != null) {
      next.critical_spacing_m = Number(seg.actual_spacing_m);
    }

    // Legacy field migration: searched_fraction -> area_coverage_pct
    if (seg.area_coverage_pct == null && seg.searched_fraction != null) {
      next.area_coverage_pct = clampNum(Number(seg.searched_fraction) * 100, 100, 0, 100);
    }

    // Remove legacy fields
    delete next.segment_start_time;
    delete next.segment_end_time;
    delete next.searched_fraction;
    delete next.inaccessible_fraction;

    next.critical_spacing_m = clampNum(next.critical_spacing_m, 15, 0.1, 10000);
    next.area_coverage_pct = clampNum(next.area_coverage_pct, 100, 0, 100);
    next.detectability_level = clampNum(Number(next.detectability_level), 3, 1, 5);
    next.results = [];
    next.primaryTarget = null;
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
    return { version: pkg.version || '2.1.0', buildDate: pkg.buildDate || '' };
  } catch {
    return { version: '2.1.0', buildDate: '' };
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
    // In local dev, unregister any existing SW so edits take effect immediately
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.forEach((r) => r.unregister())
    );
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
    return;
  }

  // Production: register SW and auto-refresh once when a new version activates
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker.register('./service-worker.js')
    .then((reg) => {
      // Proactively check for SW updates (mobile browsers can be lazy)
      reg.update().catch(() => {});

      // Re-check when the app returns from background on mobile
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update().catch(() => {});
        }
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

function clampNum(val, fallback, min, max) {
  const num = Number(val);
  return Number.isNaN(num) ? fallback : Math.max(min, Math.min(max, num));
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
