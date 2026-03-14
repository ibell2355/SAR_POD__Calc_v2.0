import { loadConfig } from './model/configLoader.js';
import { computeForTarget, inferPrimaryTarget, selectedTargets, generateQaWarnings } from './model/podEngine.js';
import { getValue, setValue, clearAll } from './storage/db.js';
import {
  renderHome, renderSegment, renderReport,
  buildReportText, podResultHtml, segmentListHtml, trackLengthOutputHtml, esc
} from './ui/render.js';

/* ================================================================
   Constants
   ================================================================ */

const ACRES_TO_M2 = 4046.8564224;
const HECTARES_TO_M2 = 10000;

/* ================================================================
   Defaults
   ================================================================ */

const defaultSearch = {
  type_of_search: 'active_missing_person',
  active_targets: ['adult'],
  auditory: 'none',
  visual: 'none',
  subject_visibility: 'medium',
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
    vegetation_density: 3,
    micro_terrain_complexity: 3,
    extenuating_factors: 3,
    burial_or_cover: 3,
    num_searchers: 1,
    area_acres: '',
    area_hectares: '',
    area_m2: 0,
    critical_spacing_m: 15,
    area_coverage_pct: 100,
    track_length_ind_m: '',
    notes: {},
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

    // Theme initialization
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

// Global click handler for theme toggle (in header, outside #view-root)
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
      { results: seg.results, primaryTarget: seg.primaryTarget, qaWarnings: seg.qaWarnings },
      saveState, configValid, configError, config, state.searchLevel.type_of_search);
  } else if (hash === '#/report') {
    renderReport(root, state, appVersion, formatReportDate(new Date()), configValid, configError, config);
  } else {
    renderHome(root, state, saveState, configValid, configError, config);
  }
}

/* ================================================================
   Area conversion helpers
   ================================================================ */

function syncAreaM2(seg) {
  if (seg.area_acres > 0) {
    seg.area_m2 = seg.area_acres * ACRES_TO_M2;
  } else if (seg.area_hectares > 0) {
    seg.area_m2 = seg.area_hectares * HECTARES_TO_M2;
  } else {
    seg.area_m2 = 0;
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
  const { name, value, type, checked } = el;
  const hash = location.hash || '#/';

  // Session fields
  if (['your_name', 'search_name', 'team_name'].includes(name)) {
    state.session[name] = value;
    debounceSave();
    return;
  }

  // Segment fields
  if (hash.startsWith('#/segment/')) {
    const segId = hash.slice('#/segment/'.length);
    const seg = state.segments.find((s) => s.id === segId);
    if (seg) {
      // Note fields
      if (name.startsWith('note_')) {
        const noteField = name.slice(5);
        if (!seg.notes) seg.notes = {};
        seg.notes[noteField] = value;
        debounceSave();
        return;
      }

      const segFields = [
        'name', 'num_searchers', 'area_acres', 'area_hectares',
        'critical_spacing_m', 'area_coverage_pct', 'track_length_ind_m',
        'time_of_day', 'weather',
        'vegetation_density', 'micro_terrain_complexity', 'extenuating_factors', 'burial_or_cover'
      ];
      if (segFields.includes(name)) {
        const numericFields = [
          'num_searchers', 'area_acres', 'area_hectares',
          'critical_spacing_m', 'area_coverage_pct', 'track_length_ind_m',
          'vegetation_density', 'micro_terrain_complexity', 'extenuating_factors', 'burial_or_cover'
        ];
        if (numericFields.includes(name)) {
          seg[name] = value === '' ? '' : Number(value);
        } else {
          seg[name] = value;
        }

        // Mutually exclusive area inputs
        if (name === 'area_acres' && value !== '' && Number(value) > 0) {
          seg.area_hectares = '';
          const haInput = document.querySelector('input[name="area_hectares"]');
          if (haInput) { haInput.value = ''; haInput.disabled = true; }
        } else if (name === 'area_acres' && (value === '' || Number(value) <= 0)) {
          const haInput = document.querySelector('input[name="area_hectares"]');
          if (haInput) haInput.disabled = false;
        }
        if (name === 'area_hectares' && value !== '' && Number(value) > 0) {
          seg.area_acres = '';
          const acInput = document.querySelector('input[name="area_acres"]');
          if (acInput) { acInput.value = ''; acInput.disabled = true; }
        } else if (name === 'area_hectares' && (value === '' || Number(value) <= 0)) {
          const acInput = document.querySelector('input[name="area_acres"]');
          if (acInput) acInput.disabled = false;
        }

        syncAreaM2(seg);
        recomputeSegment(seg);

        // Partial updates
        const podEl = document.getElementById('pod-result');
        if (podEl) podEl.innerHTML = podResultHtml(seg, { results: seg.results, primaryTarget: seg.primaryTarget, qaWarnings: seg.qaWarnings });

        const trackEl = document.getElementById('track-length-display');
        if (trackEl) {
          const trackResult = seg.results?.[0];
          trackEl.innerHTML = trackLengthOutputHtml(seg, trackResult);
        }

        debounceSave();
        return;
      }
    }
  }

  // Search-level radios
  if (['type_of_search', 'auditory', 'visual', 'subject_visibility', 'remains_state'].includes(name)) {
    state.searchLevel[name] = value;

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

  // Search-level checkboxes
  if (['active_targets', 'evidence_classes', 'evidence_categories'].includes(name) && type === 'checkbox') {
    const arr = state.searchLevel[name] || [];
    const next = checked
      ? [...new Set([...arr, value])]
      : arr.filter((x) => x !== value);

    if (name === 'active_targets' && next.length === 0) {
      el.checked = true;
      return;
    }
    if (name === 'evidence_categories' && next.length === 0) {
      el.checked = true;
      return;
    }
    if (name === 'evidence_classes' && next.length === 0
        && (state.searchLevel.evidence_categories || []).includes('evidence')) {
      el.checked = true;
      return;
    }

    state.searchLevel[name] = next;

    if (name === 'evidence_categories' && next.includes('evidence')) {
      if (!state.searchLevel.evidence_classes || state.searchLevel.evidence_classes.length === 0) {
        state.searchLevel.evidence_classes = ['large_evidence'];
        const checkbox = document.querySelector('input[name="evidence_classes"][value="large_evidence"]');
        if (checkbox) checkbox.checked = true;
      }
    }

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
   Computation
   ================================================================ */

function recomputeAllSegments() {
  state.segments.forEach(recomputeSegment);
}

function recomputeSegment(seg) {
  const cfg = config || {};
  syncAreaM2(seg);
  const targets = selectedTargets(state.searchLevel);
  seg.primaryTarget = inferPrimaryTarget(targets, cfg, state.searchLevel.type_of_search);
  seg.results = targets.map((t) =>
    computeForTarget({ config: cfg, searchLevel: state.searchLevel, segment: seg, targetKey: t })
  );
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
  if (!searchLevel.subject_visibility) searchLevel.subject_visibility = 'medium';
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

    // V2 -> V3 migration
    if (next.critical_spacing_m == null && seg.actual_spacing_m != null) {
      next.critical_spacing_m = Number(seg.actual_spacing_m);
    }
    if (seg.area_coverage_pct == null && seg.searched_fraction != null) {
      next.area_coverage_pct = clampNum(Number(seg.searched_fraction) * 100, 0, 100, 100);
    }

    // New V3 fields with defaults
    next.num_searchers = clampNum(Number(next.num_searchers), 1, 999, 1);
    next.area_acres = next.area_acres || '';
    next.area_hectares = next.area_hectares || '';
    next.track_length_ind_m = next.track_length_ind_m || '';

    // Remove legacy fields
    delete next.segment_start_time;
    delete next.segment_end_time;
    delete next.searched_fraction;
    delete next.inaccessible_fraction;
    delete next.detectability_level;

    next.critical_spacing_m = clampNum(next.critical_spacing_m, 0.1, 10000, 15);
    next.area_coverage_pct = clampNum(next.area_coverage_pct, 0, 100, 100);
    next.vegetation_density = clampNum(Number(next.vegetation_density), 1, 5, 3);
    next.micro_terrain_complexity = clampNum(Number(next.micro_terrain_complexity), 1, 5, 3);
    next.extenuating_factors = clampNum(Number(next.extenuating_factors), 1, 5, 3);
    next.burial_or_cover = clampNum(Number(next.burial_or_cover), 1, 5, 3);
    if (!next.notes || typeof next.notes !== 'object') next.notes = {};
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
    navigator.serviceWorker.getRegistrations().then((regs) =>
      regs.forEach((r) => r.unregister())
    );
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

function clampNum(val, min, max, fallback) {
  const num = Number(val);
  return Number.isNaN(num) ? fallback : Math.max(min, Math.min(max, num));
}

function stripComputed(seg) {
  const { results, primaryTarget, qaWarnings, area_m2, ...inputs } = seg;
  return inputs;
}
