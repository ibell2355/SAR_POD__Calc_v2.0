# KNOWN_TERMS

Glossary of project-specific shorthand. When GPT sees one of these terms in Ian's messages, this is what's meant.

---

## Project names

- **SRPOD** — Ian's shorthand for this project. Same thing as "SAR PoD Calculator" and "PSAR POD Field Assistant". Don't ask which one is "right" — they all refer to the same app.
- **PSAR POD Field Assistant** — the formal in-UI name (shown in the page title and header).
- **SAR PoD Calculator v3** — the package.json name (`sar-pod-calc-v3`).
- **v2 / v3** — the v2 → v3 transition was a model rewrite (multi-target hazard-rate model → single-target spacing-based model). The codebase was copied from v2 and renamed v3; the GitHub repo still has the v2 name.

## Domain terms

- **SAR** — Search and Rescue.
- **POD** — Probability of Detection. The headline number the app computes per segment.
- **Segment** — a discrete piece of ground assigned to a search team. The app computes one POD per segment.
- **Session** — the umbrella over a search effort. Holds team info, search-level inputs (search type, visibility, responsiveness), and all the segments.
- **Search Level** — the inputs that apply across every segment in a session (visibility, auditory responsiveness, visual responsiveness, search type).
- **W_eff** — effective sweep width in meters. Computed from base sweep width times condition factors and the response multiplier, clamped to bounds.
- **C_t** — product of all condition factor coefficients (visibility, time of day, weather, vegetation, micro-terrain, extenuating factors, burial/cover).
- **M_resp** — response multiplier (auditory × visual, capped at `max_total_multiplier`). Applies only to missing-person searches.
- **Coverage factor** — `W_eff / effective_spacing_m`. The exponent in `POD = 1 - exp(-coverage_factor)`.
- **Spacing limits** — per-search-type, per-vegetation-level lower and upper bounds on the spacing actually used in the POD formula. Visibility can adjust the lower bound.
- **Coefficient impact** — for each input factor, how much POD would change if that factor were neutral (1.0). Surfaced as `+X.X% POD` or `-X.X% POD` next to each input in the report.

## Identity / payload terms

- **Report package** — the canonical JSON payload produced by `segmentUploadPayload(...)`. Currently this is the upload body; future direction is for the same payload to also be exportable as a portable file/clipboard text and importable into the desktop command app.
- **`report_id`** — stable identifier assigned when a segment is first created (`'rpt-' + uid()`). Persists for the life of the segment.
- **`segment_key`** — slugified segment name (e.g. "Segment 1" → "segment-1"). Used together with `report_id` for dedup and update handling.
- **Upload status** — one of `none`, `uploaded`, `updated`, `failed`. Drives the per-segment badge.

## Architecture terms

- **Field app / mobile app / phone app / PWA** — all refer to the current web app in this repo. It's installable as a PWA on Android and iOS.
- **Desktop command app** — the planned, not-yet-built command-side app. Will live in its own repo. Will consume report packages and run command-side aggregation/visualization. Must eventually be buildable into a Windows EXE.
- **Server / Worker / upload endpoint** — the Cloudflare Worker at `https://little-river-e034.ian-bell-personal.workers.dev/api/reports`. Its source code is **not** in this repo. The app POSTs report packages to it.
- **Convenience layer / sync layer** — how the server is supposed to be treated: a helpful relay for getting reports from phone to command, never a hard dependency. Field reporting must keep working with the server fully unavailable.
- **Cloudflare Pages** — where the static PWA will be hosted post-migration.
- **Stage 1 / Stage 2 / Stage 3 / ... — Stage 6** — the staged Cloudflare migration plan. Stage 1 = stand up Pages with the existing static SPA, leaving the Worker URL absolute and unchanged. Stage 3 = co-locate the Worker so `UPLOAD_ENDPOINT` becomes `/api/reports`. Stage 6 = event-triggered / offline-queued uploads. See `docs/FUTURE_ARCHITECTURE_NOTES.md` for the principles and `docs/REPO_CONTEXT_FOR_CLOUDFLARE_MIGRATION.md` (when present) for the full plan.

## Storage terms

- **IndexedDB** — primary persistent storage. Database `sar-pod-db`, store `kv`, key `session`.
- **`sar_v2_session`** — legacy `localStorage` key from v2. **Read-once and deleted on first v3 launch.** Never rename, never remove — it's the only migration path for users coming from v2.
- **`psar-theme`** — `localStorage` key for the light/dark theme preference.

## Workflow / tooling terms

- **GPT** — ChatGPT, Ian's planning / review / debugging / prompt-building partner. No live repo access.
- **Claude Code** — the implementation agent that works directly in the repo via the terminal. Has live access to read, write, run commands, and run tests.
- **Context refresh** — running the prompt in `UPDATE_CONTEXT_PACKAGE_PROMPT.md` to bring the `docs/context/` package back into sync with the current repo state.
- **Context package** — the zip of `docs/context/*.md` (plus selected optional docs) that gets uploaded into a fresh GPT chat.
- **Stage 1 prep** — completed work to make the repo deployable on Cloudflare Pages with no behavior change.

## What things are NOT

- **"v2"** is not "version 2 of the app currently being developed." v2 is the prior model, retired. The current app is v3 internally despite the GitHub repo still being named with v2.
- **"droplet"** — earlier prompts referenced a "droplet upload button". There is no DigitalOcean droplet. The upload endpoint is a Cloudflare Worker. The term is legacy.
- **"the server"** is not a single committed-to-this-repo backend. It's a Cloudflare Worker living in a separate Cloudflare project.
- **"area coverage"** / **`area_coverage_pct`** — was a v2 input (completion multiplier). Removed in v3. If Ian mentions it, he might be remembering v2 — ask.
- **"target hierarchy" / "primary target"** — was a v2 concept (per-target POD with hierarchy). Removed in v3. v3 has one POD per segment driven by `search_for`.
