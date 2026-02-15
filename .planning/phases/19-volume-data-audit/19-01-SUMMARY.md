---
phase: 19-volume-data-audit
plan: 01
subsystem: database
tags: [postgresql, traffic, audit, sql]

# Dependency graph
requires:
  - phase: 17-live-traffic-refresh
    provides: TrafficRefreshService that writes to edges.traffic_factor
  - phase: 18-traffic-visualization
    provides: Traffic layer endpoint querying edges.traffic_factor
provides:
  - Reusable traffic coverage audit SQL script
  - Documented recommendation to deprecate volume lookup from SQL functions
  - Coverage numbers quantifying speed vs volume data overlap
affects: [19-02, sql-functions, traffic-routing]

# Tech tracking
tech-stack:
  added: []
  patterns: [DO-block conditional SQL for missing tables, coverage matrix analysis]

key-files:
  created:
    - scripts/audit_traffic_coverage.sql
    - docs/traffic-audit-report.md
  modified: []

key-decisions:
  - "DEPRECATE volume lookup from SQL routing functions -- 2.08% unique coverage does not justify 6 CASE/WHEN blocks with hardcoded thresholds across 3 functions"
  - "Keep avg_traffic_by_segment table and import pipeline -- data is valid for future time-of-day features, just remove from real-time routing path"

patterns-established:
  - "DO-block pattern with IF EXISTS checks for graceful handling of optional tables in audit queries"

# Metrics
duration: 4min
completed: 2026-02-15
---

# Phase 19 Plan 01: Coverage Analysis + Audit Report Summary

**Traffic coverage audit showing 6.76% speed vs 2.16% volume coverage with 0.08% overlap, recommending deprecation of volume lookup from SQL routing functions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-15T02:47:45Z
- **Completed:** 2026-02-15T02:52:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created reusable audit SQL script with 4 analysis sections (table existence, coverage matrix, distribution, conflict)
- Quantified that live speed service has overwritten 96.39% of volume-derived factors to 1.0
- Produced actionable recommendation: deprecate dynamic volume lookup, simplify to COALESCE(traffic_factor, 1.0)
- Documented current vs recommended SQL fallback chain for Plan 02 implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create and run traffic coverage audit SQL** - `413cfa3` (feat)
2. **Task 2: Write traffic audit report** - `4b446af` (docs)

## Files Created/Modified

- `scripts/audit_traffic_coverage.sql` - Reusable 4-section audit: table existence, coverage matrix, distribution buckets, conflict analysis
- `docs/traffic-audit-report.md` - Full audit report with coverage tables, conflict analysis, and deprecation recommendation

## Decisions Made

- **DEPRECATE volume lookup:** 2.08% unique coverage with 96.39% overwrite rate does not justify the complexity of 6 CASE/WHEN threshold blocks across 3 SQL functions
- **Keep data, remove from routing path:** avg_traffic_by_segment table and import pipeline preserved for potential future time-of-day features

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed RAISE NOTICE format strings in audit SQL**
- **Found during:** Task 1 (running audit SQL)
- **Issue:** PostgreSQL RAISE NOTICE uses `%` for substitution, not `%.2f`. The `%%` literal percent consumes no parameter, causing "too many parameters" errors.
- **Fix:** Used ROUND()::text concatenation with `' pct'` suffix instead of format-string percent signs
- **Files modified:** scripts/audit_traffic_coverage.sql
- **Verification:** Audit script runs cleanly with no errors
- **Committed in:** 413cfa3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor SQL syntax fix. No scope creep.

## Issues Encountered

- `docs/` directory is gitignored. Used `git add -f` to force-track the audit report since the plan explicitly requires it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Coverage numbers and recommendation ready for Plan 02 to implement SQL function simplification
- Specific functions to modify identified: getdrivingroute_with_traffic, getdrivingisochrone, getdrivingisochrone_edges
- Clear action items: remove avg_traffic_by_segment subqueries, simplify to COALESCE(traffic_factor, 1.0)

## Self-Check: PASSED

- [x] scripts/audit_traffic_coverage.sql exists
- [x] docs/traffic-audit-report.md exists
- [x] 19-01-SUMMARY.md exists
- [x] Commit 413cfa3 exists (Task 1)
- [x] Commit 4b446af exists (Task 2)

---
*Phase: 19-volume-data-audit*
*Completed: 2026-02-15*
