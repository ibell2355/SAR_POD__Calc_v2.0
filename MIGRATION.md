# Migration Notes (Legacy -> SAR PoD v2)

## UX flow migration
- Restored legacy-style PSAR flow:
  - Landing page with Session card + Segments card + bottom actions.
  - Segment edit page accessed via “Add segment” or segment row.
  - Dedicated report view with print/back controls.
- Removed profile switcher UI and profile creation workflow.
- Removed model selector and profile button from header.

## Field/key migrations
- `actual_spacing_m` -> `critical_spacing_m`
- `searched_fraction` + `inaccessible_fraction` replaced by `area_coverage_pct`
- Completion multiplier now: `M_comp = clamp(area_coverage_pct / 100, 0, 1)`

## Storage migration
- Session state is now unified under localStorage key `sar_v2_session`.
- Autosave is triggered on all edits.
- Clearing session removes all active data.

## Reporting migration
- Report output now includes:
  - Session summary
  - Per-segment POD output
  - Human-readable input summary
  - Full numeric substitution lines for debugging calculations
