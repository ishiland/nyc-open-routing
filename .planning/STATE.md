# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable
**Current focus:** v2.2 Edge Isochrones & Waypoints — Phase 10, Plan 10-01 complete, 10-02 next

## Current Position

Milestone: v2.2 Edge Isochrones & Waypoints
Phase: 10 of 12 (Edge Isochrone Frontend)
Plan: 10-02 pending (1 of 2 plans complete)
Status: Executing — Plan 10-01 complete, Plan 10-02 next
Last activity: 2026-02-14 — Completed 10-01 (edge isochrone API)

Progress: [███░░░░░░░] 30%

## Performance Metrics

**Velocity:**
- v1.0: 5 phases, 8 plans, 33 files changed, +1045/-391 lines
- v1.1: 1 phase, 3 plans, 6 files changed, +88/-21 lines
- v2.1: 2 phases, 2 plans, 2 files changed, +220/-1 lines
- v2.2 Phase 9: 1 plan, 2 tasks, 1 file changed, +535/-3 lines, 3 min
- v2.2 Phase 10-01: 2 tasks, 3 files changed, 2 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- ST_SimplifyPreserveTopology 1-foot tolerance (SRID 2263) for edge geometry simplification
- DISTINCT ON (eid) ORDER BY agg_cost for deduplicating edges reached from multiple directions
- Exclusive band assignment: each edge in exactly one band to prevent duplicate rendering
- Union type for IsochroneResponse.features to support both polygon and edge features in one response model
- Separate cache prefix iso-edges- to prevent polygon/edge cache collisions

### Pending Todos

None.

### Blockers/Concerns

- pgr_trspVia runtime availability unverified — fallback to sequential pgr_trsp is viable (Phase 11)
- Edge-based isochrone payload size at scale (5K-15K edges) — may need geometry simplification (Phase 10)

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 10-01-PLAN.md (edge isochrone API), 10-02 next
Resume file: None

---
*Created: 2026-02-12*
*Last updated: 2026-02-14 after Phase 10-01 execution*
