# Release Notes

## 2026-06-01

### Pilot: Day 8-30 Expansion

- Extended the Pilot timeline from 15 days to 30 days.
- Added Day 16 through Day 30 checkpoint logic with status transitions (`IN PROGRESS`, `HOLD`, `PASS`).
- Expanded the Pilot UI to show the longer trust, repeatability, scale, and release-readiness path.
- Included Day 8-30 checkpoint sections in the generated Pilot Report output.
- Updated sidebar label from `15-Day Pilot` to `30-Day Pilot`.
- Added test coverage to validate the 30-day checkpoint rendering and report inclusion.

### Validation

- Focused tests: `src/pages/Pilot.test.js` (pass)
- Frontend tests: full changed-suite run via Node 20 helper script (pass)

## 2026-05-31

### Pilot: Day 8-15 Expansion

- Extended the Pilot timeline from 14 days to 15 days.
- Added Day 8 through Day 15 checkpoint logic with status transitions (`IN PROGRESS`, `HOLD`, `PASS`).
- Added Day 8-15 checkpoint cards to the Pilot UI for daily trust, execution, and readiness tracking.
- Included Day 8-15 checkpoint sections in the generated Pilot Report output.
- Updated sidebar label from `14-Day Pilot` to `15-Day Pilot`.
- Added test coverage to validate Day 8-15 checkpoint rendering and report inclusion.

### Validation

- Focused tests: `src/pages/Pilot.test.js` (pass)
- Frontend tests: full changed-suite run via Node 20 helper script (pass)
