# Requirements: NYC Open Routing

**Defined:** 2026-02-14
**Core Value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable

## v2.2 Requirements

Requirements for edge-based isochrones and waypoint routing. Each maps to roadmap phases.

### Edge-Based Isochrones

- [ ] **ISO-01**: SQL isochrone functions return reachable edge geometries with cumulative travel time
- [ ] **ISO-02**: User can toggle between polygon and edge-based isochrone visualization
- [ ] **ISO-03**: Edge-based isochrone displays reachable streets colored by time band (5/10/15/20 min)
- [ ] **ISO-04**: Edge-based isochrones work for all three modes (drive, bike, walk) and respect traffic settings

### Waypoint Routing

- [ ] **WAY-01**: User can add intermediate stops between origin and destination (up to 3 waypoints)
- [ ] **WAY-02**: Route calculates through all waypoints in order with per-leg directions
- [ ] **WAY-03**: Waypoint markers display on the map at each stop
- [ ] **WAY-04**: User can remove individual waypoints

## Future Requirements

- Partial edge clipping via ST_LineSubstring for edges crossing time boundaries
- Continuous color gradient for edge-based isochrones
- Waypoint reorder via drag-and-drop
- URL deep links with waypoint coordinates
- pgr_trspVia single-query optimization (if verified stable)

## Out of Scope

| Feature | Reason |
|---------|--------|
| More than 3 waypoints | POC scope — each waypoint adds a routing call, cap keeps performance reasonable |
| Waypoint optimization (TSP) | Traveling salesman adds significant complexity, defer |
| Edge-based isochrone animation | No animation libraries constraint, CSS transitions insufficient for this |
| Alternative routes (K-shortest paths) | Separate feature, defer to future milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ISO-01 | TBD | Pending |
| ISO-02 | TBD | Pending |
| ISO-03 | TBD | Pending |
| ISO-04 | TBD | Pending |
| WAY-01 | TBD | Pending |
| WAY-02 | TBD | Pending |
| WAY-03 | TBD | Pending |
| WAY-04 | TBD | Pending |

**Coverage:**
- v2.2 requirements: 8 total
- Mapped to phases: 0
- Unmapped: 8

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*
