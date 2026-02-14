# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable
**Current focus:** v2.2 Edge Isochrones & Waypoints — Phase 11 complete, Phase 12 next

## Current Position

Milestone: v2.2 Edge Isochrones & Waypoints
Phase: 11 of 12 (Waypoint Routing Backend) -- COMPLETE
Plan: 2 of 2 plans executed
Status: Phase 11 complete (all backend waypoint routing: models, service, endpoint, tests)
Last activity: 2026-02-14 — Executed Phase 11 Plan 02 (waypoint routing endpoint & tests)

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- v1.0: 5 phases, 8 plans, 33 files changed, +1045/-391 lines
- v1.1: 1 phase, 3 plans, 6 files changed, +88/-21 lines
- v2.1: 2 phases, 2 plans, 2 files changed, +220/-1 lines
- v2.2 Phase 9: 1 plan, 2 tasks, 1 file changed, +535/-3 lines, 3 min
- v2.2 Phase 10-01: 2 tasks, 3 files changed, 2 min
- v2.2 Phase 10-02: 2 tasks, 7 files changed, 4 min
- v2.2 Phase 11-01: 2 tasks, 2 files changed, 2 min
- v2.2 Phase 11-02: 2 tasks, 3 files changed, 2 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- ST_SimplifyPreserveTopology 1-foot tolerance (SRID 2263) for edge geometry simplification
- DISTINCT ON (eid) ORDER BY agg_cost for deduplicating edges reached from multiple directions
- Exclusive band assignment: each edge in exactly one band to prevent duplicate rendering
- Union type for IsochroneResponse.features to support both polygon and edge features in one response model
- Separate cache prefix iso-edges- to prevent polygon/edge cache collisions
- Clear isochrone data on view switch to force re-fetch with correct view parameter
- Edge line width scales 1px->4px across zoom 10->16 for clarity at all scales
- Leg index on LegResponse not on Feature properties -- avoids modifying existing Properties model
- Waypoint routing delegates to existing mode-specific methods per leg -- no new SQL needed
- Coordinate validation per-pair in endpoint before dispatching to service for consistency
- Endpoint uses parse_coordinates for validation matching existing /api/route behavior

### Pending Todos

None.

### Blockers/Concerns

- Edge-based isochrone payload size at scale (5K-15K edges) — may need geometry simplification

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 11-02-PLAN.md (waypoint routing endpoint & tests) -- Phase 11 fully complete
Resume file: None

---
*Created: 2026-02-12*
*Last updated: 2026-02-14 after Phase 11 Plan 02 execution*
