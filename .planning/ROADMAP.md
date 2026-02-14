# Roadmap

## Completed Milestones

- **v1.0 UI Redesign** (2026-02-13) — 5 phases, 8 plans, 33 files changed, +1045/-391 lines -> [archive](.planning/milestones/v1.0-ROADMAP.md)
- **v1.1 UI Polish** (2026-02-13) — 1 phase, 3 plans, 6 files changed, +88/-21 lines -> [archive](.planning/milestones/v1.1-ROADMAP.md)
- **v2.0 Isochrone Reachability** (2026-02-14) — isochrone feature, restriction fix, layer ordering fix
- **v2.1 Departure Time** (2026-02-14) — 2 phases, 2 plans, departure time picker + API/URL verification -> [archive](.planning/milestones/v2.1-ROADMAP.md)
- **v2.2 Edge Isochrones & Waypoints** (2026-02-14) — 4 phases, 8 plans, 24 files changed, +2881/-134 lines -> [archive](.planning/milestones/v2.2-ROADMAP.md)

## Current Milestone: v2.3 Ferry Route Fix

**Goal:** Isolate ferry route internal nodes from bridge/tunnel nodes while preserving terminal connectivity and bikeable/walkable access.

**Start date:** 2026-02-14

### Phase 13: Ferry Network Topology Isolation

**Goal:** Ferry routes are structurally isolated from bridges/tunnels, accessible only at terminal endpoints, preserving bike/walk routing.

**Dependencies:** None (SQL pipeline modification)

**Requirements:** FERRY-01, FERRY-02, FERRY-03, FERRY-04

**Success Criteria:**

1. **Internal node isolation**: Ferry route internal nodes (mid-span) no longer share vertex IDs with bridge/tunnel nodes — routing cannot jump between them mid-crossing
2. **Terminal connectivity**: Ferry terminal endpoints where routes touch land continue to share nodes with the street network for seamless transfer
3. **Mode preservation**: All ferry edges remain bikeable=TRUE, walkable=TRUE, driveable=FALSE as in current state
4. **Existing routing works**: SI Ferry crossing and other LION ferry routes continue to function in bike/walk routing (verified by test routes through St. George Terminal)
5. **Bridge routing unaffected**: Existing bridge routes (Hugh L. Carey Tunnel, Holland Tunnel, Verrazzano Bridge, Williamsburg Bridge) still work for appropriate modes

**Test Plan:**

- Query ferry nodes: `SELECT DISTINCT id FROM edges_vertices_pgr WHERE id IN (SELECT source FROM edges WHERE featuretyp='F') OR id IN (SELECT target FROM edges WHERE featuretyp='F')`
- Check for shared nodes: Cross-reference ferry node IDs with bridge/tunnel edge source/target — expect 0 shared internal nodes
- Verify SI Ferry walk route: Staten Island Ferry terminal to Manhattan street network
- Verify bridge drive route: Hugh L. Carey Tunnel entrance to exit
- Count ferry edges: Expect all LION ferry routes (dozens of segments) preserved with correct mode flags

### Progress

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 13 - Ferry Network Topology Isolation | Ferry routes structurally isolated from bridges/tunnels | FERRY-01, FERRY-02, FERRY-03, FERRY-04 | Pending |

**Coverage:** 4/4 requirements mapped ✓

---
*Last updated: 2026-02-14 after v2.3 roadmap creation*
