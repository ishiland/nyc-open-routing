# Project Research Summary

**Project:** NYC Open Routing v2.0 -- Edge-Based Isochrones & Waypoint Routing
**Domain:** Multi-modal routing enhancement with pgRouting 3.8 + PostGIS 3.5 + React/MapLibre
**Researched:** 2026-02-14
**Confidence:** HIGH

## Executive Summary

This milestone adds two major capabilities to the existing NYC Open Routing app: edge-based isochrone visualization (replacing or complementing the current polygon approach with colored street segments showing precise reachability) and multi-stop waypoint routing (allowing intermediate stops between origin and destination). Both features require **zero new dependencies** — everything builds on the existing pgRouting 3.8, PostGIS 3.5, and MapLibre GL 5 stack.

The recommended approach for edge-based isochrones is a pure SQL upgrade: JOIN the existing `pgr_drivingDistance` edge results to the `edges` table to retrieve line geometries, then run `ST_ConcaveHull` on edge lines instead of node points. This produces tighter, more accurate polygons that follow the street network. The API response format remains unchanged (still returns polygons), making this a zero-impact frontend change. Alternatively, edge geometries can be returned directly to the frontend for line-layer rendering with data-driven color gradients — a more dramatic visual upgrade but with payload and rendering performance concerns at scale (5,000-15,000 edges for a 20-minute driving isochrone).

Waypoint routing extends the existing two-point routing to support ordered multi-stop trips using `pgr_trspVia` (or sequential `pgr_trsp` calls as a fallback). The backend changes are isolated (new SQL functions, new API endpoint), but the frontend requires substantial refactoring: `RoutingContext` must shift from `startAddress`/`endAddress` to a `waypoints[]` array, the sidebar needs dynamic waypoint inputs with drag-to-reorder, the map needs numbered waypoint markers, and URL state sync must handle N waypoints. The key architectural risk is the RoutingContext refactor — nearly every component reads start/end addresses, so a transitional approach (deriving start/end from waypoints[0] and waypoints[last]) is critical to avoid breaking existing functionality.

## Key Findings

### Recommended Stack

**Zero new dependencies.** Both features leverage existing infrastructure:

**Core technologies (all installed):**
- **pgRouting 3.8** (`pgr_drivingDistance`, `pgr_trspVia`/`pgr_dijkstraVia`, `pgr_KSP`) — All required functions exist in the current Docker image. `pgr_trspVia` has "Proposed" status in 3.8 but is equally stable as the existing `pgr_trsp` (also Proposed).
- **PostGIS 3.5** (`ST_LineSubstring`, `ST_ConcaveHull`, `ST_SimplifyPreserveTopology`) — For edge clipping, polygon generation, and geometry simplification.
- **MapLibre GL 5.3** (`line` layer with `interpolate` expression) — Data-driven line coloring for edge-based isochrones. No new frontend libraries needed.
- **Existing SQL functions** (`getnearestXXXnode`, `getdrivingroute`, etc.) — Reused for node snapping and turn instruction generation.

**Edge-based isochrones:**
- `pgr_drivingDistance` already returns an `edge` column — JOIN it to the `edges` table to get geometries.
- Partial edge clipping via `ST_LineSubstring` produces precise time-band boundaries.
- Two visualization options: (1) polygon improvement (replace node-based hull with edge-based hull) or (2) direct edge rendering (return LineStrings, color by `agg_cost`).

**Waypoint routing:**
- `pgr_trspVia` (preferred): Single call for all legs, returns `path_id` per leg, handles turn restrictions.
- Sequential `pgr_trsp` (fallback): Simpler, proven pattern, slightly slower but works with existing functions.
- `pgr_dijkstraVia`: Alternative for bike/walk modes (no turn restrictions).

### Expected Features

**Edge-Based Isochrones — Must have (table stakes):**
- Color street segments by time band (5 min, 10 min, 15 min, 20 min) — core feature value
- Sequential color ramp (green to red) matching existing polygon scheme — user expectation
- Line width scaling by zoom — visibility at all zoom levels
- Loading state during computation — network latency feedback

**Edge-Based Isochrones — Should have (differentiators):**
- Continuous color gradient via `interpolate` expression (smoother than 4 discrete bands)
- Toggle between polygon and edge view (or show both as overlay)
- Interactive hover on edges (street name + exact travel time)

**Edge-Based Isochrones — Defer (v2+):**
- Boundary edge interpolation (HIGH complexity, minimal visual impact)
- Traffic-colored edges (build after basic edge visualization stable)
- Voronoi cell filling around edges (unnecessary for dense NYC grid)

**Waypoint Routing — Must have (table stakes):**
- Add at least 1 intermediate waypoint — minimum viable multi-stop
- Remove waypoint — standard editing flow
- Reorder waypoints via drag-and-drop OR up/down buttons — user control
- Per-leg route display (map markers at waypoints) — visual clarity
- Per-leg turn-by-turn directions (sidebar grouped by leg) — navigation utility
- Total route summary (all legs) — trip planning overview
- URL deep links for waypoints — sharing/bookmarking

**Waypoint Routing — Should have (competitive):**
- Click-on-map to add waypoint — more intuitive than typing addresses
- Waypoint address autocomplete — consistency with existing Search UX
- Swap any adjacent stops (extend existing swap button) — quick reordering

**Waypoint Routing — Defer (v2+):**
- Via/pass-through waypoints (HIGH SQL complexity, niche use case)
- Route optimization ("best order") — TSP solver, impractical at this scale
- Leg-specific travel mode (walk to subway, bike to destination) — massive UI complexity

### Architecture Approach

**Edge-based isochrones are a SQL-layer upgrade with minimal integration surface.** The current `getdrivingisochrone()` joins `pgr_drivingDistance` results to `edges_vertices_pgr` for node points, then runs `ST_ConcaveHull`. The edge-based approach joins to `edges` for line geometries instead. The API response format remains `(band_index, minutes, node_count, geom)` — just better polygons. No frontend changes needed for the polygon improvement path. The alternative (direct edge rendering) returns GeoJSON LineStrings with `agg_cost` properties and requires new MapLibre layers but delivers a visually striking upgrade.

**Waypoint routing is a full-stack feature with broad integration impact.** The SQL layer adds `getdrivingroute_via()`, `getbikingroute_via()`, `getwalkingroute_via()` using `pgr_trspVia` (or sequential `pgr_trsp`). The API layer adds a `POST /api/route` endpoint with waypoints array body and extends the `RouteResponse` schema with a `leg` field and per-leg summaries. The frontend refactors `RoutingContext` from two fixed addresses to a `waypoints[]` array, adds dynamic waypoint inputs to the sidebar, renders numbered waypoint markers, updates URL state sync, and groups turn instructions by leg in `RouteList`.

**Major components:**
1. **SQL functions** (`05_functions.sql`) — Edge-based isochrone geometry retrieval, multi-waypoint routing via `pgr_trspVia`, turn instruction generation per leg
2. **API service layer** (`routing.py`, `isochrone.py`) — Waypoint route orchestration, response formatting with leg summaries
3. **RoutingContext** (frontend state) — Waypoint array management, derived start/end addresses for backward compatibility
4. **Sidebar UI** (frontend) — Dynamic waypoint inputs, add/remove/reorder controls, per-leg turn instruction grouping
5. **MapLibre layers** (frontend) — Edge-based isochrone line layer (optional), numbered waypoint markers
6. **URL state sync** (`useRouteStateSync.ts`) — Pipe-separated waypoint encoding, coordinate rounding

### Critical Pitfalls

1. **Edge-Based Isochrone Payload Explosion** — A 15-minute driving isochrone returns 5,000-15,000 edges (500KB-2MB GeoJSON vs 20-80KB for polygons). **Prevention:** Apply `ST_SimplifyPreserveTopology(geom, 0.0001)` server-side, cap edge count via arterial filtering, use `ST_AsGeoJSON(geom, 5)` for reduced precision, set `maxzoom: 14` on GeoJSON source.

2. **Waypoint Routing Latency Multiplication** — Sequential `pgr_trsp` calls for N waypoints = N+1 × route time (~400ms-1.2s for 3 waypoints). **Prevention:** Use `pgr_trspVia` for single-call multi-leg routing, or accept sequential calls with profiling (may be acceptable for 3-5 waypoints).

3. **Data-Driven Line Paint Expression Performance** — Coloring 10,000+ line features with `interpolate` expressions evaluated per-frame impacts GPU performance (drops below 30fps on mobile). **Prevention:** Pre-compute `band_index` server-side, use `match` expression (hash lookup) instead of `interpolate` (linear search), use `step` for line-width instead of smooth interpolation.

4. **Waypoint URL Length Limits** — N waypoints with addresses can exceed 500 characters, approaching browser/proxy limits (~2,048 chars). **Prevention:** Use pipe-separated coordinates (`via=-73.98,40.75|-73.97,40.76`), parallel `viaAddr` param, round coords to 4 decimal places, limit URL-encoded waypoints to 5-8.

5. **Waypoint Routing Breaks Flat RouteResponse Schema** — Existing `RouteResponse` returns a flat `features[]` array with no leg boundaries. Waypoint routes need per-leg summaries and leg identification. **Prevention:** Add optional `leg` field to `Properties` schema, add `legs: List[LegSummary]` to `RouteResponse`, insert synthetic "waypoint" features at leg boundaries, keep flat array for backward compatibility.

## Implications for Roadmap

Based on research, the features are independent and can be built in parallel, but waypoint routing has broader architectural impact. Edge-based isochrones are lower complexity with higher visual impact. Suggested phase structure:

### Phase 1: Edge-Based Isochrones (Polygon Improvement Path)
**Rationale:** SQL-only change, zero frontend impact, immediate quality improvement, isolated from waypoint routing.
**Delivers:** Tighter isochrone polygons that follow the street network instead of bridging gaps.
**Addresses:** Edge-based visualization (polygon variant from FEATURES.md), accurate reachability representation.
**Avoids:** Frontend complexity, payload explosion (still returns 4 polygons), rendering performance concerns.
**Implementation:** Modify `getdrivingisochrone()`, `getbikingroute()`, `getwalkingisochrone()` in `05_functions.sql` to JOIN `edges` instead of `edges_vertices_pgr`, add `ST_LineSubstring` for partial edge clipping, feed edge lines to `ST_ConcaveHull`.
**Effort:** LOW (single SQL file, no API or frontend changes)

### Phase 2: Waypoint SQL Functions
**Rationale:** Foundation for all waypoint routing, can be tested directly in psql, validates `pgr_trspVia` stability, independent of frontend changes.
**Delivers:** `getdrivingroute_via()`, `getbikingroute_via()`, `getwalkingroute_via()` SQL functions accepting coordinate arrays and returning `path_id` per leg.
**Uses:** `pgr_trspVia` (or sequential `pgr_trsp` as fallback), existing turn instruction CTE patterns, existing node snapping functions.
**Avoids:** Latency multiplication pitfall (single `pgr_trspVia` call vs N+1 sequential).
**Implementation:** Add 3-4 new functions to `05_functions.sql`, accept `FLOAT[]` arrays for lats/lons, snap all nodes in single query, call `pgr_trspVia`, extend turn instruction logic to reset at leg boundaries.
**Effort:** MEDIUM (complex SQL, turn instruction grouping per leg, leg boundary handling)

### Phase 3: Waypoint API Endpoint
**Rationale:** Wraps SQL functions in service pattern, can be tested via Swagger/curl, validates response format before frontend integration.
**Delivers:** `POST /api/route` endpoint, `WaypointRouteRequest`/`WaypointRouteResponse` schemas, `get_via_route()` service method.
**Implements:** Service layer orchestration, per-leg summary computation, backward-compatible schema extension.
**Avoids:** Breaking flat RouteResponse schema (adds optional `leg` field, preserves flat features array).
**Implementation:** Add schemas to `schemas.py`, extend `RoutingService` in `routing.py`, create POST endpoint in `routes/routing.py`.
**Effort:** MEDIUM (service logic, leg summary computation, schema design)

### Phase 4: RoutingContext Refactor
**Rationale:** Highest-risk frontend change, contained within context, transitional approach (derive start/end from waypoints) keeps existing components working.
**Delivers:** `waypoints[]` state management with derived `startAddress`/`endAddress`, add/remove/reorder waypoint actions.
**Implements:** Backward-compatible context refactor, immutable array state updates.
**Avoids:** Breaking existing components (derive start/end from waypoints[0]/waypoints[last]).
**Implementation:** Modify `RoutingContext.tsx`, add waypoints array state, derive start/end as computed values, add waypoint management methods, update context provider.
**Effort:** MEDIUM (broad component impact, careful backward compatibility management)

### Phase 5: Waypoint UI
**Rationale:** Most visible, most subjective, builds on validated backend (Phases 2-3) and state infrastructure (Phase 4).
**Delivers:** Dynamic waypoint inputs in sidebar, numbered waypoint markers on map, URL state sync for N waypoints, per-leg RouteList with grouped instructions.
**Implements:** Mobile/desktop conditional rendering (buttons vs drag), waypoint marker layers, pipe-separated URL encoding.
**Avoids:** Mobile drag-to-reorder pitfall (use buttons on mobile per `useResponsive` hook), URL length limits (pipe-separated coords, rounded precision).
**Implementation:** Modify `Sidebar.tsx`, `Search.tsx`, `RouteList.tsx`, `MapLibreGLMap.tsx`, `ButtonControls.tsx`, `useRouteStateSync.ts`, `RouteStateManager.tsx`.
**Effort:** HIGH (broad UI surface, mobile UX, marker rendering, URL encoding)

### Phase 6 (Optional): Edge-Based Isochrones (Direct Line Rendering)
**Rationale:** Builds on Phase 1, delivers dramatic visual upgrade, optional enhancement if Phase 1 quality improvement is insufficient.
**Delivers:** Line layer rendering of individual reachable edges, continuous color gradient via `interpolate` expression, toggle between polygon and edge views.
**Implements:** New API response format (edge GeoJSON FeatureCollection), new MapLibre line layer, toggle control in sidebar.
**Avoids:** Payload explosion (geometry simplification, edge count cap, reduced precision), rendering performance (pre-compute band_index, use `match`, set maxzoom).
**Implementation:** New SQL functions (`getdrivingisochroneedges()`, etc.), new API endpoint or response variant, new frontend layer configuration, toggle control in `IsochroneContext`.
**Effort:** MEDIUM-HIGH (SQL edge retrieval, frontend layer management, performance optimization)

### Phase Ordering Rationale

- **Phase 1 is isolated SQL** — No API or frontend changes, can be shipped independently, immediate quality improvement.
- **Phases 2-3-4 can partially overlap** — Phase 2 (SQL) and Phase 4 (frontend state) are independent. Phase 3 (API) depends on Phase 2. Phase 5 (UI) depends on Phases 3 + 4.
- **Phase 5 is last** — Requires validated backend (Phases 2-3) and state infrastructure (Phase 4). Building UI first risks discovering backend limitations late.
- **Phase 6 is optional** — Edge-based isochrones as direct line rendering is a visual upgrade, not a functional requirement. Phase 1 (polygon improvement) may be sufficient. Phase 6 can be deferred to v2.1 if payload/rendering concerns outweigh visual benefits.

### Research Flags

**Needs deeper research during planning:**
- **Phase 6 (optional edge rendering):** Performance benchmarking with actual NYC data at scale (10K+ edges), MapLibre rendering profiling on mobile devices.

**Standard patterns (skip research-phase):**
- **Phase 1:** Direct SQL upgrade with proven PostGIS functions, existing concave hull pattern.
- **Phase 2:** Standard pgRouting via-point pattern, well-documented in pgRouting 3.8 manual.
- **Phase 3:** Standard FastAPI endpoint pattern, existing service layer conventions.
- **Phase 4:** React context refactor with established backward-compatibility approach.
- **Phase 5:** Standard UI patterns (drag-to-reorder, marker rendering, URL encoding).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All functions verified in pgRouting 3.8 docs, zero new dependencies confirmed. `pgr_trspVia` availability in Docker image should be verified but is expected (Proposed functions are shipped). |
| Features | HIGH | Table stakes and differentiators align with Google Maps, Apple Maps patterns. Anti-features are well-reasoned (e.g., unlimited waypoints, TSP optimization). |
| Architecture | HIGH | Codebase analysis confirms integration points (SQL functions, API service layer, RoutingContext, MapLibre layers). Phase 1 SQL-only path is zero-risk. Phase 4 RoutingContext refactor is highest-risk but mitigated by transitional approach. |
| Pitfalls | HIGH | Payload explosion, latency multiplication, rendering performance, URL length limits, schema compatibility — all grounded in MapLibre issue reports, pgRouting docs, and direct codebase inspection. Mitigation strategies are specific and actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **`pgr_trspVia` runtime availability:** Research confirms it exists in pgRouting 3.8 (Proposed status), but actual Docker image verification is needed. Fallback to sequential `pgr_trsp` is viable if unavailable. **Action:** Run `SELECT proname FROM pg_proc WHERE proname = 'pgr_trspvia';` in db container during Phase 2 planning.

- **Edge-based isochrone feature count at scale:** Estimated 5,000-15,000 edges for 20-minute driving isochrone, but actual count depends on NYC network density near origin. **Action:** Test with representative origins (Manhattan CBD, outer boroughs, waterfront) during Phase 1 or Phase 6 planning.

- **MapLibre rendering performance on mobile:** Research cites MapLibre issues with 5,000-10,000 features, but actual performance depends on device GPU and data-driven expression complexity. **Action:** Profile on target devices (iPhone SE, mid-range Android) during Phase 6 planning if direct edge rendering is pursued.

- **Waypoint node snapping quality:** Nearest-node snapping may place waypoints on wrong side of one-way streets, causing detours. This is acceptable for v1 (matches existing origin/destination snapping behavior), but user testing may reveal higher sensitivity at intermediate waypoints. **Action:** Document as known limitation, consider showing snapped location on map (dual marker: drop point + snapped point).

## Sources

### Primary (HIGH confidence)
- [pgRouting 3.8 Manual — pgr_drivingDistance](https://docs.pgrouting.org/3.8/en/pgr_drivingDistance.html) — Confirmed `edge` column for edge-based isochrones
- [pgRouting 3.8 Manual — pgr_trspVia](https://docs.pgrouting.org/3.8/en/pgr_trspVia.html) — Proposed status, function signature, `path_id` semantics
- [pgRouting 3.8 Manual — pgr_dijkstraVia](https://docs.pgrouting.org/3.8/en/pgr_dijkstraVia.html) — Alternative for bike/walk modes
- [pgRouting 3.8 Manual — pgr_KSP](https://docs.pgrouting.org/3.8/en/pgr_KSP.html) — K-shortest paths for alternative routes
- [MapLibre Style Spec — Layers](https://maplibre.org/maplibre-style-spec/layers/) — Data-driven `line-color` and `line-width` expressions
- [MapLibre Style Spec — Expressions](https://maplibre.org/maplibre-style-spec/expressions/) — `interpolate`, `match`, `step` syntax
- [MapLibre GL JS — Large Data Guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) — Performance optimization strategies
- [PostGIS Manual — ST_LineSubstring](https://postgis.net/docs/ST_LineSubstring.html) — Partial edge clipping
- [PostGIS Manual — ST_ConcaveHull](https://postgis.net/docs/ST_ConcaveHull.html) — Polygon generation from line geometries

### Secondary (MEDIUM confidence)
- [Jeff Allen: Using Network Segments in the Visualization of Urban Isochrones](https://jamaps.github.io/docs/allen_2018_isochrones.pdf) — Academic basis for edge-based visualization
- [GraphHopper: High Precision Reachability with deck.gl](https://www.graphhopper.com/blog/2018/07/04/high-precision-reachability/) — Edge-based visualization at scale
- [Google Routes API: Intermediate Waypoints](https://developers.google.com/maps/documentation/routes/intermed_waypoints) — Leg-per-waypoint response structure
- [Google Routes API: Waypoint Types](https://developers.google.com/maps/documentation/routes/waypoint-types) — Stopover vs pass-through distinction
- [MapLibre issue #4364](https://github.com/maplibre/maplibre-gl-js/issues/4364) — FeatureCollection update performance benchmarks
- [MapLibre issue #106](https://github.com/maplibre/maplibre-gl-js/issues/106) — JSON.stringify bottleneck with large LineStrings

### Codebase Analysis (HIGH confidence)
- Direct examination of `05_functions.sql`, `routing.py`, `isochrone.py`, `schemas.py`, `RoutingContext.tsx`, `IsochroneContext.tsx`, `MapLibreGLMap.tsx`, `Sidebar.tsx`, `useRouteFetch.ts`, `useRouteStateSync.ts`, `mapHelpers.ts`, `style.ts`, `cache.py` — Integration points verified, existing patterns identified, component dependencies mapped.

---
*Research completed: 2026-02-14*
*Ready for roadmap: yes*
