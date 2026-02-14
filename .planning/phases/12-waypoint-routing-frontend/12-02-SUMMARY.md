---
phase: 12-waypoint-routing-frontend
plan: 02
subsystem: ui
tags: [react, typescript, maplibre-gl, waypoints, sidebar, route-display, geojson-layers]

# Dependency graph
requires:
  - phase: 12-01
    provides: WaypointRouteResponse types, RoutingContext waypoint state, useWaypointRouteFetch hook, WaypointSearch component, waypointPointColor
provides:
  - Sidebar Add Stop button and WaypointSearch input rendering between From/To
  - ButtonControls conditional dispatch to waypoint or regular route fetch
  - MapLibreGLMap waypoint circle markers and numbered labels via useGeoJsonLayer
  - Flattened multi-leg route line on map
  - Waypoint layers in CUSTOM_LAYER_ORDER for correct z-ordering
  - Leg-grouped turn-by-turn directions in RouteList
  - RouteSummaryCard using waypointRoute.summary for total distance/time with leg count
affects: [12-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [conditional fetch dispatch based on waypoint presence, useMemo for flattened route features from multi-leg response, three-state rendering in RouteList (waypoint/regular/empty)]

key-files:
  created: []
  modified:
    - client/src/components/Sidebar.tsx
    - client/src/components/controls/ButtonControls.tsx
    - client/src/components/MapLibreGLMap.tsx
    - client/src/utils/mapHelpers.ts
    - client/src/components/controls/RouteList.tsx
    - client/src/components/controls/RouteSummaryCard.tsx

key-decisions:
  - "Swap button disabled (not hidden) when waypoints present for discoverability"
  - "Waypoints inserted between swap button and End input maintaining intuitive top-to-bottom flow"
  - "Route features computed via useMemo flattening waypoint legs into single IMapFeature array for map display"
  - "RouteList uses three-state conditional: waypointRoute -> regular route -> empty state"
  - "RouteSummaryCard computes arrival time inline for waypoint routes rather than adding a new format utility"

patterns-established:
  - "Conditional fetch dispatch: hasValidWaypoints check gates between fetchWaypointRoute and fetchRoute"
  - "Three-state route display: waypoint route, regular route, empty state as cascading ternary"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 12 Plan 02: Waypoint Routing UI Wiring Summary

**Sidebar Add Stop button, conditional waypoint/regular route dispatch, MapLibre waypoint markers with numbered labels, leg-grouped turn-by-turn directions, and waypoint-aware route summary card**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T19:28:01Z
- **Completed:** 2026-02-14T19:32:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Sidebar renders WaypointSearch inputs between From/To with Add Stop button (hidden at 1 waypoint limit)
- ButtonControls conditionally dispatches to waypoint or regular route fetch, with auto-recalculate on mode/traffic/time changes
- MapLibreGLMap renders blue numbered circle markers for waypoints and flattens multi-leg route into single route line
- RouteList groups turn-by-turn directions by leg with headers showing leg label, distance, and travel time
- RouteSummaryCard displays total distance/time from waypointRoute.summary with leg count indicator
- Swap button disabled when waypoints present; Clear button clears all waypoint state

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire Sidebar, ButtonControls, and map layers for waypoints** - `1a9fe70` (feat)
2. **Task 2: Add leg-grouped RouteList and waypoint-aware RouteSummaryCard** - `275a54f` (feat)

## Files Created/Modified
- `client/src/components/Sidebar.tsx` - Added WaypointSearch rendering, Add Stop button, swap button disabled when waypoints present
- `client/src/components/controls/ButtonControls.tsx` - Conditional waypoint/regular fetch dispatch, auto-recalculate with waypoints, reset clears waypointRoute
- `client/src/components/MapLibreGLMap.tsx` - Waypoint circle markers and numbered label layers via useGeoJsonLayer, flattened route features via useMemo, waypoint-aware zoom and clear
- `client/src/utils/mapHelpers.ts` - Added waypointPointLayer and waypointLabelLayer to CUSTOM_LAYER_ORDER between route and start/end markers
- `client/src/components/controls/RouteList.tsx` - Three-state rendering: leg-grouped waypoint directions, flat regular directions, empty state; getLegLabel and formatLegTime helpers
- `client/src/components/controls/RouteSummaryCard.tsx` - waypointRoute.summary for total distance/time/arrival, leg count display, null-render check includes waypointRoute

## Decisions Made
- Swap button is disabled (not hidden) when waypoints exist -- users can still see it exists but understand it is not available with waypoints
- Waypoint inputs placed between swap button and End input for intuitive vertical flow (Start -> Swap -> Waypoints -> Add Stop -> End)
- Route features flattened via useMemo to avoid recomputing on every render; waypoint legs flatMapped into IMapFeature array
- RouteSummaryCard computes arrival time inline for waypoint routes using the same pattern as formatArrivalTime but from summary data

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All waypoint UI wiring complete; Plan 03 can add tests and polish
- Existing two-point routing completely preserved and all 31 tests pass
- TypeScript compiles cleanly with no errors

## Self-Check: PASSED

- All 7 files verified present on disk
- Commits 1a9fe70 and 275a54f verified in git log
- TypeScript compilation: clean (no errors)
- Test suite: 31/31 tests pass (no regressions)

---
*Phase: 12-waypoint-routing-frontend*
*Completed: 2026-02-14*
