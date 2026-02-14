# Domain Pitfalls: Isochrone/Reachability Visualization

**Domain:** pgRouting isochrone generation + PostGIS polygon conversion + MapLibre GL rendering on existing multi-modal routing app
**Researched:** 2026-02-13
**Confidence:** HIGH (codebase analysis + verified pgRouting/PostGIS/MapLibre documentation)

**Scope:** Pitfalls specific to adding isochrone visualization to the NYC Open Routing app with its 177k-edge pgRouting graph (SRID 2263), existing 8-layer MapLibre map, and React Context-based state management. Every pitfall references actual code, table schemas, or configuration in this codebase.

---

## Critical Pitfalls

Mistakes that cause incorrect results, multi-second query times, or require architectural rework.

### Pitfall 1: Cost Unit Mismatch Between pgr_drivingDistance and Edge Costs

**What goes wrong:**
The `distance` parameter in `pgr_drivingDistance(edges_sql, root_vid, distance)` is in **edge cost units**, not meters/feet/seconds. If you pass `distance=5` thinking "5 minutes" but your edge costs are in different units, the isochrone will be wildly wrong -- either covering all of NYC or a single block.

**Why it happens:**
The codebase uses time-based costs in minutes, but the units vary by mode and include penalty multipliers that make them **not** pure minutes:

| Mode | Cost Column | Unit | Gotcha |
|------|------------|------|--------|
| Drive | `cost_drive` | minutes (base) | Set from `time_drive` in `03_cost.sql` line 85-86. One-way penalties multiply by 100x (line 92, 98). |
| Bike | `cost_bike` | minutes (weighted) | Includes bike lane class multipliers: 0.8x for greenways, 3.0-5.0x for no-lane roads, 50x for stairs (`03_cost.sql` lines 115-216). A "5 minute" isochrone won't represent 5 real minutes. |
| Walk | `cost_walk` | minutes (weighted) | Includes highway penalties (50x), speed penalties (1.2x for arterials), ferry penalties (5x) (`03_cost.sql` lines 233-256). |

The `pgr_drivingDistance` function treats these costs as abstract units for the Dijkstra cutoff. Passing `distance=5.0` for driving means "aggregate cost <= 5.0 cost units" which IS approximately 5 minutes for bidirectional streets. But for biking, a cost of 5.0 on a no-bike-lane road represents only ~1.67 real minutes (5.0 / 3.0 penalty factor).

**Consequences:**
- Bike isochrones appear unrealistically small because cost penalties compress the reachable area
- Walk isochrones exclude areas behind a single highway segment (50x penalty consumes the entire budget)
- Drive isochrones on one-way street networks show asymmetric shapes that confuse users (correct behavior, but needs UX explanation)
- Users comparing drive vs walk isochrones see sizes that don't match their real-world experience

**Prevention:**
1. **Use `time_drive`/`time_bike`/`time_walk` columns as cost in the edges SQL passed to pgr_drivingDistance, NOT `cost_drive`/`cost_bike`/`cost_walk`.** The `cost_*` columns include routing preference penalties that distort isochrone boundaries. For isochrones, you want physical reachability, not routing preference.
2. **BUT: still filter by mode accessibility flags.** Use `WHERE driveable=TRUE` with `time_drive` as cost. The mode filter ensures the graph only includes traversable edges while the time column gives undistorted travel times.
3. **Handle one-way streets via the `directed` parameter.** Pass `directed := TRUE` and use `time_drive` for cost and a reverse cost column. For one-way edges (`one_way='FT'`), set `reverse_cost` to a large value (1000000) rather than using the 100x penalty from `cost_drive`.
4. **Document in the API response what the isochrone represents.** E.g., "Area reachable within 5 minutes of driving at posted speeds" -- not "5 minutes of biking preference-weighted cost."

**Detection (warning signs):**
- 5-minute drive isochrone covers a single block (cost units too large)
- 5-minute drive isochrone covers all of Manhattan (cost units too small)
- Bike and walk isochrones are nearly identical in size (penalty factors not differentiated)
- Isochrone has sharp straight edges (one-way streets blocking expansion, which may be correct but worth verifying)

**Phase relevance:** Must be resolved in Phase 1 (SQL function design). Getting the cost column wrong makes ALL downstream work invalid.

---

### Pitfall 2: pgr_drivingDistance Performance on 177k-Edge Graph Without Bounded Subgraph

**What goes wrong:**
`pgr_drivingDistance` runs Dijkstra on the entire edge set passed in the SQL query. With 177k edges and ~240k vertices, an unoptimized call scans the full graph. For large distance values (15+ minutes), this can take 2-5 seconds -- too slow for interactive use when users drag the origin point.

**Why it happens:**
Dijkstra's algorithm has complexity O(V log V + E) with a binary heap. For V=240,000 and E=177,000:
- Best case (small distance, early termination): ~50-200ms
- Worst case (large distance, dense NYC grid): ~2-5 seconds

The existing routing functions (`getdrivingroute`, etc.) use `pgr_trsp` which terminates when it reaches the destination node. `pgr_drivingDistance` has no destination -- it explores outward until ALL nodes within the cost budget are found. This means it always does more work than point-to-point routing.

Additionally, the edges SQL query (`SELECT id, source, target, cost, reverse_cost FROM edges WHERE driveable=TRUE`) loads ALL ~120k driveable edges into memory for Dijkstra, even if the isochrone only reaches 5,000 of them.

**Consequences:**
- API response times of 2-5 seconds for larger time bands (10-15 minutes)
- Request timeouts if multiple time bands are computed sequentially (e.g., 5, 10, 15 minutes = 3 separate calls)
- Memory pressure on the PostgreSQL Docker container (default memory may be insufficient)
- Users perceive the app as broken when isochrone takes 5x longer than route calculation

**Prevention:**
1. **Bound the edge query with a spatial envelope.** Before calling pgr_drivingDistance, calculate a generous bounding box around the origin point (e.g., 2x the maximum expected travel distance) and filter edges: `WHERE driveable=TRUE AND the_geom && ST_Expand(ST_SetSRID(ST_MakePoint(lon, lat), 2263), buffer_meters)`. For a 15-minute drive at 30mph, buffer = ~12,000 meters. This reduces the edge set from 177k to ~30-50k.
2. **Compute all time bands in a single call.** Use the largest time band (e.g., 15 minutes) and filter the results by `agg_cost` thresholds. pgr_drivingDistance returns `agg_cost` for each node -- filter in SQL: `WHERE agg_cost <= 5` for the 5-min band, etc. Do NOT call pgr_drivingDistance three times for three bands.
3. **Add a covering index for the isochrone query pattern.** The existing covering indexes (`idx_edges_drive_covering` in `06_performance_indexes.sql`) include `cost_drive`/`rcost_drive` but the isochrone query will use `time_drive`/`time_drive` (per Pitfall 1). A new index is needed:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_edges_drive_isochrone
   ON edges(source, target, time_drive)
   WHERE driveable = TRUE;
   ```
4. **Cache isochrone results aggressively.** Isochrones from the same origin + mode + time bands change rarely. Cache the PostGIS polygon result (not just nodes) keyed on `(origin_node_id, mode, max_time)`. The existing `utils/cache.py` pattern can be extended.
5. **Consider async/loading state.** Even with optimization, 500ms-1s is realistic. The frontend must show a loading indicator specific to isochrone calculation.

**Detection (warning signs):**
- API logs show pgr_drivingDistance taking >1 second
- PostgreSQL `work_mem` warnings in logs (Dijkstra spilling to disk)
- Response times increase linearly with the time band value
- Multiple sequential pgr_drivingDistance calls in the same request

**Phase relevance:** Must be addressed in Phase 1 (SQL function). Optimization cannot be retroactively bolted on without changing the function signature.

---

### Pitfall 3: SRID Mismatch Between Vertex Geometry, ST_ConcaveHull, and GeoJSON Output

**What goes wrong:**
The vertex table `edges_vertices_pgr.geom` stores coordinates in SRID 2263 (NY State Plane, feet). If you pass these directly to `ST_ConcaveHull`, the polygon is in SRID 2263. If you then return this as GeoJSON without transforming to SRID 4326 (WGS84 lon/lat), MapLibre will render the polygon in the wrong location (somewhere in the Atlantic Ocean or not at all).

Conversely, if you transform vertices to 4326 BEFORE running ST_ConcaveHull, the `param_pctconvex` parameter behaves differently because edge lengths in degrees are tiny (~0.00001) vs feet (~200-5000), potentially producing different hull shapes.

**Why it happens:**
The codebase has a dual-SRID architecture:
- `edges.the_geom`: SRID 2263 (used by pgRouting, topology, spatial queries)
- `edges.geom_4326`: SRID 4326 (cached WGS84, used by route response to frontend)
- `edges_vertices_pgr.geom`: SRID 2263 (matches `the_geom`)
- `getnearestdrivenode()` transforms input from 4326 to 2263 for KNN search (line 25 of `05_functions.sql`)

pgr_drivingDistance returns node IDs. Joining to get geometry gives SRID 2263 points. ST_ConcaveHull operates on these 2263 points. The result must be transformed to 4326 for the GeoJSON API response.

**Consequences:**
- Polygon appears at coordinates like (981000, 196000) instead of (-73.99, 40.73) -- invisible on MapLibre
- ST_ConcaveHull produces slightly different shapes depending on input SRID (because the pctconvex parameter is relative to edge lengths in the Delaunay triangulation)
- If you accidentally mix SRIDs (some vertices in 2263, some in 4326), PostGIS may silently produce garbage geometry or throw `ST_ConcaveHull: Input geometry has wrong SRID`

**Prevention:**
1. **Run ST_ConcaveHull on SRID 2263 geometries.** This is correct because 2263 is a projected coordinate system (feet) where distances are Euclidean. ConcaveHull on 4326 (degrees) produces distorted results at NYC's latitude.
2. **Transform the final polygon to 4326 as the last step.** Pattern:
   ```sql
   ST_Transform(
     ST_ConcaveHull(ST_Collect(v.geom), 0.3),
     4326
   )
   ```
3. **Return GeoJSON using `ST_AsGeoJSON()` on the 4326 polygon.** This matches the existing pattern where `05_functions.sql` returns `geom_4326` for route edges.
4. **Validate SRID in the function.** Add an assertion at the start of the isochrone function:
   ```sql
   IF ST_SRID((SELECT geom FROM edges_vertices_pgr LIMIT 1)) != 2263 THEN
     RAISE EXCEPTION 'Unexpected vertex SRID';
   END IF;
   ```

**Detection (warning signs):**
- Isochrone polygon coordinates have values >1000 (SRID 2263 feet, not 4326 degrees)
- Polygon renders at (0,0) or in the ocean on MapLibre
- ST_ConcaveHull returns a very small polygon (degree-based distances compress the triangulation)
- `ST_IsValid()` returns false on the output polygon

**Phase relevance:** Must be correct in Phase 1 (SQL function). An SRID bug will not produce an obvious error -- it will produce a plausible-looking but geographically wrong polygon.

---

### Pitfall 4: ST_ConcaveHull Fails or Produces Degenerate Geometry for Sparse Node Sets

**What goes wrong:**
For short time bands (1-2 minutes) or from locations with sparse connectivity (e.g., near water, parks, highway interchanges), pgr_drivingDistance may return very few nodes (3-15 points). ST_ConcaveHull with these inputs can:
1. Return a `POINT` (1 node reachable) or `LINESTRING` (2-3 collinear nodes) instead of a `POLYGON`
2. Return an `EMPTY GEOMETRYCOLLECTION` (documented PostGIS bug [#1973](https://trac.osgeo.org/postgis/ticket/1973))
3. Produce a polygon so small it's invisible at the map's current zoom level

**Why it happens:**
Per PostGIS documentation:
- "The concave hull of two or more collinear points is a two-point LineString"
- "The concave hull of one or more identical points is a Point"
- ST_ConcaveHull has a historical issue where it "returns sometimes empty geometry collection" for certain inputs

NYC's street grid has many locations where short-time reachability is linear (following a single avenue) rather than area-based. At 1 minute of walking (about 265 feet), you might reach only 3-4 nodes along a single street -- producing a line, not a polygon.

**Consequences:**
- API returns a GeoJSON Feature with geometry type "LineString" or "Point" instead of "Polygon" -- the MapLibre fill layer silently ignores non-polygon geometry
- Empty geometry causes a runtime error if the API tries to calculate area or perform ST_Difference for concentric bands
- Users see nothing on the map for short time bands, thinking the feature is broken
- ST_Difference between an inner LineString and outer Polygon throws a topology exception

**Prevention:**
1. **Add a ST_Buffer fallback for degenerate results.** After ST_ConcaveHull, check the geometry type:
   ```sql
   CASE
     WHEN ST_GeometryType(hull) IN ('ST_Point', 'ST_LineString', 'ST_GeometryCollection')
       OR ST_IsEmpty(hull)
     THEN ST_Buffer(ST_Collect(points), 50)  -- 50-foot buffer in SRID 2263
     ELSE hull
   END
   ```
   This ensures you always return a polygon, even if it's a buffered approximation.
2. **Set a minimum node count threshold.** If pgr_drivingDistance returns fewer than 4 nodes, skip ST_ConcaveHull entirely and use ST_ConvexHull + ST_Buffer instead (convex hull of 3+ non-collinear points always produces a polygon, and the buffer adds area for visual presence).
3. **Validate geometry type before returning.** The isochrone SQL function should enforce `RETURNS GEOMETRY(POLYGON, 4326)` or `GEOMETRY(MULTIPOLYGON, 4326)` and cast/wrap accordingly.
4. **Include the origin point in the node set.** Always add the starting node to the point collection even if pgr_drivingDistance doesn't return it (edge case: isolated node with no outgoing edges within budget).

**Detection (warning signs):**
- MapLibre fill layer shows nothing for 1-2 minute isochrones
- API response has `geometry.type` as "LineString" or "Point" (check in browser Network tab)
- PostGIS logs contain "Empty geometry" or "TopologyException" errors
- ST_Area() returns 0 or NULL for the isochrone polygon

**Phase relevance:** Must be handled in Phase 1 (SQL function) with explicit geometry type validation and fallback logic.

---

### Pitfall 5: Overlapping Isochrone Polygons Create Opacity Stacking Artifacts on MapLibre

**What goes wrong:**
When rendering concentric isochrone bands (5, 10, 15 minutes) as overlapping fill layers with transparency, the overlapping regions (where 5-min polygon overlaps with 10-min polygon) render with doubled opacity, creating a visual "bullseye" effect with jarring color banding instead of smooth concentric rings.

**Why it happens:**
MapLibre GL applies `fill-opacity` per layer, not per pixel. When two semi-transparent polygons overlap:
- The 15-min polygon (opacity 0.3, red) renders first
- The 10-min polygon (opacity 0.3, orange) renders on top -- where they overlap, effective opacity is ~0.51
- The 5-min polygon (opacity 0.3, green) renders on top of both -- center opacity is ~0.66

This is a [known MapLibre/Mapbox behavior](https://github.com/mapbox/mapbox-gl-js/issues/859). The fill-opacity is per-layer, and overlapping features within the same layer also blend.

The existing codebase renders routes as line layers (`routeHaloLayer`, `routeLayer`) which don't have this problem because lines don't overlap. Fill layers behave fundamentally differently.

**Consequences:**
- Center of isochrone (origin area) is visually darkest/most saturated -- the OPPOSITE of what users expect (origin should be most accessible, visually lightest)
- Color-coded time bands become illegible because blended colors don't match the legend
- On mobile (smaller screen), the opacity stacking makes the entire isochrone look like a dark blob
- Accessibility contrast ratios become unpredictable due to color blending

**Prevention:**
1. **Use ST_Difference to create true concentric rings (donut polygons) on the server side.** Before returning to the frontend:
   ```sql
   -- 15-min ring = 15-min polygon MINUS 10-min polygon
   ST_Difference(polygon_15min, polygon_10min)
   -- 10-min ring = 10-min polygon MINUS 5-min polygon
   ST_Difference(polygon_10min, polygon_5min)
   -- 5-min polygon stays as-is (innermost)
   ```
   This way, no polygons overlap and each pixel is covered by exactly one layer.
2. **If ST_Difference fails (topology exception from irregular polygons), fall back to rendering all bands in a single fill layer with data-driven styling.** Use a single GeoJSON source with multiple features, each having a `time_band` property, and use a MapLibre expression:
   ```js
   "fill-color": ["match", ["get", "time_band"],
     5, "#22c55e",
     10, "#facc15",
     15, "#ef4444",
     "#888888"
   ]
   ```
   Single-layer rendering avoids cross-layer blending (though within-layer overlaps still blend if ST_Difference wasn't applied).
3. **Render bands from outermost to innermost.** The 15-min band should be the bottom layer, 5-min on top. Use the `beforeId` parameter in `useGeoJsonLayer` (which already supports this, line 102-103 of `useGeoJsonLayer.ts`).
4. **Use `fill-opacity: 1.0` with pre-mixed semi-transparent colors** (e.g., `rgba(34, 197, 94, 0.3)` as `fill-color` with `fill-opacity: 1.0`). This renders each pixel exactly once with the correct color, eliminating blending math.

**Detection (warning signs):**
- Isochrone center is visually darker than the outer ring
- Colors don't match the legend/key
- Increasing `fill-opacity` makes the problem worse instead of better
- The 5-min band is barely visible because it's obscured by stacked opacity from all three bands

**Phase relevance:** Must be decided in Phase 1 (architecture). The ST_Difference approach is a SQL-side decision; the rendering approach is a frontend decision. Both must be coordinated.

---

## Moderate Pitfalls

Mistakes that cause subtle visual bugs or performance degradation without breaking core functionality.

### Pitfall 6: MapLibre Layer Z-Ordering -- Isochrone Polygons Obscure Route and Markers

**What goes wrong:**
Isochrone fill polygons, being area-based, will visually cover the route line layers and address markers if not placed in the correct z-order. The current layer stack in `MapLibreGLMap.tsx` is:

```
(bottom) routeHaloLayer -> routeLayer -> startPointLayer -> endPointLayer -> startPointLabelLayer -> endPointLabelLayer (top)
```

If isochrone fill layers are added without specifying `beforeId`, they render ON TOP of everything, hiding the route and markers.

**Why it happens:**
The `useGeoJsonLayer` hook (line 129-130) uses `addLayer(mapLayer, safeBeforeId)` where `beforeId` controls z-ordering. If `beforeId` is not specified or the referenced layer doesn't exist yet, the new layer goes to the top of the stack. The hook validates that `beforeId` exists (line 129: `const safeBeforeId = beforeId && map.getLayer(beforeId) ? beforeId : undefined`), so if the route layer hasn't been added yet, the isochrone layer falls through to the top.

Additionally, the existing `clearMap()` function in `MapLibreGLMap.tsx` (lines 204-213) removes all 6 route-related layers. If isochrone layers are not included in this cleanup, they will persist when the user clears addresses.

**Prevention:**
1. **Add isochrone layers BEFORE `routeHaloLayer` in the z-order.** Use `beforeId: "routeHaloLayer"` when calling `useGeoJsonLayer` for isochrone polygons. This places the fill beneath all route layers.
2. **Create a layer ordering constant.** Define the expected layer stack in `constants.ts`:
   ```ts
   export const MAP_LAYER_ORDER = [
     'isochrone15Layer',  // bottom
     'isochrone10Layer',
     'isochrone5Layer',
     'routeHaloLayer',
     'routeLayer',
     'startPointLayer',
     'endPointLayer',
     'startPointLabelLayer',
     'endPointLabelLayer', // top
   ] as const
   ```
3. **Handle the timing issue.** If isochrone mode is active and route layers don't exist yet, the `beforeId` will be undefined and the isochrone layer goes to top. When route layers are later added, they must be placed above the isochrone layers. This requires the route layer `useGeoJsonLayer` calls to use isochrone-aware `beforeId` values, or a re-ordering step after all layers are added.
4. **Extend `clearMap()` to include isochrone layers.** If isochrone layers are managed separately from route layers, add them to the cleanup function.

**Detection (warning signs):**
- Route line is invisible when isochrone is displayed (covered by fill polygon)
- Address markers disappear behind the isochrone fill
- Clearing the route leaves isochrone polygons on the map
- Switching from isochrone mode to route mode shows both overlaid

**Phase relevance:** Phase 2 (frontend rendering). Can be addressed independently of SQL function design.

---

### Pitfall 7: RoutingContext Bloat -- Adding Isochrone State to an Already-Large Context

**What goes wrong:**
Adding isochrone-related state (`isochrones`, `isochroneOrigin`, `isochroneTimeBands`, `isochroneMode`, `isIsochroneActive`, `isochroneFetching`) directly to `RoutingContext` causes every component that consumes `RoutingContext` to re-render on ANY isochrone state change, even components that don't use isochrone data (Search, RouteList, TravelModeSelect, etc.).

**Why it happens:**
`RoutingContext.tsx` already has 12 state fields and 12 setter functions (lines 14-46). The `useMemo` on the context value (lines 238-291) includes ALL state in its dependency array. Adding 6 more isochrone fields means the memoized value changes whenever ANY isochrone state changes, triggering re-renders in all consumers.

The most impactful re-render victims:
- `MapLibreGLMap.tsx` (memoized with `React.memo` but destructures 5 context values)
- `RouteList.tsx` (memoized with `React.memo` but consumes `route` from context)
- `RouteSummaryCard.tsx` (reads `route`, `mode`, `useTraffic` from context)

**Consequences:**
- MapLibre re-renders during isochrone loading (potential frame drops)
- Route list and summary card re-render when isochrone data changes (unnecessary work)
- Context value object identity changes on every isochrone update, defeating `React.memo` for all consumers
- Performance degradation especially on mobile devices

**Prevention:**
1. **Create a separate `IsochroneContext`.** Keep isochrone state completely isolated from routing state. Components that need both can consume both contexts independently.
   ```tsx
   // IsochroneContext.tsx
   export interface IsochroneContextType {
     isActive: boolean
     origin: IMapFeature | null
     timeBands: number[]
     polygons: GeoJSON.FeatureCollection | null
     isFetching: boolean
     setActive: (active: boolean) => void
     setOrigin: (origin: IMapFeature | null) => void
     setTimeBands: (bands: number[]) => void
     fetchIsochrone: () => void
   }
   ```
2. **Share travel mode between contexts.** The `mode` (drive/bike/walk) is relevant to both routing and isochrones. Keep it in `RoutingContext` and have `IsochroneContext` read it:
   ```tsx
   const { mode } = useContext(RoutingContext)
   // Use mode in isochrone fetch
   ```
3. **Use the existing `useGeoJsonLayer` hook for isochrone rendering.** It already supports `fill` layer type (line 8 of `useGeoJsonLayer.ts`). No need to create a new rendering mechanism.

**Detection (warning signs):**
- React DevTools Profiler shows RouteList re-rendering during isochrone fetch
- `MapLibreGLMap` component re-renders when isochrone state changes (check console logs)
- Frame rate drops during isochrone loading on mobile

**Phase relevance:** Phase 2 (frontend architecture). Must be decided before implementing any isochrone components.

---

### Pitfall 8: pgr_drivingDistance Returns Only Reachable Nodes -- Not Partial Edge Reach

**What goes wrong:**
pgr_drivingDistance returns nodes (intersections) where `agg_cost <= distance`. It does NOT interpolate along edges. If a node is at agg_cost=4.8 minutes and the next node along an edge is at agg_cost=5.3 minutes, the isochrone boundary is drawn at the 4.8-minute node -- losing the ~0.2 minutes of reachable street between the nodes.

This creates an isochrone polygon that systematically underestimates the reachable area, with "nibbled" edges at the boundary where the polygon boundary cuts across blocks at intersections rather than mid-block.

**Why it happens:**
pgr_drivingDistance signature returns `(seq, depth, start_vid, pred, node, edge, cost, agg_cost)` where `node` is a vertex ID and `agg_cost` is the cumulative cost to reach that vertex. There is no concept of "partial edge traversal" in the return value. The Dijkstra algorithm operates on vertices, not on points along edges.

NYC's street grid has average block lengths of 250-900 feet. At walking speed (3 mph = 264 ft/min), a single block edge takes about 1-3.5 minutes. Missing the last partial block is a 20-40% underestimate of reachable area at the boundary.

**Consequences:**
- Isochrone appears "jagged" at the boundary, cutting across blocks at intersections
- 5-minute walking isochrone misses the last ~1 minute of each boundary edge (20% area loss)
- Driving isochrones are less affected (shorter traversal times per edge, more nodes reached)
- Users compare to Google Maps / Mapbox isochrones which DO interpolate, making this look broken

**Prevention:**
1. **Accept the approximation for v1.** Node-only isochrones are standard for pgRouting implementations. Document this limitation and address in a future version.
2. **Apply a small ST_Buffer to the concave hull.** After generating the polygon from node positions, buffer it by the average half-edge-length for the mode:
   ```sql
   -- Average half-edge for driving: ~150 feet in SRID 2263
   ST_Buffer(ST_ConcaveHull(ST_Collect(v.geom), 0.3), 150)
   ```
   This roughly compensates for the missing partial edges. Tune the buffer distance per mode.
3. **For future improvement: interpolate boundary edges.** For nodes at the boundary (where agg_cost is within one edge of the distance cutoff), compute the fraction traversed and place a point along the edge geometry using `ST_LineInterpolatePoint`. This is complex but produces professional-quality isochrones.
4. **Use ST_ConcaveHull param_pctconvex of 0.3-0.5** (not too concave). A more convex hull naturally fills in some of the boundary gaps, producing a smoother result that approximates the partial-edge reach.

**Detection (warning signs):**
- Isochrone boundary follows exact intersection points (looks "stairstep" on a grid)
- Boundary edge nodes are all at agg_cost values well below the cutoff (e.g., 4.0-4.8 for a 5-minute isochrone)
- Comparison with commercial isochrone APIs shows consistent underestimate

**Phase relevance:** Phase 1 (SQL function). The buffer approximation should be included from the start. Interpolation is a Phase 3+ enhancement.

---

## Minor Pitfalls

### Pitfall 9: ST_ConcaveHull param_pctconvex Performance Trap

**What goes wrong:**
Setting `param_pctconvex` too low (e.g., 0.01) for maximum concavity causes ST_ConcaveHull to run for 5-30 seconds on point sets of 5,000+ nodes. This is because the runtime grows quadratically with decreasing pctconvex.

**Prevention:**
- Use `param_pctconvex` between 0.3 and 0.5 for interactive use. A value of 0.3 provides good concavity without excessive computation.
- For 15-minute isochrones that may return 10,000+ nodes, use 0.5 or higher.
- If PostGIS 3.3+ with GEOS 3.11+ is available (check in the Docker image), the native GEOS implementation is significantly faster. Verify with `SELECT postgis_geos_version();`

---

### Pitfall 10: One-Way Streets Create Asymmetric Isochrones That Confuse Users

**What goes wrong:**
Manhattan's one-way avenue grid means a 5-minute driving isochrone from Midtown will extend further south than north (because more avenues flow south). This is physically correct but visually confusing -- users expect symmetric shapes.

**Prevention:**
- This is correct behavior. Do NOT "fix" it by using undirected graph mode.
- Add a tooltip or info icon explaining: "Isochrone shape reflects one-way street patterns and speed limits."
- Use `directed := TRUE` in the pgr_drivingDistance call to respect one-way streets. The existing edges already encode directionality through `cost_drive` vs `rcost_drive` (one-way penalties), but per Pitfall 1, the isochrone function should use `time_drive` with explicit reverse cost handling.

---

### Pitfall 11: Water Bodies and Parks Create False Concave Hull "Bridges"

**What goes wrong:**
ST_ConcaveHull connects boundary points across water bodies (East River, Hudson River, Central Park) where no streets exist. The hull polygon may "bridge" across water, showing areas as reachable when they are not.

**Prevention:**
- Accept this for v1. Most commercial isochrone services have the same limitation unless they clip against water/park polygons.
- For future improvement: clip the isochrone polygon against a NYC land area polygon using ST_Intersection. This requires importing a separate NYC borough boundary dataset.
- Use a more concave param_pctconvex (0.2-0.3) which naturally avoids large gaps where no nodes exist, reducing false bridges.

---

### Pitfall 12: Mode Switching Between Route and Isochrone Leaves Stale Map Layers

**What goes wrong:**
When a user switches from Route mode (showing a route line) to Isochrone mode (showing fill polygons), the route layers persist on the map unless explicitly removed. The reverse is also true -- switching from Isochrone back to Route leaves isochrone polygons visible.

**Prevention:**
1. **Clear route layers when entering isochrone mode and vice versa.** Extend or complement the existing `clearMap()` function in `MapLibreGLMap.tsx` (lines 204-213) to handle isochrone layers.
2. **Use a top-level "view mode" state** (in the new `IsochroneContext` or a shared UI context) that determines which set of layers is active. When view mode changes, remove the previous mode's layers.
3. **Do NOT remove address markers when switching modes.** The origin address is shared between route and isochrone modes. Only remove route-specific layers (route line, halo) and isochrone-specific layers (fill polygons).

---

## Phase-Specific Warnings

| Phase/Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| SQL function design | Cost unit mismatch (Pitfall 1) | Use `time_*` columns, not `cost_*` for isochrone distance | CRITICAL -- invalidates all results |
| SQL function design | Unbounded Dijkstra (Pitfall 2) | Spatial bounding box + single call for all bands | CRITICAL -- 2-5s response times |
| SQL function design | SRID mismatch (Pitfall 3) | Run ST_ConcaveHull on 2263, transform result to 4326 | CRITICAL -- polygon in wrong location |
| SQL function design | Sparse node degenerate geometry (Pitfall 4) | ST_Buffer fallback for <4 nodes or non-polygon results | CRITICAL -- empty map for short bands |
| Frontend rendering | Opacity stacking (Pitfall 5) | ST_Difference for donut rings OR pre-mixed colors | HIGH -- illegible visualization |
| Frontend rendering | Layer z-ordering (Pitfall 6) | Place isochrone layers before routeHaloLayer | MODERATE -- route hidden behind fill |
| Frontend state | Context bloat (Pitfall 7) | Separate IsochroneContext, not added to RoutingContext | MODERATE -- unnecessary re-renders |
| SQL accuracy | Partial edge underestimate (Pitfall 8) | ST_Buffer approximation on concave hull | LOW -- acceptable for v1 |
| SQL performance | ST_ConcaveHull pctconvex (Pitfall 9) | Use 0.3-0.5, benchmark with real data | LOW -- only affects large isochrones |
| UX | Asymmetric isochrones (Pitfall 10) | Explain behavior, don't "fix" with undirected mode | LOW -- user education |
| UX | Water/park bridges (Pitfall 11) | Accept for v1, clip with boundary polygon later | LOW -- visual imperfection |
| Frontend | Stale layers on mode switch (Pitfall 12) | Explicit layer cleanup on mode transition | MODERATE -- confusing but not breaking |

## Integration Pitfalls Across Concerns

### Cross-Concern 1: SQL Performance + Frontend Loading = UX Perception

If the SQL function takes 1-2 seconds (optimized) and the frontend shows no loading indicator, users will perceive the feature as broken. The isochrone fetch must integrate with a loading state that triggers BEFORE the API call and clears AFTER polygon rendering. The existing `useRouteFetch` pattern (with `isFetching` state) should be replicated for isochrone fetching.

### Cross-Concern 2: Cost Unit Choice + Frontend Time Labels = Mismatch

If the SQL function uses `time_drive` (pure minutes) but the frontend labels bands as "5 min / 10 min / 15 min", the labels are accurate for driving but misleading for biking/walking where terrain and infrastructure affect actual travel time. The API response should include metadata about what the time bands represent.

### Cross-Concern 3: Layer Z-Order + Mode Switching + Stale State = Ghost Layers

If a user views a route, then switches to isochrone mode, then switches back to route, any layer cleanup that's incomplete will leave ghost layers. The route rendering assumes it's the only fill content on the map. The isochrone fill layers could interfere with the `clearMap()` function if they share source naming patterns. Use a distinct naming convention: `isochrone_*` prefix for all isochrone sources and layers.

### Cross-Concern 4: Separate IsochroneContext + Shared Mode = Split-Brain

If `mode` lives in `RoutingContext` and the isochrone feature reads it from there, changing mode in the TravelModeSelect component triggers BOTH a route recalculation AND an isochrone recalculation. The isochrone feature needs to either:
- Only recalculate when isochrone mode is active (check `isActive` before fetching)
- Debounce the mode change to avoid double API calls

## Sources

### pgRouting
- [pgr_drivingDistance -- pgRouting Manual 3.8](https://docs.pgrouting.org/latest/en/pgr_drivingDistance.html) -- function signature, parameters, return values (HIGH confidence)
- [pgr_drivingDistance performance with array of start points -- Issue #882](https://github.com/pgRouting/pgrouting/issues/882) -- memory allocation failures with multiple start nodes (HIGH confidence)
- [pgr_contractionHierarchies -- Experimental](https://docs.pgrouting.org/latest/en/pgr_contractionHierarchies.html) -- not yet integrated with pgr_drivingDistance (MEDIUM confidence)

### PostGIS
- [ST_ConcaveHull -- PostGIS Documentation](https://postgis.net/docs/ST_ConcaveHull.html) -- param_pctconvex behavior, edge cases, GEOS 3.11 native implementation (HIGH confidence)
- [ST_ConcaveHull returns empty geometry collection -- PostGIS #1973](https://trac.osgeo.org/postgis/ticket/1973) -- documented bug with certain inputs (HIGH confidence)
- [Isochrones are not Alpha Shapes -- Darafei Praliaskouski](https://www.patreon.com/posts/isochrones-are-20933638) -- limitations of alpha shapes for isochrone generation (MEDIUM confidence)

### MapLibre GL
- [Polygon fill layer rendering issues -- MapLibre #4357](https://github.com/maplibre/maplibre-gl-js/issues/4357) -- fill layer clipping artifacts (HIGH confidence)
- [Stacking polygons with fill-color and opacity -- Mapbox #859](https://github.com/mapbox/mapbox-gl-js/issues/859) -- opacity blending behavior with overlapping fills (HIGH confidence)
- [Dynamic z-ordering across groups of style layers -- MapLibre #2108](https://github.com/maplibre/maplibre-gl-js/issues/2108) -- z-ordering limitations (MEDIUM confidence)
- [Visualize Travel Time with Isochrones -- Stadia Maps](https://docs.stadiamaps.com/tutorials/display-isochrones-on-a-map/) -- fill layer rendering pattern for isochrones (MEDIUM confidence)

### Isochrone UX
- [Isochrone Maps: The Clear-Cut Guide -- Zors.ai](https://www.zors.ai/blog/isochrone-maps-travel-time-guide) -- common UX pitfalls (MEDIUM confidence)
- [UX Patterns for Maps -- Isochrone Map](https://ux-patterns.webgeodatavore.com/isochrone-map/index.html) -- visualization best practices (MEDIUM confidence)

---
*Pitfalls research for: NYC Open Routing -- Isochrone/Reachability Visualization*
*Researched: 2026-02-13*
*Confidence: HIGH (direct codebase analysis + verified pgRouting/PostGIS/MapLibre documentation)*
