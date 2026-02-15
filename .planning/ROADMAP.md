# Roadmap

## Completed Milestones

- **v1.0 UI Redesign** (2026-02-13) — 5 phases, 8 plans, 33 files changed, +1045/-391 lines -> [archive](.planning/milestones/v1.0-ROADMAP.md)
- **v1.1 UI Polish** (2026-02-13) — 1 phase, 3 plans, 6 files changed, +88/-21 lines -> [archive](.planning/milestones/v1.1-ROADMAP.md)
- **v2.0 Isochrone Reachability** (2026-02-14) — isochrone feature, restriction fix, layer ordering fix
- **v2.1 Departure Time** (2026-02-14) — 2 phases, 2 plans, departure time picker + API/URL verification -> [archive](.planning/milestones/v2.1-ROADMAP.md)
- **v2.2 Edge Isochrones & Waypoints** (2026-02-14) — 4 phases, 8 plans, 24 files changed, +2881/-134 lines -> [archive](.planning/milestones/v2.2-ROADMAP.md)
- **v2.3 Ferry Route Fix** (2026-02-14) — 1 phase, 1 plan, 1 file changed, +175/-30 lines -> [archive](.planning/milestones/v2.3-ROADMAP.md)
- **v3.0 Public Release** (2026-02-14) — 3 phases, 4 plans, 141 files changed, +529/-21,141 lines -> [archive](.planning/milestones/v3.0-ROADMAP.md)

---

## v4.0 Live Traffic (In Progress)

**Milestone Goal:** Transform traffic-aware routing from manual one-shot import to automatic live data with city-wide visualization and data source audit.

### Phases

- [x] **Phase 17: Live Traffic Refresh** - Background refresh service with atomic updates, configurable startup, and operational endpoints (2026-02-15)
- [ ] **Phase 18: Traffic Visualization** - Toggleable map layer showing real-time traffic conditions on streets
- [ ] **Phase 19: Volume Data Audit** - Evaluate static volume data coverage and update SQL fallback chain

### Phase Details

#### Phase 17: Live Traffic Refresh
**Goal**: Traffic data stays current automatically — the API fetches, validates, and applies TRANSCOM speed data on a recurring schedule without manual intervention, and operators can configure and monitor the process.
**Depends on**: Nothing (first phase of milestone)
**Requirements**: REFRESH-01, REFRESH-02, REFRESH-03, REFRESH-04, REFRESH-05, REFRESH-06, REFRESH-07, CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-05, CONFIG-06
**Success Criteria** (what must be TRUE):
  1. With TRAFFIC_ENABLED=true, the API starts serving requests immediately while traffic data loads in the background, and refreshes automatically every N minutes without manual action
  2. Traffic-aware routes never degrade during a refresh cycle — a route calculated mid-refresh returns the same quality as one calculated before or after
  3. When a refresh fails (network error, bad data), the API keeps serving routes with the previous traffic data and logs the failure
  4. `GET /api/traffic/status` reports last refresh time, success/failure, edge count, and whether traffic is enabled; health endpoint shows traffic_data_loaded state
  5. `POST /api/traffic/refresh` triggers an immediate refresh cycle, and startup logs report resolved TRAFFIC_ENABLED and TRAFFIC_REFRESH_INTERVAL values
**Plans:** 2 plans

Plans:
- [x] 17-01-PLAN.md — Settings + TrafficRefreshService class (atomic updates, incremental writes, retry logic)
- [x] 17-02-PLAN.md — Lifespan background task, traffic endpoints, health integration, env config

#### Phase 18: Traffic Visualization
**Goal**: Users can see real-time traffic conditions on the map as a color-coded street overlay, independent of whether they have a route active.
**Depends on**: Phase 17 (requires live traffic data in the database)
**Requirements**: VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05, VIZ-06
**Success Criteria** (what must be TRUE):
  1. A toggle control activates a map layer that colors street segments green/yellow/orange/red by traffic condition, and it works in any travel mode or with no route active
  2. Only streets with actual traffic sensor data show color — streets without data remain unstyled (no misleading "all green")
  3. Panning or zooming the map loads traffic data only for the visible area, keeping the layer responsive
  4. A legend explains the color-to-condition mapping, and a freshness indicator shows how old the traffic data is (e.g., "Updated 3 min ago")
**Plans:** 2 plans

Plans:
- [ ] 18-01-PLAN.md — Backend bbox-filtered traffic layer API endpoint (Pydantic models + GET /api/traffic/layer)
- [ ] 18-02-PLAN.md — Frontend traffic layer (context, hooks, toggle/legend component, map integration)

#### Phase 19: Volume Data Audit
**Goal**: A data-driven decision on whether to keep, merge, or deprecate the static NYC DOT volume-based traffic data, with SQL routing functions updated to reflect the chosen fallback chain.
**Depends on**: Phase 17 (requires live speed data for coverage comparison)
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04
**Success Criteria** (what must be TRUE):
  1. Coverage analysis shows exactly how many edges have live speed data, static volume data, both, or neither
  2. SQL routing functions use an explicit priority chain — live speed factor first, then static volume factor (or removed), then 1.0 default — and the chain is documented
  3. A clear recommendation (keep, merge, or deprecate volume data) exists with supporting coverage numbers
**Plans**: TBD

Plans:
- [ ] 19-01: TBD

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 17. Live Traffic Refresh | 2/2 | ✓ Complete | 2026-02-15 |
| 18. Traffic Visualization | 0/2 | Planned | - |
| 19. Volume Data Audit | 0/TBD | Not started | - |

---
*Last updated: 2026-02-14 after Phase 18 planning complete (2 plans created)*
