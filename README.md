# SAR PoD Calculator v2.0 (Offline-First PWA)

## Overview
This app now follows the prior PSAR POD Calculator UX flow while preserving SAR v2 logic:
- Landing page with Session + Segments cards and bottom action row
- Segment edit page opened from “Add segment”
- Report page with detailed debug math per target/segment
- YAML-driven calculations from `config/SAR_POD_V2_config.yaml`
- Offline-first behavior with service worker + local session persistence

## Local run
1. Install deps: `npm install`
2. Run dev static server: `npm run start`
3. Open `http://localhost:4173`

## Edit tuning values
- Primary config: `config/SAR_POD_V2_config.yaml`
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
- App shell + config cached by service worker.
- Session/search/segments are autosaved in localStorage key `sar_v2_session`.
- “New session (Clear)” wipes all current session data.

## Testing
Run: `npm test`
