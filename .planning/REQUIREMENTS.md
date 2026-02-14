# Requirements: NYC Open Routing

**Defined:** 2026-02-14
**Core Value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable

## v2.3 Requirements

Requirements for ferry route network isolation. Each maps to roadmap phases.

### Ferry Network Isolation

- [ ] **FERRY-01**: Ferry route internal nodes are disconnected from bridge/tunnel nodes so routing cannot jump between them
- [ ] **FERRY-02**: Ferry routes remain accessible only at terminal endpoints where they connect to the street network
- [ ] **FERRY-03**: Ferry edges remain bikeable and walkable but not driveable
- [ ] **FERRY-04**: Existing bike/walk routing through ferry terminals continues to work (SI Ferry, other LION ferry routes)

## Future Requirements

- Partial edge clipping via ST_LineSubstring for edges crossing time boundaries
- Continuous color gradient for edge-based isochrones
- Waypoint reorder via drag-and-drop
- URL deep links with waypoint coordinates

## Out of Scope

| Feature | Reason |
|---------|--------|
| Adding new ferry routes beyond LION data | LION data is the authoritative source for NYC ferry routes |
| Real-time ferry schedule integration | Beyond POC scope, would require external API |
| Ferry-specific routing costs per route | All ferry routes use uniform cost model for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FERRY-01 | Phase 13 | Pending |
| FERRY-02 | Phase 13 | Pending |
| FERRY-03 | Phase 13 | Pending |
| FERRY-04 | Phase 13 | Pending |

**Coverage:**
- v2.3 requirements: 4 total
- Mapped to phases: 4
- Unmapped: 0

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*
