# ARCHITECTURE_OVERVIEW

Technical layout of the SAR PoD Calculator v3 codebase. Pair with `APP_CAPABILITIES.md` (user-facing) and `REPO_MEMORY.md` (state of record).

---

## Entry points

- **`index.html`** — SPA shell. Loads `./src/main.js` as `<script type="module">`. Includes inline scripts for stale-cache eviction (`psar-pod-v19-cf-launch`), a "fresh reload required" fallback if the main module fails to load within 3 s, header QR overlay, and an "About This Tool" overlay.
- **`src/main.js`** — application bootstrap, hash routing, event delegation, input handling, persistence, and the entire upload flow.

## Routing

**Hash-based, client-side only.** No History API, no clean URLs. Every URL hits `index.html` from the server's point of view, so no SPA fallback is needed on the host. Routes are dispatched in `route()` at `src/main.js`:

- `#/` → home (session + segment list)
- `#/segment/:id` → segment editor
- `#/reports` → report list
- `#/report/:id` → single segment report

## Service worker / PWA

- **File:** `service-worker.js`
- **Cache name:** `psar-pod-v19-cf-launch` (also referenced by the eviction snippet in `index.html` — these two strings must stay in sync).
- **Manifest:** `manifest.webmanifest` (standalone display, `start_url: "./"`, theme color `#183859`, icons in `./assets/`).
- **Fetch strategy:**
  - HTML navigation → network-first, fallback to cached `./index.html`.
  - Same-origin assets → network-first, fallback to cache.
  - Cross-origin → network-only (the upload Worker is cross-origin today).
- **Pre-cache list (`APP_SHELL`):** explicit array of app shell files, modules, styles, manifest, icons, runtime YAML config, `package.json`, and all 20 vegetation reference images. Must stay in sync with shipped files.
- **Dev-mode bypass:** SW is **not** registered on `localhost`/`127.0.0.1`; on those origins, `registerSW()` unregisters any existing SW and deletes all caches.
- **Update lever:** bumping `CACHE_NAME` evicts old caches on next load.

## Config loading

- **Source:** `config/SAR_POD_V3_config.yaml`
- **Loader:** `src/model/configLoader.js` — tries `/config/...` and `./config/...` candidates for v3, with dead V2 fallbacks (harmless leftovers).
- **Parser:** `src/utils/simpleYaml.js` — small in-browser YAML parser. Handles scalars, inline arrays, nested objects, block scalars (skipped), and array items.
- **Validation:** loader checks for required keys (`search_types`, `condition_factors`, `response_model`) and surfaces diagnostics in the UI on failure. There is no formal JSON schema check; the data shape is validated by the engine's defensive defaults.

## Model layer

### POD engine — `src/model/podEngine.js`
Exports:
- `computePOD({ config, searchLevel, segment })` — main entry point. Returns an object with all intermediate values (`K_*`, `C_t`, `M_resp`, `W_eff`, `effective_spacing_m`, `coverage_factor`, `POD`, plus the spacing limits used).
- `spacingForTargetPOD(wEff, targetPOD)` — reverse calc: spacing that would hit a target POD. Powers the "63% POD: X m" / "83% POD: Y m" helpers.
- `responseMultiplier(searchLevel, config)` / `responseComponents(searchLevel, config)` — auditory × visual multipliers with the `max_total_multiplier` cap.
- `generateQaWarnings(segment, config)` — surfaces "spacing is zero", "spacing too large", "no searchers".

All functions are **pure** — no DOM, no storage, no fetch.

### Math helpers — `src/utils/math.js`
- `clamp(value, min, max)`. That's it.

## Report layer — `src/model/reportData.js`

Single source of truth for both the rendered report and the upload JSON:

- `buildSegmentReportData(state, segment, generatedAt)` → structured object.
- `segmentReportText(data)` → plain-text report (used by Copy / Share / `report_text` field in uploads).
- `segmentUploadPayload(data, reportText, persistentReportId)` → the JSON body POSTed to the Worker.
- `segmentKey(name)` → slug normalizer for stable segment identity.

Plus `computeCoefficientImpacts(...)` — per-factor "what if this factor were neutral?" deltas surfaced in both the report view and the upload payload.

All also pure.

## Storage layer — `src/storage/db.js`

Tiny IndexedDB wrapper:
- Database `sar-pod-db`, version 1, object store `kv`.
- API: `getValue(key, fallback)`, `setValue(key, value)`, `clearAll()`.
- The app stores one record under key `session` containing `{ session, searchLevel, segments }`.
- Save is debounced 250 ms in `src/main.js` `debounceSave()`.
- A legacy `localStorage` key `sar_v2_session` is migrated once at hydrate then deleted. Do not rename or remove.

## UI layer

- **`src/ui/render.js`** — all HTML rendering. Exports `renderHome`, `renderSegment`, `renderReportList`, `renderSegmentReport`, plus partials (`podResultHtml`, `spacingHelpersHtml`, `segmentListHtml`, `uploadBadgeHtml`, `connectivityBarHtml`, `esc`).
- **`src/ui/styles.css`** — all styles, including the light/dark theme (`data-theme="dark"`).
- **`src/ui/imageViewer.js`** — fullscreen scrollable reference image gallery; hard-codes vegetation image paths and titles per level.

Event handling is **delegated** from a single root listener in `src/main.js`:
- `onInput` for text/number/range/textarea
- `onChange` for radio/checkbox/select
- `onClick` for `[data-action]` attributes (`add-segment`, `edit-segment`, `duplicate-segment`, `delete-segment`, `upload-segment`, `upload-all`, `view-segment-report`, `share-segment-report`, `copy-segment-report`, `view-ref-images`, `toggle-note`, `print`, `view-report`, `go-home`, `new-session`, `back-to-reports`).

## Upload flow

1. User clicks **Upload** or **Upload All** in the report list.
2. `handleAction` in `src/main.js` dispatches to `uploadSegment(seg, btn)` or `uploadAllSegments(btn)`.
3. For each segment: `buildSegmentReportData(...)` → `segmentReportText(...)` → `segmentUploadPayload(...)` → `fetch(UPLOAD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })`.
4. Status updates: `seg.upload_status` toggles between `none` / `uploaded` / `updated` / `failed` and the per-segment badge re-renders.
5. CORS errors are explicitly surfaced as "server unreachable or CORS blocked".

The Worker itself is **outside this repo**; its source lives in a separate Cloudflare project. Not relocated yet — that's a later migration stage.

## Cloudflare Pages prep

- **`_headers`** at repo root configures cache rules:
  - `service-worker.js` → `no-cache, no-store, must-revalidate` + `Service-Worker-Allowed: /`
  - `manifest.webmanifest` → 5-min revalidate + `Content-Type: application/manifest+json`
  - `index.html` and `/` → `no-cache, must-revalidate`
  - `/config/*`, `/package.json` → 5-min revalidate
  - `/assets/*` → 1-day cache
  - `/src/*` → 1-hour cache
- **No `_redirects`** — hash routing means every URL hits `index.html` automatically.
- **No build step.** Cloudflare Pages settings: build command = none, output directory = `/`, production branch = `main`.
- **No env vars** for the frontend.
- See `docs/CLOUDFLARE_PAGES_SETUP.md` for the project-creation runbook.

## Tests

- **`tests/podEngine.test.js`** — 20 tests against the real v3 exports (`computePOD`, `responseMultiplier`, `responseComponents`, `spacingForTargetPOD`, `generateQaWarnings`).
- **`tests/v3-sanity.test.js`** — 28 sanity tests that re-implement the POD math inline (no engine imports) to pin the formula.
- **Total:** 48/48 passing as of last refresh.
- **Runner:** `node --test` (no test framework dependency).

---

## Future direction (not yet implemented)

These are documented direction, not current reality. Don't assume any of this exists when reasoning about the codebase.

### Likely monorepo target
```
apps/
  web/          # current PWA, moved here verbatim
  desktop/      # future desktop command app (separate repo today)
worker/         # Cloudflare Worker (outside this repo today)
packages/
  core/         # pure POD math + report builders
  shared/       # canonical payload types, segmentKey, label maps
```

What would move where:
- `packages/core` ← `src/model/podEngine.js`, `src/model/reportData.js`, `src/utils/math.js`, `src/utils/simpleYaml.js`, the pure half of `src/model/configLoader.js`.
- `packages/shared` ← upload payload type, `segmentKey`, label maps from `reportData.js`, canonical schemas.
- `apps/web` ← `src/ui/`, `src/storage/db.js` (browser IndexedDB), the routing/event-delegation half of `src/main.js`, `index.html`, `manifest.webmanifest`, `service-worker.js`, `assets/`, `config/`.
- `worker/` ← upload Worker source, when it gets relocated.

**Do not start this restructuring without explicit direction.** See `docs/FUTURE_ARCHITECTURE_NOTES.md` for the full forward-looking principles, especially: "the server is a convenience/sync layer, not a dependency".

### Stage 3+ migration
- Co-locate the Worker on the same Cloudflare zone so `UPLOAD_ENDPOINT` becomes the relative `/api/reports` and CORS goes away.
- Add portable JSON export (copy / download / share) and import (paste / file) on the phone.
- Add an offline upload queue with idempotent server upserts keyed on `report_id` + `segment_key`.

None of this is built yet. See `docs/REPO_CONTEXT_FOR_CLOUDFLARE_MIGRATION.md` §8 (if present in the working tree or zip) for the staged plan; otherwise refer to `docs/FUTURE_ARCHITECTURE_NOTES.md`.
