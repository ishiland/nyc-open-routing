# Roadmap

## Completed Milestones

- **v1.0 UI Redesign** (2026-02-13) — 5 phases, 8 plans, 33 files changed, +1045/-391 lines → [archive](.planning/milestones/v1.0-ROADMAP.md)
- **v1.1 UI Polish** (2026-02-13) — 1 phase, 3 plans, 6 files changed, +88/-21 lines → [archive](.planning/milestones/v1.1-ROADMAP.md)
- **v2.0 Isochrone Reachability** (2026-02-14) — isochrone feature, restriction fix, layer ordering fix
- **v2.1 Departure Time** (2026-02-14) — 2 phases, 2 plans, departure time picker + API/URL verification → [archive](.planning/milestones/v2.1-ROADMAP.md)

## Current Milestone: v2.2 Edge Isochrones & Waypoints

**Milestone Goal:** Add edge-based isochrone visualization (colored street segments by travel time) and multi-stop waypoint routing (A to B to C). Two independent features that extend the existing routing and reachability capabilities.

### Phases

- [ ] **Phase 9: Edge Isochrone SQL** - SQL functions return reachable edge geometries with cumulative travel time
- [ ] **Phase 10: Edge Isochrone Frontend** - Users toggle between polygon and edge visualization across all modes
- [ ] **Phase 11: Waypoint Routing Backend** - SQL functions and API endpoint calculate multi-stop routes with per-leg directions
- [ ] **Phase 12: Waypoint Routing Frontend** - Users add, remove, and see waypoints in the sidebar and on the map

### Phase Details

#### Phase 9: Edge Isochrone SQL
**Goal**: Isochrone SQL functions produce reachable street geometries colored by travel time, not just hull polygons
**Depends on**: Nothing (builds on existing isochrone SQL functions)
**Requirements**: ISO-01
**Success Criteria** (what must be TRUE):
  1. SQL isochrone functions return edge geometries (LineStrings) with cumulative travel time for each reachable street segment
  2. Edge results include street name, travel time, and band index for downstream rendering
  3. Functions work for all three modes (drive, bike, walk) and respect traffic settings when applicable
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

#### Phase 10: Edge Isochrone Frontend
**Goal**: Users can see exactly which streets are reachable within each time band, rendered as colored line segments on the map
**Depends on**: Phase 9
**Requirements**: ISO-02, ISO-03, ISO-04
**Success Criteria** (what must be TRUE):
  1. User can toggle between polygon view and edge-based view for isochrones
  2. Reachable streets display as colored lines with distinct colors per time band (5/10/15/20 min)
  3. Edge-based isochrones render correctly for drive, bike, and walk modes
  4. Traffic toggle affects edge-based isochrone results in drive mode (same as polygon isochrones)
  5. Line width and visibility scale appropriately across zoom levels
**Plans**: TBD

Plans:
- [ ] 10-01: TBD

#### Phase 11: Waypoint Routing Backend
**Goal**: The routing engine calculates ordered multi-stop routes through intermediate waypoints with per-leg turn directions
**Depends on**: Nothing (independent of edge isochrone work)
**Requirements**: WAY-02
**Success Criteria** (what must be TRUE):
  1. SQL functions accept arrays of coordinates and return route geometry with a leg identifier per waypoint-to-waypoint segment
  2. API endpoint accepts a list of waypoints and returns a route response with per-leg directions and summaries
  3. Multi-stop routing works for all three modes (drive, bike, walk)
  4. Existing two-point routing continues to work unchanged
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

#### Phase 12: Waypoint Routing Frontend
**Goal**: Users can build multi-stop routes by adding and removing intermediate waypoints in the sidebar, with markers visible on the map
**Depends on**: Phase 11
**Requirements**: WAY-01, WAY-03, WAY-04
**Success Criteria** (what must be TRUE):
  1. User can add up to 3 intermediate waypoints between origin and destination via the sidebar
  2. Each waypoint appears as a numbered marker on the map at the correct location
  3. User can remove any individual waypoint and the route recalculates
  4. Turn-by-turn directions in the sidebar are grouped by leg (origin to waypoint 1, waypoint 1 to waypoint 2, etc.)
  5. Existing two-point routing UX remains unchanged when no waypoints are added
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

## Progress

**Execution Order:** 9 → 10 → 11 → 12 (Phases 9-10 and 11-12 are independent tracks; 11 can start before 10 completes)

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 9. Edge Isochrone SQL | 0/TBD | Not started | - |
| 10. Edge Isochrone Frontend | 0/TBD | Not started | - |
| 11. Waypoint Routing Backend | 0/TBD | Not started | - |
| 12. Waypoint Routing Frontend | 0/TBD | Not started | - |

---
*Last updated: 2026-02-14 after v2.2 roadmap creation*
