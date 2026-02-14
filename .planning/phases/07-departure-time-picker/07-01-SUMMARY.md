---
phase: 07-departure-time-picker
plan: 01
subsystem: ui
tags: [react, mui, departure-time, traffic, select]

# Dependency graph
requires:
  - phase: RoutingContext (pre-existing)
    provides: trafficHour, trafficDayOfWeek state with localStorage persistence
provides:
  - DepartureTimePicker UI component for day/hour selection
  - Sidebar integration rendering picker after TrafficToggle
affects: [08-departure-time-api]

# Tech tracking
tech-stack:
  added: []
  patterns: [compact control component with internal visibility logic, three-state UI (default/expanded/summary)]

key-files:
  created:
    - client/src/components/controls/DepartureTimePicker.tsx
  modified:
    - client/src/components/ControlsContainer.tsx

key-decisions:
  - "Three-state UI: 'Now' default, expanded selectors, 'Leave at Day Time' summary with clear button"
  - "Used MUI Select variant='standard' for minimal visual footprint matching existing compact controls"

patterns-established:
  - "Compact control with expand/collapse: default row -> inline selectors -> summary with clear"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 7 Plan 1: Departure Time Picker Summary

**Compact day/hour departure time picker with three-state UI (Now/expanded selectors/summary) wired into sidebar controls**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T13:50:15Z
- **Completed:** 2026-02-14T13:51:59Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created DepartureTimePicker component with three distinct states: "Depart: Now" default, expanded day/hour selectors, and "Leave at [Day] [Time]" summary
- Integrated picker into ControlsContainer between TrafficToggle and FerryToggle
- Component auto-hides when mode is not drive or traffic is disabled
- Full accessibility with role="group" and aria-labels on all interactive elements

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DepartureTimePicker component** - `d885a0f` (feat)
2. **Task 2: Wire DepartureTimePicker into ControlsContainer** - `9810524` (feat)

## Files Created/Modified
- `client/src/components/controls/DepartureTimePicker.tsx` - Compact departure time picker with day (Mon-Sun) and hour (12AM-11PM) selection
- `client/src/components/ControlsContainer.tsx` - Added DepartureTimePicker import and render after TrafficToggle

## Decisions Made
- Three-state UI pattern (Now -> expanded -> summary) for compact space usage, matching the minimalist inline style of TrafficToggle and FerryToggle
- Used MUI Select with variant="standard" (no border) for visual compactness
- "Done" text button in expanded state to collapse back to summary after selection, plus close/reset button to return to "Now"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DepartureTimePicker is fully functional and integrated into the sidebar
- All existing plumbing (RoutingContext state, localStorage persistence, API param passing via useRouteFetch/useIsochroneFetch, URL sync via useRouteStateSync) connects automatically
- Route auto-recalculates when day/hour values change (handled by existing ButtonControls effect)

## Self-Check: PASSED

- FOUND: client/src/components/controls/DepartureTimePicker.tsx
- FOUND: commit d885a0f
- FOUND: commit 9810524

---
*Phase: 07-departure-time-picker*
*Completed: 2026-02-14*
