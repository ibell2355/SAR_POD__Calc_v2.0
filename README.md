# SAR PoD Calculator v3 (Offline-First PWA)

## Overview
This app follows the PSAR POD Calculator UX flow with the v3 spacing-based POD model:
- Landing page with Session + Segments cards and bottom action row
- Segment edit page opened from “Add segment”
- Report page with detailed debug math per target/segment
- YAML-driven calculations from `config/SAR_POD_V3_config.yaml`
- Offline-first behavior with service worker + IndexedDB session persistence

## Local run
1. Install deps: `npm install`
2. Run dev static server: `npm run start`
3. Open `http://localhost:4173`

## Deployment
The app can be deployed to **Cloudflare Pages** as a static site (no build step). See [docs/CLOUDFLARE_PAGES_SETUP.md](docs/CLOUDFLARE_PAGES_SETUP.md) for the setup walkthrough. It can also still be served from GitHub Pages from the repo root, and the two deployments can run side-by-side during a rollout.

## Edit tuning values
- Primary config: `config/SAR_POD_V3_config.yaml`
- Schema: `config/config.schema.json`
- If config fails validation, app surfaces diagnostics and falls back to `config/defaults.js`.

## Surveys and key mapping
UI labels remain aligned with survey docs:
- `docs/Search Survey .txt`
- `docs/Segment Survey.txt`

Mapping table for code keys:
- `actual_spacing_m` -> `critical_spacing_m`
- `searched_fraction` + `inaccessible_fraction` -> `area_coverage_pct`
- Completion multiplier: `M_comp = clamp(area_coverage_pct / 100, 0, 1)`

## Persistence and offline
- App shell + config cached by service worker (cache name `psar-pod-v19-cf-launch`).
- Session/search/segments are autosaved to **IndexedDB** (database `sar-pod-db`, store `kv`, key `session`).
- The legacy `localStorage` key `sar_v2_session` is read once on first launch and then deleted, so users upgrading from v2 keep their data. **Do not rename or remove this legacy key** — it is the one-time migration path.
- “New session (Clear)” wipes all current session data.

## Testing
Run: `npm test`
