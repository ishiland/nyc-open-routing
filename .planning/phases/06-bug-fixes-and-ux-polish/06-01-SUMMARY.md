---
phase: 06-bug-fixes-and-ux-polish
plan: 01
subsystem: ui
tags: [react, mui, layout, accessibility, maplibre]

# Dependency graph
requires: []
provides:
  - Collapse button repositioned below TitleBar, no longer overlapping info button
  - MapControls renders disabled placeholders immediately, no flash on load
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render disabled placeholders instead of null for async-dependent UI controls"

key-files:
  created: []
  modified:
    - client/src/components/layouts/AdaptiveLayout.tsx
    - client/src/components/controls/MapControls.tsx

key-decisions:
  - "top:48 for collapse button (40px TitleBar height + 8px gap)"
  - "Disabled Fabs with 50% opacity as map loading placeholder instead of null return"

patterns-established:
  - "Disabled placeholder pattern: render controls immediately with disabled state, enable when dependency loads"

# Metrics
duration: 1min
completed: 2026-02-13
---

# Phase 6 Plan 1: Bug Fixes - Collapse Button Overlap and Map Controls Flash Summary

**Repositioned sidebar collapse button below TitleBar (top:48) and replaced MapControls null guard with disabled placeholder buttons to eliminate pop-in**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-13T14:49:29Z
- **Completed:** 2026-02-13T14:50:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Collapse button now renders at top:48 (8px below TitleBar bottom edge), fully clearing the InfoModal button
- MapControls renders disabled zoom buttons immediately on page load with 50% opacity
- Zoom buttons transition to full opacity and become interactive once the map instance loads
- No TypeScript errors, all 31 existing tests pass, no new lint issues

## Task Commits

Each task was committed atomically:

1. **Task 1: Reposition collapse button below TitleBar** - `e14bed9` (fix)
2. **Task 2: Render disabled MapControls before map loads** - `418db5f` (fix)

## Files Created/Modified
- `client/src/components/layouts/AdaptiveLayout.tsx` - Changed collapse IconButton top from 8 to 48
- `client/src/components/controls/MapControls.tsx` - Removed null guard, added disabled/opacity states for both Fab buttons

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BUG-01 and MAP-01 are resolved
- Ready for plan 02 (next bug fixes in phase 6)
- No blockers or concerns

## Self-Check: PASSED

- [x] AdaptiveLayout.tsx exists and contains `top: 48`
- [x] MapControls.tsx exists and contains `disabled` props
- [x] MapControls.tsx no longer contains `return null`
- [x] Commit e14bed9 exists in git log
- [x] Commit 418db5f exists in git log
- [x] 06-01-SUMMARY.md created

---
*Phase: 06-bug-fixes-and-ux-polish*
*Completed: 2026-02-13*
