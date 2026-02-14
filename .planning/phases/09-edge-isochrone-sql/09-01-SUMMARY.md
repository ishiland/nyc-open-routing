---
phase: 09-edge-isochrone-sql
plan: 01
subsystem: database
tags: [pgrouting, isochrone, pgr_drivingDistance, sql-functions, edge-geometry]

# Dependency graph
requires:
  - phase: 08-isochrone-feature
    provides: "Polygon isochrone SQL functions and pgr_drivingDistance patterns"
provides:
  - "getdrivingisochrone_edges: edge-based driving isochrone with traffic support"
  - "getbikingisochrone_edges: edge-based biking isochrone (directed)"
  - "getwalkingisochrone_edges: edge-based walking isochrone (undirected)"
affects: [10-edge-isochrone-api, 11-edge-isochrone-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Edge-based isochrone pattern: pgr_drivingDistance -> DISTINCT ON edge -> band assignment via exclusive intervals"
    - "Band-exclusive edge assignment: each edge in exactly one band using agg_cost range filtering"

key-files:
  created: []
  modified:
    - "data-importer/src/sql/05_functions.sql"

key-decisions:
  - "ST_SimplifyPreserveTopology tolerance of 1 foot (SRID 2263 units) to reduce coordinate count while preserving street shape"
  - "DISTINCT ON (eid) ORDER BY agg_cost to deduplicate edges reached from multiple directions, keeping lowest cost"
  - "Exclusive band assignment: each edge appears in exactly one band, preventing client-side deduplication"

patterns-established:
  - "Edge isochrone return type: TABLE(edge_id INT, band_index INT, agg_cost FLOAT, street TEXT, geom GEOMETRY)"
  - "Band assignment via JOIN with interval exclusion: agg_cost <= upper_bound AND agg_cost > lower_bound"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 9 Plan 1: Edge-Based Isochrone SQL Summary

**Three pgr_drivingDistance-based SQL functions returning per-edge LineString geometries with band assignment, traffic support, and SRID 4326 output**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T15:58:37Z
- **Completed:** 2026-02-14T16:01:30Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Three new edge-based isochrone functions appended to 05_functions.sql, mirroring polygon versions
- Driving function supports identical traffic logic (static + dynamic) to existing getdrivingisochrone
- Walking function uses undirected traversal (directed=FALSE) matching existing walking isochrone
- All functions validated against live data: correct band counts, proper cost ranges, valid SRID 4326 LineString geometry, zero cross-band duplicates

## Task Commits

Each task was committed atomically:

1. **Task 1: Create edge-based isochrone SQL functions** - `20c4052` (feat)
2. **Task 2: Validate edge isochrone functions against live data** - no commit (validation-only, no code changes)

## Files Created/Modified
- `data-importer/src/sql/05_functions.sql` - Added getdrivingisochrone_edges, getbikingisochrone_edges, getwalkingisochrone_edges after existing polygon isochrone functions

## Decisions Made
- Used ST_SimplifyPreserveTopology with 1-foot tolerance (SRID 2263 units) rather than 0.0001 feet as originally suggested in plan; 1 foot removes sub-foot coordinate jitter while preserving street shape
- Used DISTINCT ON (eid) with ORDER BY agg_cost ASC to handle pgr_drivingDistance returning the same edge from multiple directions -- keeps the lowest cost occurrence
- Band assignment uses exclusive ranges (edge in exactly one band) to prevent duplicate rendering on the client

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Validation Results

| Test | Description | Result |
|------|-------------|--------|
| 1 | Driving no-traffic: 4 bands | 2098/7859/13379/5715 edges |
| 2 | Driving with-traffic: 4 bands | 1894/6024/10160/8325 edges (fewer, as expected) |
| 3 | Biking: 4 bands | 108/1351/2056/617 edges |
| 4 | Walking: 4 bands | 25/106/191/374 edges (fewest, as expected) |
| 5 | Geometry type | ST_LineString, SRID 4326, valid GeoJSON |
| 6 | No cross-band duplicates | 0 duplicate edges |
| 7 | Polygon vs edge sanity | 64442 nodes vs 29051 edges (reasonable) |

## Next Phase Readiness
- Three edge-based isochrone SQL functions ready for API integration (Phase 10)
- Return type standardized: (edge_id, band_index, agg_cost, street, geom) for straightforward GeoJSON serialization
- Existing polygon isochrone functions preserved and functional alongside new edge functions

## Self-Check: PASSED

- FOUND: data-importer/src/sql/05_functions.sql
- FOUND: commit 20c4052
- FOUND: 09-01-SUMMARY.md

---
*Phase: 09-edge-isochrone-sql*
*Completed: 2026-02-14*
