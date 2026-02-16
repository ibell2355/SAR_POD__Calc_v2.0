# Migration Notes (Legacy -> SAR PoD v2)

## Survey flow changes
- Removed modal/start-survey button workflow.
- Added always-visible inline controls in one-page layout.
- Search survey pinned at top; segment + results below.

## Field/key migrations
- `actual_spacing_m` -> `critical_spacing_m`
- `searched_fraction` + `inaccessible_fraction` removed.
- Completion multiplier now: `M_comp = clamp(area_coverage_pct / 100, 0, 1)`.

## Persistence migration
- Data now stored per profile in IndexedDB store `profiles`.
- localStorage fallback key: `sar_fallback_profiles`.
- Active profile pointer key: `sar_active_profile`.

## Config migration
- Canonical config: `config/SAR_POD_V2_config.yaml`.
- Schema validation file: `config/config.schema.json`.
- Emergency fallback only: `config/defaults.js`.
