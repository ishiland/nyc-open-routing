---
phase: 17-live-traffic-refresh
plan: 01
subsystem: api
tags: [traffic, psycopg, asyncio, socrata, transcom, pydantic-settings]

# Dependency graph
requires:
  - phase: none
    provides: existing import_traffic_speeds.py script logic and edges table schema
provides:
  - TrafficRefreshService class with atomic staging table update pattern
  - TRAFFIC_ENABLED and TRAFFIC_REFRESH_INTERVAL settings
  - DB_PARAMS property for direct psycopg connections
affects: [17-02 (lifespan integration, routes, dependencies, health endpoint)]

# Tech tracking
tech-stack:
  added: []
  patterns: [atomic staging table update with IS DISTINCT FROM, asyncio.to_thread for sync DB in async context, startup retry with exponential backoff]

key-files:
  created: [api/services/traffic.py]
  modified: [api/config/settings.py]

key-decisions:
  - "Used temp tables with ON COMMIT DROP for all staging artifacts"
  - "Atomic update replaces reset-all-to-1.0 anti-pattern from original script"
  - "Propagation rounds configurable: 5 for initial load, 2 for recurring refresh"

patterns-established:
  - "Atomic staging table pattern: compute in temp table, UPDATE with IS DISTINCT FROM, reset uncovered edges"
  - "asyncio.to_thread wrapper for sync psycopg operations in async service methods"

# Metrics
duration: 2min
completed: 2026-02-15
---

# Phase 17 Plan 01: Traffic Service Core Summary

**TrafficRefreshService class with atomic staging table updates, Socrata TRANSCOM data fetching, and configurable traffic settings**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T01:24:34Z
- **Completed:** 2026-02-15T01:27:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Settings class extended with TRAFFIC_ENABLED (default False), TRAFFIC_REFRESH_INTERVAL (default 300s), and DB_PARAMS property
- TrafficRefreshService class with complete fetch/stage/match/update pipeline ported from import_traffic_speeds.py
- Atomic update pattern eliminates the reset-all-to-1.0 inconsistency window from original script
- Startup retry logic (3 attempts, exponential backoff) and concurrent refresh prevention

## Task Commits

Each task was committed atomically:

1. **Task 1: Add traffic settings to Settings class** - `1977aca` (feat)
2. **Task 2: Create TrafficRefreshService class** - `399992f` (feat)

## Files Created/Modified
- `api/config/settings.py` - Added TRAFFIC_ENABLED, TRAFFIC_REFRESH_INTERVAL fields and DB_PARAMS property
- `api/services/traffic.py` - New TrafficRefreshService class with full refresh pipeline

## Decisions Made
- Used temp tables with ON COMMIT DROP for all intermediate staging tables (_traffic_speeds, _speed_edge_mapping, _traffic_factor_staging) to auto-cleanup
- Atomic update pattern: compute factors in staging, UPDATE only changed edges via IS DISTINCT FROM, reset uncovered edges in same transaction
- Propagation rounds configurable per call: 5 for initial load (better coverage), 2 for recurring refresh (faster cycle time)
- Direct psycopg.connect() for DB operations (not SQLAlchemy) matching existing import script pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- TrafficRefreshService is ready for integration in Plan 02 (lifespan hook, dependency injection, API routes, health endpoint)
- Service can be instantiated with DB_PARAMS from settings and RouteCache instance
- All methods tested for importability and correct status reporting

## Self-Check: PASSED

- FOUND: api/services/traffic.py
- FOUND: api/config/settings.py
- FOUND: 1977aca
- FOUND: 399992f

---
*Phase: 17-live-traffic-refresh*
*Completed: 2026-02-15*
