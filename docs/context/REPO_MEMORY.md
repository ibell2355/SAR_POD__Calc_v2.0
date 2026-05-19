# REPO_MEMORY

Persistent core memory for the **SRPOD / PSAR POD Field Assistant** project. Read this immediately after `START_HERE_FOR_GPT.md`. Everything below is current as of the last context refresh — if Ian indicates the repo has changed, request a refresh via `UPDATE_CONTEXT_PACKAGE_PROMPT.md`.

---

## Project

- **Name:** SAR PoD Calculator v3 (a.k.a. PSAR POD Field Assistant, "SRPOD").
- **Purpose:** Offline-first PWA that helps SAR (Search and Rescue) field teams compute Probability of Detection (POD) per segment, write structured reports, and upload reports to a command-side server. Designed to be usable on a phone in the field with no signal.
- **Repo path:** `C:\Users\ianbe\OneDrive\Custom Programs\SAR_POD_Calc_v3.0`
- **Git remote:** `https://github.com/ibell2355/SAR_POD__Calc_v2.0.git` — **still points at the v2-named GitHub repo**. Ian has not renamed the GitHub repo yet. The local working folder was copied from v2 and renamed v3.

## App type

- Vanilla **HTML + ES modules + CSS**.
- **No framework** (no React/Vue/Svelte).
- **No bundler** (no Vite/Webpack/Rollup).
- **No build step.** The repo root is the deployable artifact.
- **No npm dependencies.** `package.json` declares scripts only; `package-lock.json` confirms zero deps.
- **Offline-first PWA** with a service worker and a web app manifest.

## Run locally

```
npm install   # no-op; no dependencies
npm run start # serves the repo root at http://localhost:4173 via py -3 -m http.server
```

A Windows `run.bat` does the same with port hygiene.

## Tests

- **Command:** `npm test` → `node --test`
- **Files:** `tests/podEngine.test.js` (20 tests against real v3 engine exports), `tests/v3-sanity.test.js` (28 inline-math sanity tests).
- **Last known status:** **48/48 pass.**
- The previous stale v2 `podEngine.test.js` was rewritten in a prior session — see `CHANGELOG_CONTEXT.md`.

## Deployment

- **History:** previously hosted on GitHub Pages from `main` → `/(root)`. The GitHub Pages URL is approximately `https://ibell2355.github.io/SAR_POD__Calc_v2.0/`.
- **Stage 1 Cloudflare Pages prep: complete.** The repo is ready to be served by Cloudflare Pages from the repo root with no build step. Ian has not yet connected the Cloudflare Pages project in the dashboard.
- **`_headers` file:** present at repo root. Configures `Cache-Control: no-cache` on `service-worker.js` and `index.html`, short revalidating cache on `manifest.webmanifest` (with correct `Content-Type: application/manifest+json`), revalidating cache on `/config/*` and `/package.json`, longer cache on `/assets/*` and `/src/*`.
- **No `_redirects` file.** Not needed — the app uses hash routing, so every URL hits `index.html` naturally.
- **Service worker cache name:** `psar-pod-v19-cf-launch` (in `service-worker.js` and the inline cache-eviction snippet in `index.html` — these two strings must stay synchronized).
- **Upload endpoint:** `https://little-river-e034.ian-bell-personal.workers.dev/api/reports` — hard-coded at `src/main.js:18`. **Unchanged from v2.** Intentionally absolute through Stage 1; will become `/api/reports` (same-origin) only after Stage 3 co-locates the Worker.

## Data and storage

- **In-memory state:** `state = { session, searchLevel, segments }` in `src/main.js`.
- **Persistent storage:** **IndexedDB.**
  - Database: `sar-pod-db`
  - Object store: `kv`
  - Session key: `session`
  - Wrapper: `src/storage/db.js` (`getValue`, `setValue`, `clearAll`).
- **Legacy `localStorage` migration path:** `sar_v2_session` is read once on first launch and then deleted. This is the one-way import path for users who installed v2.
  - **DO NOT rename or remove this key.** Removing it silently abandons any v2-installed user's data on first v3 launch. References: `src/main.js:443`, `src/main.js:637`, `src/main.js:640`.
- **Theme preference:** `localStorage` key `psar-theme`.
- **Save behavior:** 250 ms debounce after any input change.

## Report and upload model

- **Single source of truth:** `buildSegmentReportData(state, segment, generatedAt)` in `src/model/reportData.js` produces a structured object used by both the report renderer and the upload payload builder.
- **Plain-text report:** `segmentReportText(data)` in the same file.
- **Upload payload:** `segmentUploadPayload(data, reportText, persistentReportId)` in the same file.
- **Stable identity for dedup/update:**
  - `report_id` — assigned when the segment is first created (`'rpt-' + uid()`), persists for the life of the segment.
  - `segment_key` — slugified segment name, produced by `segmentKey(name)` in `reportData.js`.
  - **Contract:** same `report_id` + same `segment_key` = idempotent re-upload of the same report; different `report_id` + same `segment_key` = new report for the same conceptual segment.
- **POD math:** `computePOD({ config, searchLevel, segment })` in `src/model/podEngine.js`. Spacing-based model: `POD = clamp(1 - exp(-W_eff / spacing), 0, 0.99)`.
- **Tuning lives in YAML:** `config/SAR_POD_V3_config.yaml`. Loaded at runtime by `src/model/configLoader.js`. Parsed by an in-browser YAML parser at `src/utils/simpleYaml.js`.

## Important docs in this repo

- `docs/PSAR_POD_Field_Assistant_ChangeLog.md` — **canonical user-facing changelog.** Update after meaningful user-facing changes.
- `docs/CLOUDFLARE_PAGES_SETUP.md` — Cloudflare Pages setup runbook.
- `docs/FUTURE_ARCHITECTURE_NOTES.md` — principles for later phases (server is sync layer, portable JSON, desktop import, etc.).
- `docs/context/` — this folder. The GPT context package.
- *(Not currently present)* `docs/REPO_CONTEXT_FOR_CLOUDFLARE_MIGRATION.md` and `docs/V3_RENAME_PREFLIGHT_AUDIT.md` were created in earlier sessions but are not currently in the working tree. Git history retains them; they can be restored with `git restore` if needed.

## Known risks and follow-ups

- **Git remote rename pending.** Local folder is v3 but origin is v2. Audit recommendation was to rename the GitHub repo *before* connecting Cloudflare Pages so the Pages project is tied to the right name from day one.
- **Cloudflare Pages project not yet created in the dashboard.** Repo is prep-complete; Ian still needs to log into `ian.bell.personal@gmail.com` and run through `docs/CLOUDFLARE_PAGES_SETUP.md`.
- **Worker CORS allowlist may need updating** when the frontend's origin moves from `*.github.io` to `*.pages.dev` (or a custom domain).
- **PWA reinstall on new domain.** Users with the GitHub Pages install will not auto-migrate to the Cloudflare hostname.
- **Dead V2 yaml fallbacks in `src/model/configLoader.js`** — harmless (V3 wins first), optional cleanup.
- **Three v2 historical doc files (`SAR_POD_PWA_V2_Roadmap.md`, `Search Survey .txt`, `Segment Survey.txt`) currently show as deleted in `git status`** but were not removed by Claude Code. They can be restored from HEAD if their absence was unintentional.

## DO NOT CHANGE WITHOUT EXPLICIT DIRECTION

These are load-bearing. Touch them only when Ian's request makes the conflict explicit:

- **POD math** in `src/model/podEngine.js`.
- **Report calculation logic** in `src/model/reportData.js`.
- **Report payload structure / field names** in `segmentUploadPayload(...)`.
- **IndexedDB schema** (database name `sar-pod-db`, store `kv`, key `session`) and storage wrapper `src/storage/db.js`.
- **Upload endpoint** at `src/main.js:18`.
- **Service worker fetch strategy** in `service-worker.js`. Cache name bumps are fine; behavior changes need a reason.
- **`sar_v2_session` localStorage migration path.** Never rename, never remove.
- **No secrets, no API keys, no tokens, no Cloudflare credentials in the repo.**
- **No restructuring into apps/web, apps/desktop, worker, packages/core, packages/shared yet.**
- **No Vite, React, TypeScript, Tauri, Electron, or workspaces yet.**
- **No moving Worker source into this repo yet.**
- **No replacing the manual Upload / Upload All buttons with auto-upload yet.**
