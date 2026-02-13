---
phase: 06-bug-fixes-and-ux-polish
plan: 02
subsystem: ui
tags: [react, hooks, useRef, url-sync, deep-link, empty-state, mui]

# Dependency graph
requires:
  - phase: none
    provides: n/a
provides:
  - Race-condition-free URL state sync with isInitialized ref guard
  - Empty state hint in RouteList when no route is calculated
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isInitialized ref guard pattern to prevent URL update effect from racing with URL init effect"

key-files:
  created: []
  modified:
    - client/src/hooks/useRouteStateSync.ts
    - client/src/components/controls/RouteList.tsx

key-decisions:
  - "Used queueMicrotask to set isInitialized after React processes state batch from init effect"
  - "Used Directions icon from @mui/icons-material for visual cue in empty state"

patterns-established:
  - "Ref guard pattern: use useRef(false) + queueMicrotask to coordinate effect ordering"

# Metrics
duration: 2min
completed: 2026-02-13
---

# Phase 6 Plan 2: Deep Link Race Fix and Empty State Hint Summary

**isInitialized ref guard in useRouteStateSync to prevent deep link mode overwrite, plus Directions icon empty state hint in RouteList**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-13T14:49:31Z
- **Completed:** 2026-02-13T14:51:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed BUG-02: deep link mode parameter race condition where URL update effect overwrote mode from URL init effect
- Added SB-02: contextual empty state hint with Directions icon and instructional text when no route is calculated
- All TypeScript compilation, tests (31/31), and lint checks pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isInitialized guard to useRouteStateSync** - `796d5ef` (fix)
2. **Task 2: Add empty state hint to RouteList** - `b4a39ce` (feat)

## Files Created/Modified
- `client/src/hooks/useRouteStateSync.ts` - Added useRef isInitialized guard, queueMicrotask in init effect, early return in URL update effect
- `client/src/components/controls/RouteList.tsx` - Added Directions icon import, replaced null with centered empty state hint box

## Decisions Made
- Used queueMicrotask (not setTimeout) to set the isInitialized flag -- ensures the flag is set after React processes the state batch but before the next effect cycle, without introducing a full macrotask delay
- Placed Directions icon import with other @mui absolute imports to satisfy eslint import ordering rules

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Deep link mode parameter is now correctly preserved on load
- Empty sidebar provides onboarding guidance for new users
- Ready for remaining Phase 6 plans (06-03)

## Self-Check: PASSED

- All modified files exist on disk
- All commit hashes verified in git log

---
*Phase: 06-bug-fixes-and-ux-polish*
*Completed: 2026-02-13*
