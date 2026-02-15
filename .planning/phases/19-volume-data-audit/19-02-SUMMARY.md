---
phase: 19-volume-data-audit
plan: 02
subsystem: database
tags: [pgrouting, sql, traffic, coalesce, deprecation]

# Dependency graph
requires:
  - phase: 19-01
    provides: "Audit report with DEPRECATE recommendation for dynamic volume lookup"
provides:
  - "Simplified SQL routing functions using COALESCE(traffic_factor, 1.0) fallback"
  - "Removal of all avg_traffic_by_segment subqueries from routing path"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Traffic factor fallback: COALESCE(edges.traffic_factor, 1.0) -- speed data or default"

key-files:
  created: []
  modified:
    - data-importer/src/sql/05_functions.sql

key-decisions:
  - "Kept _hour and _day_of_week parameters in function signatures for backward compatibility"
  - "Removed use_dynamic_traffic boolean and all dynamic SQL construction -- static SQL string now passed to pgr_trsp"
  - "Kept avg_traffic_by_segment table intact for potential future use"

patterns-established:
  - "Traffic cost SQL: cost_drive * COALESCE(traffic_factor, 1.0) for all traffic-aware functions"

# Metrics
duration: 3min
completed: 2026-02-15
---

# Phase 19 Plan 02: SQL Function Updates Summary

**Deprecated dynamic volume lookup from 3 SQL routing functions, replacing 5 CASE/WHEN subquery blocks with simple COALESCE(traffic_factor, 1.0) fallback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-15T02:53:51Z
- **Completed:** 2026-02-15T02:57:01Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Removed all `avg_traffic_by_segment` subqueries from the routing execution path (5 occurrences across 3 functions)
- Simplified `getdrivingroute_with_traffic()` from 275 lines with dynamic SQL construction to ~200 lines with static SQL
- Eliminated 6 CASE/WHEN blocks with hardcoded volume thresholds (58, 129, 250, 415) that violated the project's percentile-based threshold guideline
- Net change: -199 lines removed, +31 lines added (168 net lines removed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update SQL functions based on audit recommendation** - `6e808e0` (feat)
2. **Task 2: Verify end-to-end routing with updated functions** - verification only, no file changes

## Files Created/Modified
- `data-importer/src/sql/05_functions.sql` - Removed dynamic volume lookup from `getdrivingroute_with_traffic()`, `getdrivingisochrone()`, and `getdrivingisochrone_edges()`; simplified traffic factor to `COALESCE(traffic_factor, 1.0)`

## Decisions Made
- Kept `_hour` and `_day_of_week` parameters in all 3 function signatures for backward compatibility (callers may pass these params; ignoring them is safe)
- Removed all dynamic SQL construction (`use_dynamic_traffic`, `traffic_lookup_sql`, `hour_condition_sql`, `day_condition_sql` variables) since static SQL is sufficient
- In `getdrivingroute_with_traffic()`, the pgr_trsp edges SQL is now a static string literal instead of a dynamically constructed format string

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Unit tests (`test_services.py`) have 9 pre-existing failures due to truncated mock WKB geometry hex strings in test fixtures. These failures are unrelated to the SQL changes (they fail on `shapely.wkb.loads` before reaching any routing logic). All 9 error-handling/edge-case tests pass.
- Isochrone smoke test endpoint uses `orig` parameter (not `lon/lat`), corrected during verification.

## User Setup Required

None - no external service configuration required.

## Verification Results

1. SQL deployment: All functions created successfully (no errors)
2. `avg_traffic_by_segment` reference count in SQL file: 3 (all in comments only)
3. Traffic-aware driving route: HTTP 200, 5 segments with traffic_factor
4. Non-traffic driving route: HTTP 200, 5 segments
5. Traffic layer endpoint: HTTP 200, 1208 features
6. Driving isochrone with traffic: HTTP 200, 2 bands

## Next Phase Readiness
- Phase 19 (Volume Data Audit) is complete
- All audit actions satisfied: AUDIT-04 (SQL functions updated with correct fallback chain)
- The `avg_traffic_by_segment` table and import pipeline remain intact for potential future use

## Self-Check: PASSED

- FOUND: `.planning/phases/19-volume-data-audit/19-02-SUMMARY.md`
- FOUND: `data-importer/src/sql/05_functions.sql`
- FOUND: commit `6e808e0`

---
*Phase: 19-volume-data-audit*
*Completed: 2026-02-15*
