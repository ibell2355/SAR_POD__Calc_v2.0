# SAR PoD Calculator v2.0 (Offline-First PWA)

## Overview
This app provides a one-page SAR PoD workflow with:
- Search-level mission-stable survey
- Segment-level dynamic survey
- YAML-driven PoD calculation
- Multi-user profiles on one device/browser
- Offline-first behavior with service worker + local persistence

## Local run
1. Install deps: `npm install`
2. Run dev static server: `npm run start`
3. Open `http://localhost:4173`

## Windows one-click run
- Double-click `run.bat` from File Explorer, or run it in Command Prompt.
- On first run it installs dependencies, then starts the app at `http://localhost:4173`.

## Deploy (GitHub Pages friendly)
- Static files are served from repo root.
- Ensure Pages publishes this branch/folder.

## Edit tuning values
- Primary config: `config/SAR_POD_V2_config.yaml`
- Schema: `config/config.schema.json`
- If config fails validation, app surfaces readable diagnostics and falls back to `config/defaults.js`.

## Offline behavior
- On first online load, app shell and config are cached.
- Next loads continue offline via service worker cache.
- Data writes continue offline in IndexedDB (with localStorage fallback).

## Surveys and key mapping
UI labels remain aligned with survey docs:
- `docs/Search Survey .txt`
- `docs/Segment Survey.txt`

Mapping table for code keys:
- "Critical spacing (meters)" -> `critical_spacing_m`
- "Area coverage (%)" -> `area_coverage_pct`

## Export/import
- JSON export/import for full profile backup/transfer.
- CSV export for per-segment PoD logs.

## Testing
Run: `npm test`
