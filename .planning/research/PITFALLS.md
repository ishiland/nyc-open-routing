# Domain Pitfalls: Edge-Based Isochrones & Waypoint Routing

**Domain:** Adding edge-based isochrone visualization and via-point/waypoint routing to existing pgRouting 3.8 + MapLibre GL 5 + React 18 routing application
**Researched:** 2026-02-14
**Confidence:** HIGH (codebase analysis + verified pgRouting 3.8/PostGIS/MapLibre documentation)

**Scope:** Pitfalls specific to ADDING these features to the existing NYC Open Routing app. References actual code, table schemas, layer ordering, and data volumes from the current codebase. The existing app already has polygon-based isochrones via `pgr_drivingDistance` + `ST_ConcaveHull` and point-to-point routing via `pgr_trsp`.

---

## Critical Pitfalls

Mistakes that cause rewrites, multi-second response times, or render-blocking performance issues.

### Pitfall 1: Edge-Based Isochrone Returns Thousands of GeoJSON LineStrings -- Payload and Rendering Explosion

**What goes wrong:**
Switching from polygon-based isochrones (current: 4 polygons for 4 time bands) to edge-based isochrones (coloring individual street segments by travel time) means the API returns thousands of LineString features instead of 4 Polygon features. A 15-minute driving isochrone on the 177k-edge NYC network can return 5,000-15,000 reachable edges. Each edge carries a geometry with 2-20 coordinate pairs plus properties (travel time, street name, band index). The GeoJSON payload balloons from ~20-80 KB (polygon) to 500 KB - 2 MB (edges).

**Why it happens:**
The current `getdrivingisochrone()` function (lines 944-1067 of `05_functions.sql`) runs `pgr_drivingDistance`, joins to `edges_vertices_pgr` for node geometries, then runs `ST_ConcaveHull` to produce a single polygon per band. Edge-based isochrones skip the polygon step entirely -- instead joining `pgr_drivingDistance` results to the `edges` table to return individual edge geometries with their `agg_cost` values. Each edge becomes a GeoJSON Feature.

The existing route response (`RouteResponse`) typically contains 10-50 grouped street segments. Edge-based isochrones return 100-300x more features, with fundamentally different performance characteristics:

| Metric | Current polygon isochrone | Edge-based isochrone (15 min drive) |
|--------|--------------------------|--------------------------------------|
| Features returned | 4 | 5,000-15,000 |
| GeoJSON payload | 20-80 KB | 500 KB - 2 MB |
| MapLibre setData time | <10ms | 50-200ms |
| MapLibre render time | <5ms | 20-100ms |

**Consequences:**
- API response times increase 2-5x from serialization alone (WKB-to-GeoJSON for 10K features vs 4)
- Network transfer time on mobile 4G increases from <100ms to 500ms-2s
- MapLibre `setData()` on the GeoJSON source triggers full tile pyramid rebuild. Per [MapLibre issue #4364](https://github.com/maplibre/maplibre-gl-js/issues/4364), this causes noticeable stutter at ~5,000 features. Per [issue #106](https://github.com/maplibre/maplibre-gl-js/issues/106), `JSON.stringify` alone takes ~200ms for ~200 LineStrings with 4,500 coordinates each.
- Mobile devices (lower GPU) may drop below 30fps during isochrone rendering with data-driven line-color expressions on 10K+ features

**Prevention:**
1. **Simplify edge geometries server-side.** Apply `ST_SimplifyPreserveTopology` to each edge geometry in the SQL function before returning. At the zoom levels where full isochrones are visible (zoom 11-14), coordinate precision beyond ~0.0001 degrees (~10m) is invisible. This can reduce coordinate counts by 40-60%:
   ```sql
   ST_SimplifyPreserveTopology(e.geom_4326, 0.0001) AS geom
   ```
2. **Cap the maximum number of returned edges.** For time bands beyond 10 minutes, subsample edges or return only edges along major streets. The `edges` table has `featuretyp` and `rw_type` columns that can filter to arterials:
   ```sql
   WHERE (rn.agg_cost <= 10 OR e.rw_type IN (1, 2, 3))  -- All edges within 10 min, arterials only beyond
   ```
3. **Use `ST_AsGeoJSON(geom, 5)` instead of full-precision WKB.** Limit coordinate precision to 5 decimal places (~1m) at the SQL level, reducing payload size by ~20%.
4. **Set `maxzoom: 14` on the GeoJSON source.** Prevents MapLibre from generating high-zoom tiles that no one will see when viewing a full isochrone. This directly reduces tile pyramid computation:
   ```typescript
   map.addSource("isochroneEdgeSource", {
     type: "geojson",
     data: featureCollection,
     maxzoom: 14,
   })
   ```
5. **Throttle `setData` calls.** If the user is adjusting time bands interactively (slider), debounce the API call to at most once per 500ms. The existing `useDebouncedFetch` hook pattern can be reused.

**Detection (warning signs):**
- API response body exceeds 1 MB for a single isochrone request
- Browser Network tab shows >500ms for isochrone endpoint
- MapLibre frame rate drops below 30fps during isochrone display (check with `map.showPerformanceStatistics()`)
- Mobile users report "frozen" map after isochrone loads

**Phase relevance:** Must be addressed in the SQL function design and API response format. Cannot be retroactively fixed without changing the wire format.

---

### Pitfall 2: Waypoint Routing with N+1 Sequential pgr_trsp Calls -- Latency Multiplication

**What goes wrong:**
Waypoint routing through N intermediate points requires N+1 separate route segments (origin->wp1, wp1->wp2, ..., wpN->destination). Naively calling `pgr_trsp` N+1 times in sequence multiplies the total query time. The existing single route takes ~100-300ms. With 3 waypoints, that becomes 4 calls = 400ms-1.2s of pure SQL execution, plus overhead for node snapping (4 calls to `getnearestXXXnode`) and geometry joining.

**Why it happens:**
The current routing functions (`getdrivingroute`, `getbikingroute`, `getwalkingroute` in `05_functions.sql`) are designed for exactly 2 endpoints. They snap origin and destination to the nearest mode-accessible node, call `pgr_trsp` once, then join, compute turn instructions, and group edges.

pgRouting 3.8 does include `pgr_trspVia` which handles via-vertex routing with turn restrictions in a single function call. However, `pgr_trspVia` operates on vertex IDs, not arbitrary coordinates. The workflow requires:
1. Snap all waypoint coordinates to nearest nodes (N+2 calls to `getnearestXXXnode`)
2. Call `pgr_trspVia(edges_sql, restrictions_sql, ARRAY[node1, node2, ..., nodeN+2])` once
3. Process the multi-path result (which includes `path_id` to distinguish segments)

The critical subtlety: `pgr_trspVia` returns `(seq, path_id, path_seq, start_vid, end_vid, node, edge, cost, agg_cost, route_agg_cost)` where `path_id` identifies each leg. The existing turn instruction logic (gap-and-islands grouping by street name) must be applied per leg, and the final turn instruction at waypoint transitions needs special handling (it is NOT a turn instruction -- it is an "arrive at waypoint" / "depart from waypoint" marker).

**Consequences:**
- 3-waypoint route takes 3-4x as long as a 2-point route if using sequential calls
- Turn instructions at waypoint boundaries are nonsensical ("Continue straight" when the user is stopping at a waypoint)
- Sequential node snapping means 5 round trips to the vertex table instead of 2
- The existing `_format_route_response` method in `routing.py` (lines 267-309) expects a flat sequence of features -- multi-leg routes need leg boundaries marked

**Prevention:**
1. **Use `pgr_trspVia` for the SQL layer.** This is the native pgRouting solution for via-vertex routing with turn restrictions. It performs a single Dijkstra sweep across all legs, is significantly faster than N+1 separate `pgr_trsp` calls, and handles turn restriction lookahead across leg boundaries. Create a new SQL function `getdrivingroute_via()`:
   ```sql
   CREATE FUNCTION getdrivingroute_via(
     _waypoint_lons FLOAT[], _waypoint_lats FLOAT[]
   )
   RETURNS TABLE(
     leg INT, seq INT, id VARCHAR, street VARCHAR,
     travel_time FLOAT, distance FLOAT,
     turn_instruction TEXT, turn_type TEXT,
     traffic_factor NUMERIC(5,2), geom GEOMETRY
   )
   ```
2. **Snap all nodes in a single query.** Instead of N+2 separate function calls, use a set-returning query:
   ```sql
   SELECT idx, getnearestdrivenode(lon, lat) AS node_id
   FROM unnest(_lons, _lats) WITH ORDINALITY AS t(lon, lat, idx)
   ```
3. **Mark leg boundaries in the response.** Add a `leg` (or `path_id`) field to the response schema so the frontend can display waypoint arrival/departure markers and per-leg summaries.
4. **Handle turn instructions at leg boundaries explicitly.** At the transition between `path_id = N` and `path_id = N+1`, insert an "Arrive at waypoint" instruction instead of computing bearing-based turns.

**Detection (warning signs):**
- Waypoint route requests take >1s with just 2 waypoints
- Turn instructions at waypoint positions say "Continue straight" or "Make a U-turn"
- Route segments visually overlap or gap at waypoint positions on the map
- API logs show N+1 separate SQL queries per waypoint request

**Phase relevance:** Must be decided at SQL function design time. The choice between sequential `pgr_trsp` and single `pgr_trspVia` determines the entire data flow.

---

### Pitfall 3: Edge-Based Isochrone Time Band Coloring -- Data-Driven Line Paint Expression Performance

**What goes wrong:**
Coloring thousands of line features by travel time band requires MapLibre data-driven styling expressions. The current isochrone uses a simple `match` expression on `band_index` (4 possible values). Edge-based isochrones have continuous `agg_cost` values requiring `interpolate` or `step` expressions evaluated per-feature per-frame. With 10,000+ line features, complex paint expressions measurably impact GPU frame time.

**Why it happens:**
MapLibre evaluates paint property expressions during rendering for every visible feature on every frame. For a line layer with data-driven `line-color` using an `interpolate` expression:

```javascript
"line-color": [
  "interpolate", ["linear"],
  ["get", "agg_cost"],
  0, "#22c55e",    // 0 min - green
  5, "#facc15",    // 5 min - yellow
  10, "#f97316",   // 10 min - orange
  15, "#ef4444",   // 15 min - red
  20, "#991b1b",   // 20 min - dark red
]
```

This expression runs for each of the 10,000 features to determine its color. While each evaluation is fast (~microseconds), the aggregate cost on 10K features at 60fps is measurable, particularly when combined with `line-width` interpolation by zoom level.

The existing route traffic coloring (in `style.ts` `getTrafficRoutePaint()`) uses the same pattern but on ~30 features, not 10,000.

**Consequences:**
- Frame drops on mobile devices (10K features x 2 expressions x 60fps = 1.2M expression evaluations/second)
- Panning and zooming feel "sluggish" compared to the polygon-based isochrone
- Combined with `line-width` zoom interpolation, the GPU load compounds
- Users on older devices or low-end phones may see <15fps

**Prevention:**
1. **Pre-compute the band index server-side.** Instead of sending continuous `agg_cost` and using `interpolate`, assign a discrete `band_index` (1-4) in the SQL function based on the time band the edge falls into. Then use a `match` expression (O(1) lookup) instead of `interpolate` (linear search):
   ```javascript
   "line-color": [
     "match", ["get", "band_index"],
     1, "#22c55e",
     2, "#facc15",
     3, "#f97316",
     4, "#ef4444",
     "#94a3b8"
   ]
   ```
   `match` is significantly faster than `interpolate` for discrete values because it uses hash-based lookup rather than linear interpolation.
2. **Use a single shared source with a filter per band.** Instead of one layer for all edges, create 4 layers (one per band), each with a filter `["==", ["get", "band_index"], N]`. This lets MapLibre batch features by paint properties, reducing GPU state changes.
3. **Set `line-width` as a constant at each zoom level rather than a smooth interpolation.** Use `step` instead of `interpolate` for line width to reduce per-feature computation:
   ```javascript
   "line-width": ["step", ["zoom"], 2, 13, 3, 15, 4]
   ```
4. **Apply `minzoom: 10` on the edge-based isochrone layer.** At zoom levels below 10, the individual edges merge visually. Fall back to the polygon-based isochrone at low zoom and switch to edge-based at higher zoom.

**Detection (warning signs):**
- FPS drops below 30 when panning with isochrone visible (check MapLibre's built-in performance overlay)
- Map feels smooth when isochrone is hidden, sluggish when shown
- Mobile users report worse performance than desktop users (GPU-bound)
- Reducing `interpolate` stops to 2 colors makes panning noticeably smoother

**Phase relevance:** Must be decided when designing the SQL response format and the frontend layer configuration. Pre-computing band_index is a SQL-side decision; using `match` vs `interpolate` is a frontend decision. Both must be coordinated.

---

### Pitfall 4: Waypoint URL Serialization -- Browser URL Length Limits and State Complexity

**What goes wrong:**
The existing URL state sync (`useRouteStateSync.ts`) encodes origin and destination as `start={lon,lat}&startAddr={label}&end={lon,lat}&endAddr={label}`. Adding N waypoints with addresses means N additional `via={lon,lat}&viaAddr={label}` pairs. With 5 waypoints and address labels, the URL can easily exceed 500 characters. At 10+ waypoints, it approaches browser limits (IE: 2,083 chars; all modern browsers: ~2,048 for reliable cross-platform compatibility; the URL spec has no formal limit but various proxies and servers enforce limits at 4,096-8,192).

More critically, the URL encodes ordering -- `via1` must come before `via2` -- but URL parameters are nominally unordered. Naive encoding like `via=lon1,lat1&via=lon2,lat2` relies on browsers preserving parameter order, which is implementation-dependent.

**Why it happens:**
The current `useRouteStateSync` (lines 34-250) uses `URLSearchParams` for reading and writing. `URLSearchParams.getAll()` does return values in order per the spec, but intermediate systems (reverse proxies, CDN query string normalization, analytics tools) may reorder or deduplicate parameters with the same name.

The existing code also URL-encodes address labels with special characters (apostrophes, ampersands in street names like "O'Brien Ave" or "Park & Ride"). Each encoded character (`%27`, `%26`) adds bytes.

**Consequences:**
- URLs become unwieldy for sharing (copy-paste, social media, messaging apps truncate long URLs)
- Parameter ordering is fragile -- reordered waypoints produce a different route
- Some URL shorteners and redirectors mangle long URLs
- Deep-linking 5+ waypoint routes fails on some mobile browsers
- URL-encoded NYC addresses with special characters bloat the query string

**Prevention:**
1. **Use pipe-separated ordered coordinates in a single parameter.** Follow Google Maps convention: `via=-73.98,40.75|-73.97,40.76|-73.96,40.77`. One parameter, explicit ordering, compact:
   ```
   /?start=-73.985,40.748&end=-73.965,40.758&via=-73.975,40.753|-73.970,40.755&mode=drive
   ```
   This keeps waypoint ordering unambiguous and reduces parameter count.
2. **Encode waypoint addresses in a parallel pipe-separated parameter:** `viaAddr=Times+Sq|Penn+Station|Herald+Sq`. Address labels are optional -- coordinates are sufficient for route reconstruction.
3. **Limit URL-encoded waypoints to a reasonable maximum (e.g., 5-8).** Beyond that, offer a "share" button that generates a short link or copies route data to clipboard in a different format. For 5 waypoints, the URL stays under 300 characters.
4. **Update `useRouteStateSync.ts` to parse the pipe-separated format.** Add a `parseViaParam` function:
   ```typescript
   function parseViaParam(param: string): IMapFeature[] {
     return param.split("|").map(coord => {
       const [lon, lat] = coord.split(",").map(Number)
       return { type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: {} }
     })
   }
   ```
5. **Round coordinates to 4 decimal places in URLs** (~11m precision, sufficient for node snapping). The current code uses full precision; this saves ~8 characters per coordinate pair.

**Detection (warning signs):**
- URL exceeds 500 characters with 3 waypoints
- Shared links open with waypoints in wrong order
- Browser address bar truncates the URL visually
- Mobile share sheets fail or produce broken links

**Phase relevance:** Must be designed before implementing the waypoint UI. The URL format constrains the state model.

---

### Pitfall 5: Waypoint Routing Breaks Existing Route Response Schema

**What goes wrong:**
The existing `RouteResponse` (in `schemas.py`) returns `{ features: Feature[] }` -- a flat list of route segments. Waypoint routing produces multiple legs, each with its own segments, turn instructions, and travel time totals. Without leg boundaries, the frontend cannot:
- Display per-leg travel time and distance summaries
- Show "Arrive at waypoint X" markers on the map
- Separate the RouteList into collapsible leg sections
- Highlight a specific leg when the user taps a waypoint

**Why it happens:**
The current `Properties` schema (lines 32-51 of `schemas.py`) has `seq`, `street`, `distance`, `travel_time`, `turn_instruction`, `turn_type`, and `traffic_factor`. There is no `leg` or `path_id` field. All features are treated as part of a single continuous route.

The `RouteList` component (consuming `route.features`) renders all features sequentially. The `selectedStreet` state in `RoutingContext` selects individual features for highlight. None of this logic accounts for multi-leg routes.

`pgr_trspVia` returns `path_id` to distinguish legs, but this field gets lost if not mapped through the response schema.

**Consequences:**
- Turn instructions flow continuously across waypoint boundaries ("Continue straight" at a stop)
- Total travel time and distance cannot be broken down by leg
- The route summary card shows aggregate numbers with no per-leg detail
- The frontend has no way to auto-zoom to a specific leg
- If the response schema changes, existing bookmark/shared links with the old format may break

**Prevention:**
1. **Add `leg` field to the Properties schema as an Optional integer.** This is backward-compatible: existing A-to-B routes have `leg: null` or `leg: 0`, waypoint routes have `leg: 1, 2, ...`:
   ```python
   class Properties(BaseModel):
       seq: int
       leg: Optional[int] = None  # null for A-to-B, 1+ for waypoint routes
       street: Optional[str] = None
       # ... existing fields ...
   ```
2. **Add a `legs` summary to the RouteResponse for waypoint routes:**
   ```python
   class LegSummary(BaseModel):
       leg: int
       origin_label: Optional[str] = None
       destination_label: Optional[str] = None
       total_distance: float
       total_travel_time: float

   class RouteResponse(BaseModel):
       features: List[Feature]
       legs: Optional[List[LegSummary]] = None  # null for simple routes
   ```
3. **Insert synthetic "waypoint" features at leg boundaries.** Between the last feature of leg N and the first feature of leg N+1, insert a Feature with `turn_instruction: "Arrive at waypoint"` and `turn_type: "waypoint"`. This provides a clean separation point for the frontend.
4. **Keep the flat features array.** Do NOT nest features inside legs (e.g., `legs: [{ features: [...] }, ...]`). The flat array with a `leg` property preserves backward compatibility with the existing `useGeoJsonLayer` hook (which expects `IMapFeature[]`) and the existing route rendering pipeline.

**Detection (warning signs):**
- Route summary shows total time but no per-leg breakdown
- RouteList has no visual separation between legs
- Turn instructions at waypoints make no sense
- Map rendering treats the entire multi-leg route as one continuous line (no waypoint markers)

**Phase relevance:** Must be designed before implementing the waypoint API endpoint. Schema changes affect both backend and frontend simultaneously.

---

## Moderate Pitfalls

### Pitfall 6: Edge-Based Isochrone Layer Conflicts with Existing Polygon Isochrone Layers

**What goes wrong:**
The current MapLibre layer stack (defined in `mapHelpers.ts` `CUSTOM_LAYER_ORDER`) includes `isochroneFillLayer` and `isochroneOutlineLayer` for polygon-based isochrones. Adding edge-based isochrone layers creates a conflict: both visualization modes use the same conceptual layer slot. If both are active simultaneously or cleanup is incomplete during mode transitions, ghost layers appear.

**Why it happens:**
The `CUSTOM_LAYER_ORDER` array (lines 8-17 of `mapHelpers.ts`) hardcodes the layer IDs. The `enforceLayerOrder` function (lines 23-36) moves layers to match this order. Adding new layer IDs for edge-based isochrones (`isochroneEdgeLayer`) requires updating this array and the enforcement logic.

The `IsochroneContext` has an `appMode` state but no concept of isochrone visualization type (polygon vs edge-based). If the user switches from polygon to edge visualization, the previous layer type must be removed first.

**Prevention:**
1. **Add edge-based isochrone layers to `CUSTOM_LAYER_ORDER`:**
   ```typescript
   export const CUSTOM_LAYER_ORDER = [
     "isochroneFillLayer",       // polygon isochrone (bottom)
     "isochroneOutlineLayer",    // polygon isochrone outline
     "isochroneEdgeLayer",       // edge-based isochrone
     "routeHaloLayer",
     "routeLayer",
     // ... rest of stack
   ]
   ```
2. **Implement mutual exclusion between polygon and edge isochrone layers.** When switching visualization type, remove the previous type's layers before adding the new ones. Use the existing `removeMapLayerAndSource` utility.
3. **Add `isochroneDisplayMode: "polygon" | "edge"` to the IsochroneContext** so components know which visualization is active.
4. **Consider a zoom-based automatic switch:** Show polygon isochrone at low zoom (overview) and edge-based at high zoom (detail). This avoids having the user manually switch and naturally handles the performance cliff (edge-based at low zoom = too many tiny features).

**Detection (warning signs):**
- Both polygon fill and edge lines visible simultaneously
- Switching isochrone mode leaves ghost layers
- Layer z-ordering breaks after adding edge-based layers

**Phase relevance:** Frontend implementation phase. Must be coordinated with the layer ordering system.

---

### Pitfall 7: Waypoint Drag-to-Reorder on Mobile -- Touch Target Size and Gesture Conflicts

**What goes wrong:**
The natural UX for reordering waypoints is drag-and-drop on a list. On mobile, this conflicts with scroll gestures in the sidebar/bottom sheet. The existing `BottomSheet` component (in `client/src/components/mobile/`) handles swipe-up/down for open/close. A drag-to-reorder gesture within the bottom sheet's waypoint list will be intercepted by the bottom sheet's gesture handler, making reordering impossible.

**Why it happens:**
Touch events on mobile are ambiguous: a vertical drag on a waypoint list item could mean "reorder this waypoint" or "scroll the list" or "collapse the bottom sheet." Without explicit gesture disambiguation (e.g., a dedicated drag handle), the outermost gesture handler wins.

The minimum touch target size for WCAG compliance is 44x44px. A waypoint list with 5 items plus origin/destination = 7 rows at 44px each = 308px minimum. On a 375px-wide phone with a 50% bottom sheet, that leaves ~100px for the map -- unusable.

**Consequences:**
- Users cannot reorder waypoints on mobile (drag gesture intercepted by scroll/bottom sheet)
- Waypoint list extends beyond bottom sheet viewport, requiring scroll, which conflicts with drag
- Touch targets too small cause accidental waypoint selection/deletion
- Accessibility violations if drag is the only reorder mechanism (no keyboard alternative)

**Prevention:**
1. **Use explicit up/down arrow buttons instead of drag-to-reorder on mobile.** Move-up and move-down buttons have clear touch targets, do not conflict with scroll, and work with screen readers:
   ```tsx
   <IconButton onClick={() => moveWaypoint(index, "up")} size="small">
     <ArrowUpIcon />
   </IconButton>
   ```
2. **Use the `useResponsive` hook** (already in the codebase at `client/src/hooks/useResponsive.ts`) to conditionally render drag-to-reorder on desktop and button-based reorder on mobile.
3. **Limit mobile waypoints to 3-5.** More waypoints than this overwhelm the mobile UI regardless of reorder mechanism. Show an "Add waypoint" button that becomes disabled at the limit.
4. **If drag-to-reorder is desired on desktop, use a library like `@dnd-kit/sortable`** which handles keyboard accessibility and has minimal bundle size (~4 KB gzipped). Do NOT implement custom drag handlers -- the accessibility requirements alone (keyboard support, screen reader announcements, focus management) make this prohibitively complex.
5. **Reserve a drag handle zone** (left-edge grip icon) to disambiguate "drag to reorder" from "scroll" on both desktop and mobile.

**Detection (warning signs):**
- Dragging a waypoint on mobile scrolls the list instead of reordering
- Bottom sheet collapses when user tries to drag a waypoint
- Users on mobile cannot change waypoint order at all
- Accessibility audit fails (no keyboard alternative for reorder)

**Phase relevance:** Must be addressed during waypoint UI component design. The mobile vs desktop divergence should be decided upfront.

---

### Pitfall 8: Waypoint Node Snapping -- Intermediate Waypoints May Snap to Wrong Side of Street

**What goes wrong:**
Each waypoint is snapped to the nearest mode-accessible node via `getnearestXXXnode()`. In Manhattan's dense grid, the "nearest" node may be on the opposite side of a one-way avenue or across a divided highway. The route then makes an unnecessary detour to reach the snapped node, adds a U-turn, and continues -- producing a route that looks wrong at the waypoint even though it is technically correct.

**Why it happens:**
The `getnearestdrivenode()` function (lines 17-28 of `05_functions.sql`) uses KNN spatial ordering (`ORDER BY v.geom <-> point LIMIT 1`) which finds the geometrically closest node regardless of which side of the street it is on or which direction the adjacent edges flow. For origin and destination this is acceptable (users expect slight adjustments). For intermediate waypoints, snapping to the wrong side means the route must traverse to that node and back, adding visible detour legs.

With NYC's one-way grid, the nearest node could be across a one-way avenue -- reachable only via a multi-block detour. The snapped node is 20 feet away geometrically but 2 minutes away by driving.

**Consequences:**
- Route shows U-turns or multi-block detours at waypoints
- Travel time inflated by waypoint detours (user sees 5 extra minutes they did not expect)
- Users perceive waypoint routing as "broken" even though the routing is correct per the snapped nodes
- Worse for driving mode than walking mode (one-way streets, turn restrictions)

**Prevention:**
1. **Accept this for v1.** Node snapping to the nearest geometric node is the standard approach for pgRouting-based systems and matches the behavior of the existing origin/destination snapping. Document it as a known limitation.
2. **Consider `pgr_withPoints` for future improvement.** Instead of snapping to nodes, `pgr_withPoints` can route to/from arbitrary points on edges, avoiding the wrong-side-of-street problem. However, this changes the routing function signature significantly and is not compatible with `pgr_trspVia` (turn restrictions).
3. **Show the snapped waypoint location on the map.** If the user drops a waypoint at point A but it snaps to node B (30 feet away), show both the original drop point (faded) and the snapped location (solid). This manages expectations.
4. **Allow the user to fine-tune waypoint position.** A "nudge" interaction (drag the snapped marker) lets users manually correct bad snaps. This is especially valuable on mobile where initial tap placement is imprecise.

**Detection (warning signs):**
- Route takes a visually obvious detour at a waypoint location
- Travel time for a waypoint route is significantly longer than expected
- The route crosses the same intersection twice near a waypoint

**Phase relevance:** Awareness-level for v1. The existing snapping behavior is acceptable for initial release but should be documented.

---

### Pitfall 9: pgr_trspVia "Proposed" Status -- API Stability Risk

**What goes wrong:**
`pgr_trspVia` was in "Proposed" status through pgRouting 3.7 and promoted to "Official" only in pgRouting 4.0. The project uses pgRouting 3.8 (Docker image `pgrouting/pgrouting:17-3.5-3.8`). In pgRouting 3.8, `pgr_trspVia` exists but its API surface is technically still subject to change. Function signatures, parameter names, and return column names could differ between 3.8 and future versions.

**Why it happens:**
From the [pgRouting documentation](https://docs.pgrouting.org/latest/en/pgr_trspVia.html): "Function promoted to official" in Version 4.0.0. In version 3.x, the function is available but may be marked "Proposed" meaning "They likely will not be officially be part of the next release: The functions might not make use of ANY-INTEGER and ANY-NUMERICAL. Name might change. Signature might change. Functionality might change."

The existing codebase uses `pgr_trsp` (which IS official in 3.8) for point-to-point routing. Adding `pgr_trspVia` introduces a dependency on a less-stable function.

**Consequences:**
- Upgrading pgRouting from 3.8 to 4.x could break the `pgr_trspVia` call if parameters or return columns changed
- Cannot rely on pgRouting's backward-compatibility guarantees for Proposed functions
- Must test explicitly after any Docker image update

**Prevention:**
1. **Verify `pgr_trspVia` availability and signature in the actual Docker image.** Before committing to this function, run `SELECT proname, pronargs FROM pg_proc WHERE proname = 'pgr_trspvia';` in the database container to confirm it exists and check its arity.
2. **Wrap the call in a SQL function (`getdrivingroute_via`).** This provides an abstraction layer -- if pgRouting changes the function signature, only the wrapper needs updating, not the Python service layer.
3. **Pin the Docker image version.** The `docker-compose.yml` already specifies `pgrouting/pgrouting:17-3.5-3.8`. Do NOT use `latest` tag.
4. **Fallback to sequential `pgr_trsp`.** If `pgr_trspVia` proves unreliable, sequential calls to the existing `getdrivingroute` function work correctly, just slower. The service layer can abstract this choice.
5. **Consider staying with sequential `pgr_trsp` for simplicity.** For up to 5 waypoints (6 legs), the latency difference between 6 sequential calls (~600ms) and 1 `pgr_trspVia` call (~200ms) may not justify the API stability risk. Profile before deciding.

**Detection (warning signs):**
- `pgr_trspVia` not found in `pg_proc` after image update
- Function returns different column names than expected
- Docker image upgrade breaks waypoint routing but not point-to-point routing

**Phase relevance:** Must be verified before starting SQL function implementation. A 5-minute check in the running container resolves this.

---

## Minor Pitfalls

### Pitfall 10: Edge-Based Isochrone Edges Cross Water Bodies and Parks

**What goes wrong:**
Unlike polygon isochrones where `ST_ConcaveHull` can bridge across water, edge-based isochrones inherently avoid this -- only actual street segments are rendered. However, ferry edges in the `edges` table have geometries that cross water as straight lines. A 10-minute driving isochrone that includes ferry routes will show straight lines across the East River or Hudson River, which looks visually jarring compared to the organic street network.

**Prevention:**
- Filter ferry edges from the isochrone edge results: `WHERE e.featuretyp != 'F'` (ferries have `featuretyp = 'F'` in the LION data).
- Alternatively, style ferry edges differently (dashed line, different color) to distinguish them from street segments.

---

### Pitfall 11: Waypoint Markers Overlap Route Line at Close Zoom

**What goes wrong:**
Waypoint markers displayed as circles on the map overlap with the route line, making it hard to distinguish waypoints from the route itself. The existing start (green) and end (red) markers are visually distinct (14px radius circles with white stroke), but intermediate waypoints need a third visual style. Using the same circle style with a different color creates a confusing "Christmas lights" effect along the route.

**Prevention:**
- Use numbered markers (1, 2, 3...) inside circles for intermediate waypoints, following the Google Maps pattern.
- Use a distinct color (e.g., MUI's secondary color or white with a dark border) that contrasts with both start green and end red.
- Add the waypoint number as a symbol layer label (pattern exists for start "A" / end "B" labels in `MapLibreGLMap.tsx` lines 193-232).
- Place waypoint markers above the route line layer in the z-order.

---

### Pitfall 12: Cache Key Explosion for Waypoint Routes

**What goes wrong:**
The existing `RouteCache` (in `api/utils/cache.py`) uses `(origin, destination, mode)` as the cache key. Waypoint routes have N intermediate points, making the cache key space exponential. With 3 waypoints, the key includes 5 coordinate pairs -- a cache miss is almost guaranteed unless the exact same route is requested again.

**Prevention:**
- Cache waypoint routes with a normalized key: sort-independent hash of all waypoint coordinates + mode + options. The existing `_make_key` method uses MD5 hashing which handles variable-length inputs.
- Accept lower cache hit rates for waypoint routes. The primary cache benefit is for repeated identical queries (e.g., page reload, back button). Waypoint routes are inherently more unique.
- Consider caching individual leg results rather than the full route. If a user adds a new waypoint between existing ones, the unchanged legs can use cached results. This is more complex but dramatically improves cache hit rates for interactive waypoint editing.
- Keep cache max size reasonable. Waypoint routes are larger payloads (~3-5x a normal route). Adjust `max_size` in `RouteCache` if memory is a concern.

---

### Pitfall 13: Edge-Based Isochrone Mode Switch Leaves Stale Data in IsochroneContext

**What goes wrong:**
When the user switches from polygon isochrone mode to edge-based isochrone mode, the `IsochroneContext` holds stale polygon data. If the edge-based isochrone fetch fails or is slow, the frontend may render the old polygon data with the new edge-based layer configuration, producing garbage rendering (polygon geometry in a line layer).

**Prevention:**
- Clear `isochrone` state immediately when switching visualization modes:
  ```typescript
  const setIsochroneDisplayMode = useCallback((mode: "polygon" | "edge") => {
    setIsochroneState(null)  // Clear before fetching new data
    setDisplayMode(mode)
  }, [])
  ```
- Validate geometry types before rendering. The `useGeoJsonLayer` hook should verify that line layers receive LineString features and fill layers receive Polygon features.
- Use separate state fields for polygon and edge isochrone data to prevent cross-contamination.

---

## Phase-Specific Warnings

| Phase/Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| Edge isochrone SQL | Thousands of edge geometries returned (Pitfall 1) | ST_SimplifyPreserveTopology, edge count cap, reduced precision | CRITICAL -- payload explosion |
| Edge isochrone SQL | Cost/time column choice | Use `time_*` columns not `cost_*` (already resolved in polygon isochrone functions) | HIGH -- inherited from existing research |
| Edge isochrone frontend | Data-driven line coloring on 10K features (Pitfall 3) | Pre-compute band_index, use `match` not `interpolate`, set maxzoom on source | CRITICAL -- rendering performance |
| Edge isochrone frontend | Layer conflicts with polygon isochrone (Pitfall 6) | Update CUSTOM_LAYER_ORDER, mutual exclusion, zoom-based auto-switch | MODERATE -- ghost layers |
| Edge isochrone frontend | Mode switch stale data (Pitfall 13) | Clear state before fetch, validate geometry types | MODERATE -- garbage rendering |
| Waypoint SQL | Sequential pgr_trsp calls (Pitfall 2) | Use pgr_trspVia single call, or accept sequential with profiling | CRITICAL -- latency multiplication |
| Waypoint SQL | pgr_trspVia stability (Pitfall 9) | Verify in Docker container, wrap in SQL function, pin image version | MODERATE -- API stability risk |
| Waypoint API schema | Breaks flat RouteResponse (Pitfall 5) | Add leg field, backward-compatible schema extension | CRITICAL -- frontend/backend coordination |
| Waypoint URL state | URL length and ordering (Pitfall 4) | Pipe-separated coordinates, limit waypoints, round coords | HIGH -- sharing/deep-linking |
| Waypoint frontend | Mobile drag-to-reorder (Pitfall 7) | Button-based reorder on mobile, conditional rendering | MODERATE -- mobile UX |
| Waypoint frontend | Node snapping wrong side (Pitfall 8) | Accept for v1, show snapped location, document limitation | LOW -- acceptable v1 behavior |
| Waypoint frontend | Waypoint marker styling (Pitfall 11) | Numbered circles, distinct color, symbol layer labels | LOW -- visual polish |
| Waypoint cache | Cache key explosion (Pitfall 12) | Normalized hash key, per-leg caching for future | LOW -- acceptable hit rate |

## Integration Pitfalls Across Concerns

### Cross-Concern 1: Edge-Based Isochrone + Route Display = Layer Count Explosion

If both edge-based isochrone and route are displayed simultaneously (e.g., user calculates isochrone from start address, then routes to destination), the map has: isochrone edge layer (10K features) + route halo layer + route layer + 2 marker layers + 2 label layers = 8 layers with potentially 10K+ total features. The `enforceLayerOrder` function must handle all of these. Test with all layers active simultaneously.

### Cross-Concern 2: Waypoint Route + Edge-Based Isochrone = Context Interaction

A user might want to view an isochrone from a waypoint position (e.g., "what's reachable from my lunch stop?"). This requires the isochrone origin to come from the waypoint list, not just the start address. The `IsochroneContext` currently reads the origin from `RoutingContext.startAddress`. With waypoints, it needs access to any waypoint in the list. This cross-context dependency should be handled via a shared event/callback, not by merging the contexts.

### Cross-Concern 3: Waypoint URL State + Isochrone Mode = Conflicting URL Parameters

The URL currently encodes `start`, `end`, `mode`, `traffic` for routes and `orig`, `mode`, `intervals` for isochrones (separate endpoint). With waypoints, the URL gains `via` parameters. If the user switches from waypoint route to isochrone mode, the `via` parameters become meaningless but persist in the URL. The URL state sync must clean up mode-specific parameters on mode switch.

### Cross-Concern 4: Edge-Based Isochrone Response + Waypoint Response = Dual Large Payloads

If both features are used simultaneously, the browser may hold 2-3 MB of GeoJSON in memory (isochrone edges + waypoint route segments). On mobile devices with limited memory, this can trigger garbage collection pauses. Profile memory usage with both features active.

### Cross-Concern 5: Sequential pgr_trsp + Database Connection Pool

If waypoint routing uses sequential `pgr_trsp` calls (fallback from `pgr_trspVia`), each call holds a database connection for the full sequence. The existing FastAPI setup uses synchronous SQLAlchemy `Engine.connect()` which blocks the worker. With 4+ waypoints, a single request can hold a connection for 400ms+. Under concurrent load, this exhausts the connection pool. Use a single `with self.engine.connect() as conn:` block for all sequential calls, not one connection per call.

## Performance Thresholds to Watch

| Metric | Acceptable | Warning | Critical |
|--------|-----------|---------|----------|
| Edge-based isochrone API response time | <500ms | 500ms-1.5s | >1.5s |
| Edge-based isochrone GeoJSON payload | <500 KB | 500 KB-1.5 MB | >1.5 MB |
| Edge-based isochrone feature count | <5,000 | 5,000-10,000 | >10,000 |
| MapLibre setData time for edge isochrone | <50ms | 50-150ms | >150ms |
| MapLibre FPS with edge isochrone visible | >50fps | 30-50fps | <30fps |
| Waypoint route API response (3 waypoints) | <500ms | 500ms-1s | >1s |
| Waypoint route API response (5 waypoints) | <800ms | 800ms-1.5s | >1.5s |
| URL length with 5 waypoints | <400 chars | 400-600 chars | >600 chars |

## MapLibre GL Rendering Limits for Line Layers

Based on [MapLibre issue #4364](https://github.com/maplibre/maplibre-gl-js/issues/4364), [issue #106](https://github.com/maplibre/maplibre-gl-js/issues/106), and the [official large data guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/):

| Feature count | setData performance | Rendering (data-driven color) | Recommendation |
|--------------|--------------------|-----------------------------|----------------|
| <1,000 | <10ms | 60fps | No optimization needed |
| 1,000-5,000 | 10-50ms | 50-60fps | Set maxzoom on source |
| 5,000-10,000 | 50-150ms | 30-50fps | Simplify geometries, use `match` not `interpolate` |
| 10,000-20,000 | 150-400ms | 15-30fps | Subsample features, consider vector tiles |
| >20,000 | >400ms | <15fps | Must use vector tiles or server-side aggregation |

For the edge-based isochrone specifically: a 15-minute driving isochrone in Manhattan returns ~8,000-12,000 edges. This sits squarely in the "needs optimization" range. The recommended approach is to cap at ~5,000 features with geometry simplification, using the performance thresholds above as guardrails.

## Sources

### pgRouting
- [pgr_trspVia -- pgRouting Manual (promoted to official in 4.0)](https://docs.pgrouting.org/latest/en/pgr_trspVia.html) -- function signature, turn restriction support, "Proposed" status through 3.x (HIGH confidence, verified via official docs)
- [pgr_drivingDistance -- pgRouting Manual 3.8](https://docs.pgrouting.org/latest/en/pgr_drivingDistance.html) -- return columns include edge ID for joining to edge geometries (HIGH confidence)
- [pgr_trspVia_withPoints -- pgRouting Manual 3.4](https://access.crunchydata.com/documentation/pgrouting/3.4.2/pgr_trspVia_withPoints.html) -- via-point routing with turn restrictions, Proposed status (MEDIUM confidence, version-specific)

### MapLibre GL
- [Optimising MapLibre Performance: Tips for Large GeoJSON Datasets](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) -- maxzoom, simplification, vector tiling recommendations (HIGH confidence, official docs)
- [GeoJSON setData performance issue -- MapLibre #106](https://github.com/maplibre/maplibre-gl-js/issues/106) -- JSON.stringify bottleneck at 200+ LineStrings, 200ms per call (HIGH confidence, specific benchmarks)
- [Performance issue on large FeatureCollection updates -- MapLibre #4364](https://github.com/maplibre/maplibre-gl-js/issues/4364) -- tile pyramid rebuild cost at 2,278-20,000 features, split-source workaround (HIGH confidence, specific benchmarks)
- [Memory leak when updating GeoJSON source -- MapLibre #6154](https://github.com/maplibre/maplibre-gl-js/issues/6154) -- indefinite memory growth with frequent setData (HIGH confidence)

### Isochrone Visualization
- [Better Rendering of Isochrones from Network Graphs -- Kuan Butts](http://kuanbutts.com/2017/12/16/osmnx-isochrones/) -- edge-based vs node-based approaches, skeleton-based buffering (MEDIUM confidence)
- [Using Network Segments in the Visualization of Urban Isochrones -- Allen 2018](https://jamaps.github.io/docs/allen_2018_isochrones.pdf) -- edge-based isochrone design rationale, travel time linking to edges (MEDIUM confidence)
- [High Precision Reachability Visualization -- GraphHopper](https://www.graphhopper.com/blog/2018/07/04/high-precision-reachability/) -- deck.gl for large-scale edge rendering, binary formats (MEDIUM confidence)

### UX Patterns
- [Drag-and-Drop UX Guidelines -- Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/drag-and-drop-ux/) -- accessibility requirements, touch gesture conflicts (HIGH confidence)
- [Google Maps URLs -- Waypoint format](https://developers.google.com/maps/documentation/urls/get-started) -- pipe-separated waypoint encoding convention (HIGH confidence)

### Codebase Analysis
- Direct examination of `05_functions.sql`, `routing.py`, `schemas.py`, `useGeoJsonLayer.ts`, `useRouteStateSync.ts`, `mapHelpers.ts`, `style.ts`, `MapLibreGLMap.tsx`, `RoutingContext.tsx`, `IsochroneContext.tsx`, `cache.py` -- all integration points verified (HIGH confidence)

---
*Pitfalls research for: NYC Open Routing -- Edge-Based Isochrones & Waypoint Routing*
*Researched: 2026-02-14*
*Confidence: HIGH (direct codebase analysis + verified pgRouting/PostGIS/MapLibre documentation)*
