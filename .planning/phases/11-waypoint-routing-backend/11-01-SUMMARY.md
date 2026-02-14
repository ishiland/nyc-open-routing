---
phase: 11-waypoint-routing-backend
plan: 01
subsystem: api
tags: [pydantic, fastapi, routing, waypoints, multi-stop]

# Dependency graph
requires:
  - phase: none
    provides: existing RoutingService with mode-specific routing methods
provides:
  - WaypointRouteResponse, LegResponse, LegSummary, WaypointRouteSummary Pydantic models
  - RoutingService.get_waypoint_route() method for multi-stop routing
affects: [11-02 waypoint routing endpoint and tests]

# Tech tracking
tech-stack:
  added: []
  patterns: [leg-assembly loop reusing existing mode-specific methods, waypoint-specific cache keys]

key-files:
  created: []
  modified:
    - api/models/schemas.py
    - api/services/routing.py

key-decisions:
  - "Leg index on LegResponse not on Feature properties -- avoids modifying existing Properties model"
  - "Cache key uses pipe-joined waypoints string with empty dest field"
  - "Let HTTPExceptions from mode-specific methods propagate naturally"

patterns-established:
  - "Waypoint routing delegates to existing mode-specific methods per leg -- no new SQL needed"
  - "Per-leg summary computed from feature properties, overall summary is sum of legs"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 11 Plan 01: Waypoint Routing Models & Service Summary

**Pydantic response models for multi-stop waypoint routing and RoutingService.get_waypoint_route() method that orchestrates per-leg route calculation via existing mode-specific methods**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T18:38:58Z
- **Completed:** 2026-02-14T18:41:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Four new Pydantic models (LegSummary, LegResponse, WaypointRouteSummary, WaypointRouteResponse) added to schemas.py
- get_waypoint_route method added to RoutingService supporting drive, bike, and walk modes
- Cache integration with waypoint-specific keys for all mode/parameter combinations
- Zero modifications to existing models, methods, or tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Add waypoint routing Pydantic response models** - `583089c` (feat)
2. **Task 2: Add get_waypoint_route method to RoutingService** - `48936c4` (feat)

## Files Created/Modified
- `api/models/schemas.py` - Added LegSummary, LegResponse, WaypointRouteSummary, WaypointRouteResponse models
- `api/services/routing.py` - Added get_waypoint_route method and imported new models

## Decisions Made
- Leg index lives on LegResponse, not on Feature properties -- avoids modifying existing Properties model
- Cache key uses pipe-joined waypoints string with empty dest parameter for the route cache
- HTTPExceptions from underlying mode-specific methods propagate naturally; only new error is 404 for empty legs
- Entire request fails if any single leg cannot be routed (no partial results)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failures in test_services.py (5 failures due to shapely WKB parse errors in mock data) and test_routes.py (4 failures due to response format assertions). Verified identical failure counts before and after changes -- no regressions introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Models and service method ready for Plan 02 (API endpoint + tests)
- get_waypoint_route method is fully functional and awaits its route endpoint

## Self-Check: PASSED

- FOUND: api/models/schemas.py
- FOUND: api/services/routing.py
- FOUND: 11-01-SUMMARY.md
- FOUND: commit 583089c (Task 1)
- FOUND: commit 48936c4 (Task 2)

---
*Phase: 11-waypoint-routing-backend*
*Completed: 2026-02-14*
