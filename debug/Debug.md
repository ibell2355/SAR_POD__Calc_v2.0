  CRITICAL (3)

[X] - Corected
  #: 1
  Location: SAR_POD_V2_config.yaml:47,53,58
  Issue: skeletal_remains, large_evidence, and small_evidence have group: active_missing_person — should be
    evidence_historical. This causes the response multiplier (M_resp) to incorrectly boost POD for evidence/remains
    targets. defaults.js has them correct.
  ────────────────────────────────────────
[X]  - Config YAML failure to load; unlikely, removing emergency defaults 
 #: 2
  Location: defaults.js + podEngine.test.js
  Issue: Emergency defaults and test config have completely stale calibration values vs. the YAML (e.g., adult spacing
    exponent 2.0 vs YAML 0.7, base spacing 8 vs 15, evade -0.02 vs -0.10). Tests pass against the wrong math model;
    fallback would produce very different POD.
  ────────────────────────────────────────
[X] - Detectability level has been removed and appears to have legacy trace artifacts in the algorithm. Correction is to remove 
  #: 3
  Location: SAR_POD_V2_config.yaml
  Issue: No detectability_level condition factors exist in the YAML for any target. The detectability level UI control
    for evidence/historical searches is a complete no-op — conditionFactor() returns 1 every time.

  MEDIUM (8)

[X] - Added Save state Failure Notification 
  #: 4
  Location: main.js:362-378
  Issue: debounceSave has no error handling — if IndexedDB write fails, saveState sticks on "Saving..." permanently
  ────────────────────────────────────────
[X] - Skipped, It may wipe after screen refreshes; no issue 
  #: 5
  Location: main.js:331
  Issue: clearAll() is not awaited in the new-session handler — race condition with subsequent debounced save
  ────────────────────────────────────────
[X] - Unclosed connections can accumulate, causing garbage build-up, resulting in slow sluggish behavior, especially on Safari. Adding db.close
 #: 6
  Location: db.js
  Issue: IndexedDB connections are opened but never closed — potential connection leak on mobile
  ────────────────────────────────────────
[X] - Replaced logo with.SVG and removed spaces and capital
  #: 7
  Location: service-worker.js:34
  Issue: './assets/PSAR Logo.png' — filename with space in APP_SHELL could fail cache.addAll() on some servers, which
    would block SW activation
  ────────────────────────────────────────
[X] - Updated icon 192 to a .png file 
  #: 8
  Location: index.html:10
  Issue: apple-touch-icon points to SVG — Safari requires PNG. iOS homescreen icon will be missing
  ────────────────────────────────────────
[X] - Reworked QA flags: numeric thresholds, removed legacy flags, renamed to area_coverage_pct, moved warnings from segment view to report only
 #: 9
  Location: SAR_POD_V2_config.yaml:443-444, podEngine.js:271-286, render.js
  Issue: Missing warn_if_area_coverage_pct_lt_50 QA flag — the low-coverage warning never fires in production
  ────────────────────────────────────────
[X] - Added spacing_bounds_m to required config validation (accepts legacy reference_spacing_bounds_m)
  #: 10
  Location: configLoader.js:56
  Issue: spacing_bounds_m not in required config keys — silent degradation to hardcoded min=1/max=200 if section is
    missing
  ────────────────────────────────────────
[X] - Deleted dead code configValidator.js
  #: 11
  Location: configValidator.js
  Issue: Schema validator module exists but is never imported anywhere; config.schema.json doesn't exist

  LOW (12)

[X] - Added select to onChange matcher
 #: 12
  Location: main.js:142
  Issue: onChange only matches radio/checkbox — no <select> handling (none exist currently)
  ────────────────────────────────────────
[X] - Replaced shallow spread with structuredClone(defaultSearch) at all 3 sites
  #: 13
  Location: main.js:49,329
  Issue: Shallow spread of defaultSearch copies array references (safe due to reassignment pattern, but fragile)
  ────────────────────────────────────────
[X] - Added input[type="range"] to onInput matcher
  #: 14
  Location: main.js:136
  Issue: onInput doesn't match input[type="range"] (none exist currently)
  ────────────────────────────────────────
[X] - Added min/max to numField: spacing 1-100, coverage 0-100
  #: 15
  Location: main.js:180
  Issue: No HTML min attribute on spacing input — negative values possible during editing (guarded by min_effective)
  ────────────────────────────────────────
[X] - Skipped; block scalar path isn't used by current config, removing would cause misparsing
  #: 16
  Location: simpleYaml.js:76
  Issue: Block scalar content (> / `
  ────────────────────────────────────────
[X] - Skipped; formula text strings with \n aren't rendered anywhere in the UI
  #: 17
  Location: simpleYaml.js
  Issue: YAML escape sequences (\n) in double-quoted strings are not interpreted
  ────────────────────────────────────────
[X] - Deleted parseTimeToMinutes and durationMinutes
  #: 18
  Location: math.js:3-17
  Issue: parseTimeToMinutes and durationMinutes are dead code
  ────────────────────────────────────────
[X] - Exported esc() from render.js, deleted duplicate escapeHtml from main.js
  #: 19
  Location: main.js, render.js
  Issue: escapeHtml/esc duplicated across two files
  ────────────────────────────────────────
[X] - Strip results/primaryTarget/qaWarnings before saving to IDB; recomputed on hydrate
  #: 20
  Location: main.js:380-407
  Issue: Hydrate persists computed results arrays to IDB (wasteful, not incorrect)
  ────────────────────────────────────────
[X] - Skipped; cosmetic only, icons display correctly on current devices
  #: 21
  Location: manifest.webmanifest:10
  Issue: Combined any maskable icon purpose may cause cropping on some devices
  ────────────────────────────────────────
[X] - Skipped; flag works as intended since config is loaded once at startup
  #: 22
  Location: podEngine.js:44
  Issue: _configWarned flag never resets (config doesn't change at runtime)
  ────────────────────────────────────────
[X] - Reordered clampNum to (val, min, max, fallback) and updated all call sites
  #: 23
  Location: main.js:441
  Issue: clampNum argument ordering in migration code is confusing (functionally correct)