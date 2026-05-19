# APP_CAPABILITIES

What the SAR PoD Calculator v3 currently does, from a user's point of view. Pair this with `ARCHITECTURE_OVERVIEW.md` (technical layout) and `REPO_MEMORY.md` (state of record).

---

## What it is

A field-side **Progressive Web App** (PWA) for SAR teams. A searcher or team leader opens it on a phone, enters the conditions on the ground for a search segment, gets a Probability of Detection (POD) number, and writes a structured report. The app is offline-first: it loads from the home screen with no signal and continues to compute and save.

---

## Session and search setup

On the landing page (`#/`), the user fills in:

- **Your Name**
- **Search Name** (with a note not to include case numbers or subjects' names)
- **Team Name**

Plus a **Search Details** card with search-level inputs that apply to every segment in this session:

- **Search For:** Missing Person, Historical, or Article/Evidence
- **Visibility:** Low, Medium, or High (how visible the target is expected to be)
- **Auditory Responsiveness** (missing-person only): Not Expected, Possible, Likely
- **Visual Responsiveness** (missing-person only): Expected to Evade, Not Expected, Possible, Likely

A live **Save indicator** shows when the session is being persisted (debounced, 250 ms).

A **connectivity pill** above the cards shows "Online / Offline ready" or "Offline" and a short reassurance message when offline.

A **New Session (Clear All Data)** button wipes the session (with a confirm prompt). This clears both the IndexedDB session and any legacy `sar_v2_session` localStorage entry.

---

## Segments — create, edit, duplicate, delete

The **Segments** card on the landing page lists all segments and their current POD value.

Actions:

- **Add Segment** — creates a new segment with sane defaults and opens its editor at `#/segment/<id>`.
- **Edit Segment** — opens an existing segment for editing.
- **Duplicate Segment** — copies all values (including notes) into a new segment. Duplicates reset to `Unnamed`, get fresh IDs and creation metadata, and are flagged "Not uploaded".
- **Delete Segment** — confirms then removes.

Inside a segment editor, the user adjusts:

- **Segment name**
- **Number of searchers**
- **Actual spacing (m)** — the spacing actually used in the field between searchers
- **Time of Day:** Day / Dusk-Dawn / Night
- **Weather:** Clear / Raining / Snowing
- **Vegetation Density** (1–5, with reference image set)
- **Micro-terrain Complexity** (1–5)
- **Extenuating Factors** (1–5; missing-person flow)
- **Burial / Cover** (1–5; historical / article-evidence flow)
- **Per-factor notes** (free text) and a top-level **Segment Note**

The editor also shows live helper readouts:

- **Spacing helpers:** "63% POD: X m" and "83% POD: Y m" — the spacings that would hit those POD values given the current W_eff.
- **POD result** updates as inputs change.

---

## POD calculation

The POD model is **spacing-based**:

```
W_eff = clamp(base_sweep_width * K_visibility * K_time * K_weather * K_veg * K_terrain * K_ext_or_burial * M_resp, w_eff_min, w_eff_max)
coverage_factor = W_eff / clamp(actual_spacing_m, spacing_lower_limit, spacing_upper_limit)
POD = clamp(1 - exp(-coverage_factor), 0, 0.99)
```

- Tuning lives in `config/SAR_POD_V3_config.yaml` (`base_sweep_width_m` per search type, condition factors per axis, spacing limits per veg level, visibility lower-limit adjustment, response model with auditory/visual multipliers and a max cap).
- The cap at **0.99** is enforced — the app never shows POD = 100%.
- **Response multipliers** (`auditory_multiplier` × `visual_multiplier`, capped at `max_total_multiplier`) apply only to missing-person searches.
- **Coefficient impact** is computed per factor: "what would POD be if this factor were neutral?" — surfaced in the report.

---

## Reference image gallery

Vegetation-density levels 1–5 each have a set of 4 reference photos (`assets/Vegetation density/`). From the segment editor, the user can tap to open a fullscreen scrollable viewer (`src/ui/imageViewer.js`) to compare actual conditions against the labelled reference set. Other axes (micro-terrain complexity, etc.) have placeholders but no shipped images yet.

All reference images are **pre-cached by the service worker** so the gallery works offline.

---

## Reports

Two report views:

### Report list (`#/reports`)
Per-segment cards showing:
- Segment name
- Current POD badge
- Upload status badge: **Not uploaded** / **Uploaded** / **Updated since upload** / **Upload failed**
- Per-segment actions: **View Report**, **Share**, **Copy Report**, **Upload**
- An **Upload All** button at the top to sequentially upload every segment

### Single segment report (`#/report/<id>`)
A formatted report view rendered from `buildSegmentReportData(...)` showing:
- Search information block (your name, search name, team name, search for, visibility, auditory/visual responsiveness where applicable)
- Segment block with all factors, each annotated with that factor's POD impact (e.g. `+1.5% POD`, `-3.2% POD`)
- Per-factor notes inline
- Effective sweep width, coverage factor
- Final POD percentage
- A **Print** button that opens all detail sections and triggers the browser print dialog

### Sharing and copying
Each segment report can be:
- **Copied to clipboard** as plain text via `segmentReportText(...)`
- **Shared** via `navigator.share` if available, otherwise falls back to clipboard copy

---

## Upload behavior (manual, foreground only)

The user explicitly presses **Upload** (per segment) or **Upload All** (sequential). Each upload:

1. Builds the structured payload via `segmentUploadPayload(...)` — includes `report_id`, `segment_key`, structured search/segment inputs with per-factor coefficient impacts, the final POD, and the plain-text report body.
2. POSTs the JSON to the Cloudflare Worker at `https://little-river-e034.ian-bell-personal.workers.dev/api/reports`.
3. On 2xx → segment badge flips to **Uploaded**; toast "Upload successful".
4. On non-2xx or network error → badge flips to **Upload failed**; toast surfaces the status and any server-side error detail. CORS errors are reported explicitly ("server unreachable or CORS blocked").
5. Any subsequent edit to an uploaded segment flips its badge to **Updated since upload** so the user knows to re-upload.

There is **no background sync, no offline upload queue, no automatic retry** today. Uploads only happen when the user taps a button.

---

## Offline / PWA behavior

- The service worker (`service-worker.js`) pre-caches the app shell, CSS, JS modules, manifest, icons, runtime YAML config, vegetation reference images, and `package.json`.
- Cache name is bumped on releases (currently `psar-pod-v19-cf-launch`). The inline cache-eviction snippet at the top of `index.html` deletes any other cache name on load — this is the manual cache-bust lever.
- HTML navigation: network-first, falls back to cached `index.html` offline.
- Same-origin assets: network-first, falls back to cache offline.
- Cross-origin requests (notably the upload endpoint): network-only — no caching, never replayed.
- On `localhost` / `127.0.0.1`, the service worker is intentionally **not** registered (dev mode).
- The PWA is installable on Android Chrome and iOS Safari via "Add to Home Screen". Standalone display, theme color `#183859`, icons in `assets/`.
- A **stale-cache fallback UI** in `index.html` shows a "fresh reload" notice if the main module fails to load within 3 seconds.

---

## Version and build stamp

- App version comes from `package.json` (currently `3.1.1`, build date `2026-03-20`).
- A footer build stamp shows version + build date.
- A header subtitle shows "Random Search Model · (v<version>)".
- A `npm run stamp` script rewrites `buildDate` to today's date.

---

## What the app does NOT yet do

- **No automatic / background upload.** Uploads only happen on explicit button press.
- **No offline upload queue.** If you press Upload offline, it fails immediately; pending edits are not queued for later transmission.
- **No portable JSON export from the UI.** There's no "download report as .json" or "copy JSON to clipboard" button yet, even though the structured payload exists internally. (See `FUTURE_ARCHITECTURE_NOTES.md` §2 — this is on the roadmap.)
- **No `.json` file import.** The phone app cannot ingest a JSON report package from another device.
- **No desktop command app integration.** The desktop app is planned but lives in a separate repo and has not been built yet.
- **No same-origin Cloudflare Worker.** The upload endpoint is still the absolute `*.workers.dev` URL. Stage 3 of the migration would co-locate the Worker so uploads go to `/api/reports` and CORS goes away.
- **No multi-target / per-target POD.** v3 collapsed the v2 target hierarchy (adult / child / large-clues / small-clues / intact-remains / etc.) into one POD per segment, driven by `search_for` only.
- **No `area_coverage_pct` input or completion multiplier.** v3 removed v2's completion-multiplier concept.
- **No QA-spacing-too-low warning.** v3 warns only when spacing is missing/zero, larger than `warn_if_spacing_m_gt` (default 50 m), or num_searchers is zero.
- **No authentication on uploads.** The Worker accepts unauthenticated POSTs.
- **No PDF export.** Print-to-PDF works via the browser's print dialog.
- **No analytics, no telemetry.**

---

## Visible-text quick reference

Useful when GPT is asked about UI strings without screenshots:

- Header title: `PSAR POD Field Assistant`
- Header subtitle: `Random Search Model · (v<version>)`
- About overlay bullets:
  - "A field aid to support consistent POD assessment across teams and segments"
  - "Provides a structured way to record conditions, spacing, and POD-related notes for reporting back to command"
  - "Designed to support field judgment, not replace it"
- Offline hint: "No signal detected. Your inputs are safe and can be uploaded when connection returns."
- Stale-cache fallback: "App update requires a fresh reload" with Ctrl+Shift+R guidance and a Reload Now button.
