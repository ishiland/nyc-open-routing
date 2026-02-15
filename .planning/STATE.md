# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable
**Current focus:** v4.0 Live Traffic — Phase 19: Volume Data Audit

## Current Position

**Milestone:** v4.0 Live Traffic
**Phase:** 19 of 19 (Volume Data Audit)
**Plan:** 2 of 2 complete
**Status:** Phase Complete
**Last Activity:** 2026-02-15 — Plan 19-02 complete (SQL function updates)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- v1.0: 5 phases, 8 plans, 33 files changed, +1045/-391 lines
- v1.1: 1 phase, 3 plans, 6 files changed, +88/-21 lines
- v2.1: 2 phases, 2 plans, 2 files changed, +220/-1 lines
- v2.2: 4 phases, 8 plans, 24 files changed, +2881/-134 lines
- v2.3: 1 phase, 1 plan, 1 file changed, +175/-30 lines
- v3.0: 3 phases, 4 plans, 141 files changed, +529/-21,141 lines

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 17-01 | Traffic Service Core | 2min | 2 | 2 |
| 17-02 | Traffic API Integration | 4min | 2 | 5 |
| 18-01 | Traffic Layer API | 2min | 2 | 2 |
| 18-02 | Traffic Visualization Frontend | 3min | 3 | 8 |
| 19-01 | Coverage Analysis + Audit Report | 4min | 2 | 2 |
| 19-02 | SQL Function Updates | 3min | 2 | 1 |

## Accumulated Context

### Decisions

Archived to PROJECT.md Key Decisions table.

- **17-01:** Used temp tables with ON COMMIT DROP for staging; atomic update replaces reset-all-to-1.0 anti-pattern; propagation rounds configurable (5 initial, 2 recurring)
- **17-02:** Traffic routes created in Task 1 to resolve import dependency; docker/dev/.env is gitignored so defaults come from Settings class
- **18-01:** Direct engine call in route handler (not service class) for simple spatial query; traffic_factor > 1.0 filter excludes free-flow edges
- [Phase 18-02]: TrafficLayerContext positioned outside RoutingContextProvider to maintain independence from routing state
- [Phase 18-02]: MIN_ZOOM=12 and 400ms debounce prevent excessive traffic data fetches; lastRefresh polling keeps layer current
- **19-01:** DEPRECATE volume lookup from SQL routing functions -- 2.08% unique coverage does not justify 6 CASE/WHEN blocks with hardcoded thresholds across 3 functions; keep avg_traffic_by_segment table for future use
- **19-02:** Kept _hour/_day_of_week params for backward compat; replaced dynamic SQL construction with static SQL; traffic cost = cost_drive * COALESCE(traffic_factor, 1.0)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed 19-02-PLAN.md — Phase 19 (Volume Data Audit) complete
Resume file: .planning/phases/19-volume-data-audit/19-02-SUMMARY.md

---
*Created: 2026-02-12*
*Last updated: 2026-02-15 after Plan 19-02 execution complete*
