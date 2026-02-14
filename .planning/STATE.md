# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable
**Current focus:** v2.2 Edge Isochrones & Waypoints — Phase 12 executing

## Current Position

Milestone: v2.2 Edge Isochrones & Waypoints
Phase: 12 of 12 (Waypoint Routing Frontend) -- IN PROGRESS
Plan: 1 of 3 plans executed
Status: Plan 12-01 complete — waypoint types, context state, fetch hook, WaypointSearch component
Last activity: 2026-02-14 — Completed 12-01 (waypoint foundation)

Progress: [████████░░] 80%

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
- v2.2 Phase 12-01: 2 tasks, 7 files changed, 3 min

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
- Separate useWaypointRouteFetch hook rather than extending useRouteFetch to preserve existing routing unchanged
- WaypointSearch reuses useDebouncedFetch/SuggestionDropdown with simpler layout (no geolocation, no recent searches)
- addWaypoint enforces max 1 intermediate waypoint matching backend 3-total-point constraint

### Pending Todos

None.

### Blockers/Concerns

- Edge-based isochrone payload size at scale (5K-15K edges) — may need geometry simplification

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 12-01-PLAN.md
Resume file: None

---
*Created: 2026-02-12*
*Last updated: 2026-02-14 after completing 12-01*
