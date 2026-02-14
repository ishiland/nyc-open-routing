# Project Research Summary

**Project:** NYC Open Routing - Isochrone/Reachability Visualization
**Domain:** Multi-modal routing application with pgRouting + PostGIS backend
**Researched:** 2026-02-13
**Confidence:** HIGH

## Executive Summary

Isochrone visualization answers the question "where can I reach from here within X minutes?" for the NYC Open Routing app. This feature requires **zero new dependencies** across the entire stack - no new Python packages, no new npm packages, and no Docker image changes. The entire implementation leverages existing capabilities: pgRouting's `pgr_drivingDistance` function for computing reachable nodes via Dijkstra's algorithm, PostGIS's `ST_ConcaveHull` for generating polygon boundaries from point clouds, the existing Shapely/Pydantic pipeline for GeoJSON serialization, and MapLibre GL's `fill` layer type for polygon rendering.

The recommended approach follows the existing routing architecture pattern exactly: SQL functions encapsulate all graph computation logic, a service layer handles caching and coordinate transformation, FastAPI endpoints expose the functionality via REST, and React Context manages frontend state with custom hooks for data fetching and map layer rendering. The only architectural deviation is creating a separate `IsochroneContext` rather than extending `RoutingContext` - this prevents re-render cascades and keeps routing and isochrone state cleanly separated despite their shared use of travel mode selection.

Key risks are manageable with known mitigations. Performance concerns (pgr_drivingDistance on a 177k-edge graph can take 1-3 seconds) are addressed through aggressive caching, spatial bounding boxes to limit the search space, and computing all time bands in a single database call. Visual rendering artifacts from overlapping transparent polygons are solved by using PostGIS `ST_Difference` to create true concentric donut rings rather than overlapping circles. The most critical finding from pitfalls research: the isochrone SQL must use `time_drive`/`time_bike`/`time_walk` columns (pure travel times) rather than `cost_drive`/`cost_bike`/`cost_walk` columns (which include routing preference penalties) - using cost columns distorts the reachable area and produces misleading isochrones. The only uncertainty is the GEOS version in the Docker image (likely 3.9.0), which affects `ST_ConcaveHull` performance but not functionality, with a clear upgrade path if needed.

## Key Findings

### Recommended Stack

**No new dependencies required.** The isochrone feature is built entirely on capabilities already present in the existing stack. The database layer uses pgRouting 3.8's `pgr_drivingDistance` function to compute all nodes reachable within a time threshold (proven Dijkstra implementation, stable since pgRouting 2.0), and PostGIS 3.5's `ST_ConcaveHull` to generate polygon boundaries from the resulting point clouds. The API layer reuses the existing FastAPI/Pydantic/Shapely pipeline without modification. The frontend layer uses MapLibre GL 5.3.0's existing `fill` layer type with data-driven styling (`["get", "color"]` expressions), rendered via the existing `useGeoJsonLayer` hook.

**Core technologies:**
- **pgr_drivingDistance (pgRouting 3.8)**: Dijkstra-based reachability computation returning all nodes within cost threshold - reuses existing edge cost columns (`time_drive`/`time_bike`/`time_walk`) and mode accessibility flags
- **ST_ConcaveHull (PostGIS 3.5)**: Polygon generation from node geometries with tunable concavity parameter (0.7 recommended for street network isochrones) - faster with GEOS 3.11+ but functional with older versions
- **MapLibre GL fill layers**: Semi-transparent polygon rendering with per-feature color/opacity via data-driven paint properties - existing `useGeoJsonLayer` hook supports this layer type without modification

**GEOS version uncertainty:** The Docker image `pgrouting/pgrouting:17-3.5-3.8` likely ships with GEOS 3.9.0 based on similar tag examples. PostGIS 3.3+ with GEOS 3.11+ provides a faster native `ST_ConcaveHull` implementation, but the legacy PL/pgSQL fallback is functional and adequate for proof-of-concept (100-500ms per polygon vs 10-50ms native). This must be verified with `SELECT postgis_geos_compiled_version()` during development. Upgrade path exists: change to `pgrouting:17-3.6-3.8` (PostGIS 3.6 with GEOS 3.11+) as a drop-in replacement.

### Expected Features

**Table stakes (users expect from any isochrone tool):**
- Single-origin isochrone polygons with concentric time bands (5/10/15/20 minutes standard across Mapbox, Valhalla, TravelTime)
- Multi-modal support (drive/bike/walk) matching the existing routing modes
- Color-coded polygon fills with transparency (green-to-red sequential palette, decreasing opacity for outer bands)
- Origin selection via address search (reuse existing Geosupport integration) and click-on-map
- Loading state during computation (pgr_drivingDistance is slower than point-to-point routing)
- Clear/reset to dismiss overlay
- Correct rendering order (largest polygon rendered first, smallest on top, to avoid opacity blending artifacts)

**Differentiators (unique value propositions):**
- **Traffic-aware isochrones (drive mode)**: Apply existing traffic factors to isochrone costs to show realistic rush-hour vs off-peak reachability - unique for self-hosted tools, most use free-flow speeds
- **Edge-based visualization**: Color individual street segments by time band instead of polygon blobs - more accurate, shows exactly which streets are reachable, avoids concave hull "swallowing" unreachable areas
- **Time slider**: Drag slider to adjust max time dynamically (requires fast backend <1s or client-side caching)
- **Deep links**: URL sharing with origin/mode/time params (extends existing route deep link pattern)
- **Summary statistics**: Area covered, street count within each band

**Anti-features (explicit scope exclusions):**
- Reverse isochrone ("where can reach ME in X minutes") - computationally expensive, niche use case
- Multi-origin merge/intersection - analytics feature beyond PoC scope
- Isodistance (distance-based instead of time-based) - time is more intuitive and useful
- POI overlay/demographic analysis - requires external data integration (separate project)
- Real-time updates while dragging origin - requires sub-100ms response times (not feasible with pgr_drivingDistance on 177k edges)
- Public transit mode - requires GTFS integration and schedule-aware routing (massive scope increase)

**MVP scope:** Core polygon visualization (pgr_drivingDistance SQL → API endpoint → concentric fill layers) + origin selection (address search + map click) + mode selection. Defer traffic-aware variant, time slider, edge-based view, deep links, and summary stats to post-MVP phases.

### Architecture Approach

Isochrone visualization integrates as a parallel feature to routing with the same database, API patterns, and map rendering infrastructure, but fundamentally different query shape (routing finds a path between two points; isochrones find all reachable nodes from one point and generate a polygon boundary).

**Major components:**
1. **Database layer**: `getisochrone()` SQL function encapsulating `pgr_drivingDistance` + edge geometry collection + `ST_ConcaveHull` + coordinate transformation (2263→4326). Reuses existing `getnearestXXXnode()` functions for origin snapping and `time_*` cost columns for accurate travel time computation.
2. **API layer**: `IsochroneService` class mirroring `RoutingService` pattern (cache-first, parse coordinates, execute SQL, format GeoJSON, cache result) + `/api/isochrone` endpoint with Pydantic request/response models. Reuses `parse_coordinates()`, `dump_geo()`, `RouteCache`, and `get_db_engine()` dependencies.
3. **Frontend layer**: `IsochroneContext` for state management (separate from `RoutingContext` to avoid re-render cascade) + `useIsochroneFetch` hook for API calls + `useGeoJsonLayer` hook for fill/outline layer rendering (existing hook supports fill layers). Layer z-ordering places isochrones beneath route layers.
4. **UI controls**: `IsochroneControls` component for origin picker, time band selector, and mode toggle. Integrates with existing sidebar layout as a distinct mode from routing (not layered on top).

**Build order (linear dependencies):**
- **Phase 1**: SQL function (testable directly in psql, validates pgRouting + PostGIS pipeline)
- **Phase 2**: API endpoint (testable via Swagger/curl, validates service layer and GeoJSON conversion)
- **Phase 3**: Frontend rendering (testable with hardcoded data, validates MapLibre fill layers)
- **Phase 4**: UI controls (most subjective, built last after core visualization works)

**Pattern alignment with existing code:**
- SQL functions encapsulate all routing logic (matches `getdrivingroute()` pattern)
- Service layer uses cache-first with mode-specific keys (matches `RoutingService`)
- WKB-to-GeoJSON conversion via `dump_geo()` (matches route response)
- Context separation for independent features (prevents context bloat)
- `useGeoJsonLayer` hook for all map layer management (already supports fill layers)

### Critical Pitfalls

1. **Cost unit mismatch between pgr_drivingDistance and edge costs**: The `cost_drive`/`cost_bike`/`cost_walk` columns include routing preference penalties (100x for wrong-way one-ways, 3x-5x for no-bike-lane streets, 50x for highways). Using these as isochrone costs produces wildly distorted reachable areas. **Prevention:** Use `time_drive`/`time_bike`/`time_walk` columns (pure travel times in seconds) as cost input to pgr_drivingDistance, while still filtering by mode accessibility flags (`WHERE driveable=TRUE`). This gives accurate physical reachability without preference distortion.

2. **pgr_drivingDistance performance on 177k-edge graph without spatial bounds**: Unoptimized calls run Dijkstra on the entire graph, taking 2-5 seconds for large time bands. **Prevention:** Filter the edge query with a spatial bounding box (`WHERE the_geom && ST_Expand(origin_point, buffer_meters)`) to reduce the search space from 177k to ~30-50k edges. Compute all time bands in a single call (use max time, filter results by `agg_cost`) rather than multiple sequential calls. Add covering index on `(source, target, time_drive) WHERE driveable=TRUE`. Cache aggressively.

3. **SRID mismatch between vertex geometry (2263), ST_ConcaveHull, and GeoJSON output (4326)**: Vertices are stored in SRID 2263 (NY State Plane feet). Running ST_ConcaveHull on 2263 geometries and returning without transformation produces polygons at coordinates like (981000, 196000) instead of (-73.99, 40.73). **Prevention:** Run ST_ConcaveHull on SRID 2263 geometries (correct - projected coordinate system where distances are Euclidean), then transform the final polygon to 4326 as the last step. Return GeoJSON using `ST_AsGeoJSON()` on the 4326 polygon.

4. **ST_ConcaveHull fails or produces degenerate geometry for sparse node sets**: Short time bands (1-2 minutes) or origins near water/parks may return only 3-15 nodes, causing ST_ConcaveHull to return a POINT, LINESTRING, or EMPTY GEOMETRYCOLLECTION instead of a POLYGON. MapLibre fill layers silently ignore non-polygon geometry. **Prevention:** Add ST_Buffer fallback for degenerate results. Check geometry type after ST_ConcaveHull and apply a 50-foot buffer if the result is not a polygon. Set minimum node count threshold (use ST_ConvexHull + ST_Buffer for <4 nodes).

5. **Overlapping isochrone polygons create opacity stacking artifacts**: Concentric bands (5/10/15 min) rendered as overlapping semi-transparent fills produce a "bullseye" effect where the center (most accessible area) appears darkest due to stacked opacity. **Prevention:** Use PostGIS `ST_Difference` to create true concentric donut rings (15-min ring = 15-min polygon MINUS 10-min polygon) so no polygons overlap. Alternatively, render all bands in a single fill layer with data-driven styling to avoid cross-layer blending. Render bands from outermost to innermost (largest polygon first).

## Implications for Roadmap

Based on research, suggested phase structure follows the data flow from database to frontend, ensuring each layer can be tested independently before building the next.

### Phase 1: SQL Foundation (pgr_drivingDistance + ST_ConcaveHull)

**Rationale:** The database layer is the foundation for all isochrone functionality. Nothing works without this. Building it first allows validation that pgRouting's reachability algorithm works correctly with the existing edge table, that mode-specific cost columns produce sensible results, and that ST_ConcaveHull generates displayable polygons. This phase can be tested directly in the database container with psql queries without any API or frontend changes.

**Delivers:** `getisochrone()` SQL function in `05_functions.sql` returning GeoJSON-ready polygons (SRID 4326) for all requested time bands. Function accepts lon/lat origin, travel mode, and time band array, returning a table with `time_minutes`, `node_count`, `area_sq_ft`, and `geom` columns.

**Addresses:** Core reachability computation using pgr_drivingDistance, mode-specific graph filtering (drive/bike/walk), polygon generation from edge geometries, coordinate system transformation.

**Avoids:**
- Cost unit mismatch pitfall (uses `time_*` columns not `cost_*`)
- SRID confusion pitfall (runs ST_ConcaveHull in 2263, transforms result to 4326)
- Degenerate geometry pitfall (ST_Buffer fallback for sparse node sets)
- Performance pitfall (spatial bounding box on edge query, single call for all bands)

**Test:** Direct SQL execution in psql: `SELECT * FROM getisochrone(-73.985, 40.748, 'drive', ARRAY[5, 10, 15])`. Validate polygon coordinates are in lon/lat range, area values are reasonable, and ST_AsText shows valid POLYGON geometry.

**Research needed:** No - pgr_drivingDistance is well-documented in pgRouting 3.8 manual, ST_ConcaveHull is standard PostGIS with clear parameter documentation.

### Phase 2: API Endpoint (Service Layer + Response Models)

**Rationale:** With the SQL function working, wrap it in the existing service layer pattern to provide HTTP access. This phase enables independent testing via Swagger UI or curl without requiring any frontend changes. It validates that WKB-to-GeoJSON conversion works correctly, that caching prevents redundant computation, and that error handling covers edge cases (invalid coordinates, no reachable nodes, etc.).

**Delivers:** `GET /api/isochrone` endpoint accepting `origin` (lon,lat), `mode` (drive/bike/walk), and `times` (comma-separated minutes) query parameters, returning `IsochroneResponse` with GeoJSON FeatureCollection of polygons. `IsochroneService` class in `api/services/isochrone.py` handles business logic. Pydantic models in `api/models/schemas.py` define request/response structure.

**Uses:**
- `parse_coordinates()` for input validation (existing utility)
- `dump_geo()` for WKB-to-GeoJSON conversion (existing utility)
- `RouteCache` for caching (existing utility with mode-specific keys)
- `get_db_engine()` for database access (existing dependency injection)

**Implements:** `IsochroneService` class following `RoutingService` pattern (cache-first → parse → SQL → format → cache result). Response includes per-feature color and opacity properties so frontend can use data-driven styling.

**Avoids:**
- Performance issues (aggressive caching with 5-minute TTL)
- Validation gaps (Pydantic models enforce coordinate ranges, mode enum, time limits)

**Test:** `curl "http://localhost:5001/api/isochrone?origin=-73.985,40.748&mode=drive&times=5,10,15"`. Validate response structure, GeoJSON geometry types, color/opacity properties, cache headers.

**Research needed:** No - mirrors existing `/api/route` endpoint pattern exactly, uses same utilities and patterns.

### Phase 3: Frontend Rendering (Context + Map Layers)

**Rationale:** With a working API serving GeoJSON, focus on visualization. The existing `useGeoJsonLayer` hook already supports fill layers with data-driven styling, so rendering is straightforward. This phase establishes the state management pattern (separate IsochroneContext) and layer z-ordering (isochrones beneath routes). Building this before UI controls allows testing with hardcoded data or browser console to validate rendering before adding interaction complexity.

**Delivers:**
- `IsochroneContext` for state management (origin, time bands, mode, polygon data, isActive flag)
- `useIsochroneFetch` hook for API calls (mirrors `useRouteFetch` pattern)
- Isochrone fill and outline layers in `MapLibreGLMap.tsx` using existing `useGeoJsonLayer` hook
- Layer z-ordering with `beforeId: "routeHaloLayer"` to place isochrones beneath routes

**Uses:**
- `useGeoJsonLayer` for fill and line layer rendering (existing hook, supports fill type and beforeId)
- `MapInstanceContext` for map instance access (existing)
- `MessageContext` for error display (existing)
- `removeMapLayerAndSource` utility for cleanup (existing)

**Implements:**
- Separate `IsochroneContext` (not extending `RoutingContext` to avoid re-render cascade)
- Fill layer with data-driven `fill-color` and `fill-opacity` via `["get", "property"]` expressions
- Optional outline layer for crisp boundaries

**Avoids:**
- Context bloat pitfall (separate IsochroneContext prevents re-renders in route components)
- Opacity stacking artifacts (polygons use ST_Difference donut rings from Phase 1 SQL)
- Layer z-order issues (beforeId ensures isochrones render beneath routes)

**Test:** Hardcoded GeoJSON data first, then API integration. Validate fill colors match properties, transparency is correct, layers appear beneath route, clearing works.

**Research needed:** No - MapLibre fill layers are standard, existing `useGeoJsonLayer` hook provides all needed functionality, pattern from Stadia Maps/Mapbox tutorials.

### Phase 4: UI Controls (Origin Selection + Mode Toggle)

**Rationale:** The most subjective part. With the core visualization pipeline working (SQL → API → rendering), UI controls are the final integration piece. Building this last allows iteration on UX without touching the data pipeline. The controls integrate with existing components (Search, TravelModeSelect) and add new interactions (click-on-map origin).

**Delivers:**
- `IsochroneControls` component with origin picker, time band selector, and clear button
- Map click handler for origin selection
- Integration with existing Search component (single-address mode)
- Mode toggle between "Directions" and "Reachability" in sidebar

**Addresses:**
- Click-on-map origin (standard isochrone interaction pattern)
- Address search integration (reuse existing Geosupport Search)
- Fixed time band presets (5/10/15/20 min - standard across all isochrone tools)

**Avoids:**
- Over-engineering pitfall (fixed presets not custom time entry initially)
- Mode switching stale layers pitfall (explicit cleanup when toggling between route/isochrone modes)

**Test:** Manual UX testing - address search, map click, mode switching, clear button. Validate state flows correctly through IsochroneContext.

**Research needed:** No - standard UI controls, existing component patterns.

### Deferred to Future Phases

**Traffic-aware isochrones (HIGH value but adds complexity):** Apply `traffic_factor` multiplication to edge costs in pgr_drivingDistance SQL (same pattern as `getdrivingroute_with_traffic`). Requires testing the traffic factor pipeline with isochrone queries and validating that time-of-day factors produce realistic results. Defer until basic isochrones are validated.

**Time slider (nice UX but requires performance optimization):** Dynamic slider adjusting max time requires either sub-500ms API response times (aggressive optimization) or client-side caching of the full node set with front-end polygon computation. Fixed presets work fine for v1.

**Edge-based visualization (alternative view mode):** Color individual street segments by time band instead of generating polygons. Simpler (no ST_ConcaveHull needed) but less conventional. Add after polygon approach is solid to offer both visualization modes.

**Deep links (low complexity but not MVP-critical):** Encode origin, mode, time bands in URL params. Extends existing `useRouteStateSync` pattern. Low-hanging fruit for post-MVP.

**Summary statistics (requires additional SQL aggregation):** Area covered (ST_Area on polygon), street count (COUNT from pgr_drivingDistance result), estimated population (requires census data overlay). Adds sidebar UI work.

**Animated expansion (pure polish):** Sequential opacity transitions on each band layer with staggered delays. Add last if time permits.

### Phase Ordering Rationale

- **Linear dependencies enforce build order**: Each phase requires the previous to be complete before testing the next. SQL function must exist before API can call it. API must work before frontend can fetch data. Rendering must work before controls can trigger it.

- **Independent testing at each layer**: Database queries can be tested in psql. API can be tested with curl/Swagger. Rendering can be tested with hardcoded data. This incremental validation reduces debugging complexity.

- **Architecture pattern matching reduces risk**: Every phase mirrors an existing pattern in the codebase (SQL functions like `getdrivingroute`, service classes like `RoutingService`, contexts like `RoutingContext`, hooks like `useRouteFetch`). No novel architectural patterns needed.

- **Critical pitfall avoidance built into Phase 1**: The most severe pitfalls (cost unit mismatch, SRID confusion, degenerate geometry, unbounded performance) are all addressed in the SQL function design. Getting Phase 1 right prevents cascading issues in later phases.

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (SQL)**: pgr_drivingDistance is documented in pgRouting 3.8 manual with clear examples, ST_ConcaveHull is standard PostGIS with parameter documentation
- **Phase 2 (API)**: Exact pattern match with existing RoutingService, uses same utilities and dependency injection
- **Phase 3 (Rendering)**: MapLibre fill layers are established pattern, existing `useGeoJsonLayer` hook provides complete abstraction
- **Phase 4 (Controls)**: Standard UI components, existing Search/TravelModeSelect patterns

**Runtime verification needed (not research):**
- **GEOS version check**: `SELECT postgis_geos_compiled_version()` during Phase 1 to determine if fast native ST_ConcaveHull is available (affects performance not functionality)
- **Performance benchmarking**: Actual pgr_drivingDistance timing with spatial bounds and varying time bands to validate caching strategy
- **ST_ConcaveHull param tuning**: Test `param_pctconvex` values (0.3, 0.5, 0.7) with real NYC street network data to find best balance of shape quality vs computation time

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies required - all capabilities exist in current packages. Only uncertainty is GEOS version affecting ST_ConcaveHull performance (not functionality), with clear upgrade path. |
| Features | MEDIUM-HIGH | Table stakes derived from Mapbox/Valhalla/TravelTime API documentation and production isochrone tool patterns. Differentiators validated against existing traffic data pipeline. Some UX preferences inferred from industry patterns. |
| Architecture | HIGH | Direct codebase analysis shows exact pattern matches with existing routing implementation. All integration points verified (edge table schema, service layer pattern, context architecture, hook patterns, map layer management). |
| Pitfalls | HIGH | All pitfalls verified against pgRouting 3.8 documentation, PostGIS 3.5 documentation, MapLibre style specification, and actual codebase constraints (SRID 2263, edge cost columns, layer z-ordering). Cost unit mismatch validated by inspecting `03_cost.sql` penalty logic. |

**Overall confidence:** HIGH

Research is comprehensive across all domains with primary sources (official documentation, verified codebase analysis). The only low-confidence area is GEOS version in the Docker image (inferred from similar tag examples rather than verified), but this affects only performance optimization, not core functionality, and has a documented upgrade path.

### Gaps to Address

**GEOS version verification (Phase 1):**
- Run `SELECT postgis_geos_compiled_version()` in the database container during Phase 1 development
- If result is >= 3.11.0: Native fast ST_ConcaveHull implementation is available (optimal, 10-50ms per polygon)
- If result is < 3.11.0: Legacy PL/pgSQL implementation will be used (100-500ms per polygon, acceptable for PoC)
- If performance is insufficient: Upgrade Docker image from `pgrouting/pgrouting:17-3.5-3.8` to `pgrouting/pgrouting:17-3.6-3.8` (drop-in replacement with PostGIS 3.6 + GEOS 3.11+)

**No other gaps identified:** Research covered all integration points, validated against actual codebase structure, and identified clear mitigations for all critical pitfalls.

## Sources

### Primary (HIGH confidence)

**Stack research:**
- [pgr_drivingDistance - pgRouting Manual 3.8](https://docs.pgrouting.org/latest/en/pgr_drivingDistance.html) - Function signature, parameters, return columns, version compatibility
- [ST_ConcaveHull - PostGIS Documentation](https://postgis.net/docs/ST_ConcaveHull.html) - Function parameters, GEOS 3.11+ enhancement, edge cases
- [MapLibre GL JS Style Spec - Layers](https://maplibre.org/maplibre-style-spec/layers/) - Fill layer paint properties, data-driven styling
- [pgr_alphaShape Deprecation - pgRouting Issue #2749](https://github.com/pgRouting/pgrouting/issues/2749) - Confirmed deprecated in 3.8
- [pgRouting Docker Repository](https://github.com/pgRouting/docker-pgrouting) - Image tag conventions and version matrix

**Features research:**
- [Mapbox Isochrone API Documentation](https://docs.mapbox.com/api/navigation/isochrone/) - 4-contour standard, time limits, profile options
- [Valhalla Isochrone API Reference](https://valhalla.github.io/valhalla/api/isochrone/api-reference/) - Contour parameters, costing models
- [pgr_drivingDistance - pgRouting Manual 3.8](https://docs.pgrouting.org/latest/en/pgr_drivingDistance.html) - Reachability algorithm documentation

**Architecture research:**
- Direct codebase analysis of all integration points - HIGH confidence (actual file inspection)
- [MapLibre GL JS Style Spec](https://maplibre.org/maplibre-style-spec/layers/) - Fill layer specification
- [pgr_drivingDistance documentation](https://docs.pgrouting.org/latest/en/pgr_drivingDistance.html) - Algorithm details
- [PostGIS ST_ConcaveHull](https://postgis.net/docs/ST_ConcaveHull.html) - Polygon generation

**Pitfalls research:**
- Direct codebase analysis of `03_cost.sql`, `05_functions.sql`, edge table schema, layer management code
- [ST_ConcaveHull edge cases - PostGIS #1973](https://trac.osgeo.org/postgis/ticket/1973) - Empty geometry bug
- [MapLibre opacity blending - Mapbox #859](https://github.com/mapbox/mapbox-gl-js/issues/859) - Fill layer opacity stacking

### Secondary (MEDIUM confidence)

- [Stadia Maps Isochrone Tutorial](https://docs.stadiamaps.com/tutorials/display-isochrones-on-a-map/) - MapLibre fill layer implementation pattern
- [Maptoolkit Isochrone Example](https://www.maptoolkit.com/doc/routing/isochrone-example-maplibre/) - Fill + line layer pattern
- [ColorBrewer](https://colorbrewer2.org/) - Sequential palette recommendations
- [GraphHopper High-Precision Reachability](https://www.graphhopper.com/blog/2018/07/04/high-precision-reachability/) - Edge-based vs polygon visualization
- [Isochrone UX Patterns](https://ux-patterns.webgeodatavore.com/isochrone-map/index.html) - Common interaction patterns

### Tertiary (LOW confidence - needs validation)

- GEOS version in `pgrouting/pgrouting:17-3.5-3.8` inferred as 3.9.0 from similar tag examples - must verify with `postgis_geos_compiled_version()`

---
*Research completed: 2026-02-13*
*Ready for roadmap: yes*
