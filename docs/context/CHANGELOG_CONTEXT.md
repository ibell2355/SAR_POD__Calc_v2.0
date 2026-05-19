# CHANGELOG_CONTEXT

A planning-relevant changelog for GPT. **Not** the user-facing app changelog — that's `docs/PSAR_POD_Field_Assistant_ChangeLog.md` and remains the canonical record of user-visible app behavior changes. This file tracks repo-state and workflow-relevant events so a fresh GPT session can catch up quickly.

Entries are newest-first. Each entry is dated and self-contained.

---

## 2026-05-18 — Context package created

- New folder `docs/context/` created with the GPT context package:
  - `START_HERE_FOR_GPT.md`
  - `REPO_MEMORY.md`
  - `APP_CAPABILITIES.md`
  - `ARCHITECTURE_OVERVIEW.md`
  - `GPT_CLAUDE_WORKFLOW.md`
  - `CHANGELOG_CONTEXT.md` (this file)
  - `CONTEXT_PACKAGE_MANIFEST.md`
  - `UPDATE_CONTEXT_PACKAGE_PROMPT.md`
  - `KNOWN_TERMS.md`
- Purpose: zip this folder, upload into a fresh ChatGPT session, get a planning/review/prompt-building partner that understands the project and the workflow.
- No app behavior was changed. Documentation only.

## 2026-05-18 — Stale v2 test cleanup

- `tests/podEngine.test.js` was rewritten to target real v3 exports (`computePOD`, `responseMultiplier`, `responseComponents`, `spacingForTargetPOD`, `generateQaWarnings`).
- The previous file targeted v2-only symbols (`completionMultiplier`, `inferPrimaryTarget`, `spacingEffectiveness`, `selectedTargets`, `computeForTarget`) that no longer exist in v3.
- 20 new tests added; `tests/v3-sanity.test.js` left in place untouched (28 inline-math sanity tests).
- **`npm test` → 48/48 pass.**
- A header note was added in the rewritten file explaining that v2 behavioral tests were dropped because v3 uses the spacing-based POD model.

## 2026-05-18 — Cross-session file deletions detected

- Three v2 historical docs are showing as deleted in `git status` but were **not** removed by Claude Code in any session:
  - `docs/SAR_POD_PWA_V2_Roadmap.md`
  - `docs/Search Survey .txt`
  - `docs/Segment Survey.txt`
- Possible causes: OneDrive sync (the working folder lives under `OneDrive\Custom Programs\`), manual deletion between sessions.
- The audit had categorized these as "historical, harmless, leave alone".
- Git history retains them. Restore command, if their absence is unintentional:
  ```
  git restore -- "docs/SAR_POD_PWA_V2_Roadmap.md" "docs/Search Survey .txt" "docs/Segment Survey.txt"
  ```
- Also missing from the working tree but created in earlier sessions and present in those sessions' git status:
  - `docs/REPO_CONTEXT_FOR_CLOUDFLARE_MIGRATION.md`
  - `docs/V3_RENAME_PREFLIGHT_AUDIT.md`
  - These were untracked files; if they were never committed, they may be gone from the working copy without recovery via git. If a recovery is needed, ask Claude Code to regenerate them from the current repo state.

## 2026-05-18 — Stage 1 Cloudflare Pages preparation completed

- **`_headers`** added at repo root with cache rules:
  - `service-worker.js`: `Cache-Control: no-cache, no-store, must-revalidate` + `Service-Worker-Allowed: /`
  - `manifest.webmanifest`: 5-min revalidate + `Content-Type: application/manifest+json`
  - `index.html` and `/`: `no-cache, must-revalidate`
  - `/config/*`, `/package.json`: 5-min revalidate
  - `/assets/*`: 1-day cache
  - `/src/*`: 1-hour cache
- **No `_redirects` file** — hash routing means it's not needed.
- **Service worker cache bumped** from `psar-pod-v18` to `psar-pod-v19-cf-launch`. Both references (in `service-worker.js` and in the inline eviction snippet in `index.html`) are synchronized.
- **`README.md` updated** to reflect v3: title fixed (was "v2.0"), config filename references corrected to `SAR_POD_V3_config.yaml`, storage description corrected to IndexedDB with explicit "do not rename `sar_v2_session`" warning, Deployment section added linking to the Cloudflare setup doc.
- **`docs/CLOUDFLARE_PAGES_SETUP.md`** created with project creation steps, CORS reminder, test checklist (app load, hash routes, mobile install, offline, Upload/Upload All), and rollback procedure.
- **`docs/FUTURE_ARCHITECTURE_NOTES.md`** created capturing forward-looking principles: server is sync layer not dependency, portable JSON report package, phone export and desktop import surfaces, canonical payload powering all derived artifacts, `report_id` + `segment_key` as stable identity, future monorepo direction.
- **Upload endpoint intentionally unchanged** — still `https://little-river-e034.ian-bell-personal.workers.dev/api/reports` at `src/main.js:18`. Manual Upload / Upload All behavior preserved exactly. Same-origin migration deferred to Stage 3.
- **Git remote rename pending** — local working folder is `SAR_POD_Calc_v3.0` but `origin` still points at `https://github.com/ibell2355/SAR_POD__Calc_v2.0.git`. Audit recommended renaming the GitHub repo before connecting Cloudflare Pages, but this has not been done.
- **Cloudflare Pages project not yet created in the dashboard.**

## Earlier history (pre-Stage 1)

- **v3 repo copied from v2.** Local folder was renamed; GitHub remote was not. Internal storage moved from `localStorage` to IndexedDB but a one-way migration path reads `sar_v2_session` once and deletes it.
- **POD model rewritten** to spacing-based (`POD = 1 - exp(-W_eff/spacing)`). The v2 hazard-rate calibration, multi-target hierarchy, completion multiplier, and `area_coverage_pct` input were all removed.
- **Config moved** to `config/SAR_POD_V3_config.yaml`. Loader has dead V2 yaml fallbacks (harmless).
- See `docs/PSAR_POD_Field_Assistant_ChangeLog.md` for the user-facing change history.

---

## Pending items to track

- **GitHub repo rename (v2 → v3).** Ian's decision. Recommended to do before Cloudflare Pages is connected.
- **Cloudflare Pages project creation in the dashboard.** Ian's manual step.
- **Worker CORS allowlist update** if the existing Worker has a restricted allowlist (it may need the new Cloudflare Pages origin added).
- **Portable JSON export/import** (phone side) — on the roadmap per `FUTURE_ARCHITECTURE_NOTES.md`, not built.
- **Co-located Worker** (Stage 3) — `UPLOAD_ENDPOINT` becomes `/api/reports` and CORS goes away. Not built.
- **Desktop command app** — separate repo, separate context package. Not yet evaluated from here.
- **Dead V2 yaml fallbacks** in `src/model/configLoader.js` — optional cleanup.

---

## Relationship to `docs/PSAR_POD_Field_Assistant_ChangeLog.md`

- That file is the **user-facing** app changelog. It tracks behavior changes that affect what searchers see and do.
- This file is the **planning-context** changelog. It tracks repo state, deployment state, doc state, workflow state, and known pending items.
- Both should be updated by Claude Code when triggered by `UPDATE_CONTEXT_PACKAGE_PROMPT.md`:
  - **User-facing change?** → update `PSAR_POD_Field_Assistant_ChangeLog.md`.
  - **Repo / workflow / planning state change?** → update this file.
  - **Both?** → both.
