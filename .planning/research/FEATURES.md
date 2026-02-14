# Feature Landscape: Edge-Based Isochrones & Waypoint Routing

**Domain:** Enhanced routing features for a multi-modal routing application
**Researched:** 2026-02-14
**Focus:** Two new capabilities: (1) edge-based isochrone visualization as an alternative/complement to existing polygon isochrones, and (2) multi-stop waypoint routing with via-point support
**Confidence:** MEDIUM-HIGH

**Existing capabilities (already built):**
- Point-to-point routing (drive/bike/walk) with turn restrictions via pgr_trsp
- Polygon-based isochrones (5/10/15/20 min concentric bands) via pgr_drivingDistance + ST_ConcaveHull
- Traffic-aware drive mode with departure time picker
- Address search (Geosupport), URL deep links, responsive sidebar UI
- AppMode toggle between "Route" and "Reachability" modes

---

## FEATURE 1: Edge-Based Isochrone Visualization

### What It Is

Instead of (or alongside) the existing polygon fill, color each individual reachable street segment by its travel-time band. The user sees the actual road network lit up in green-to-red gradients, showing precisely which streets are reachable and how long it takes to reach them. This is fundamentally different from concave hull polygons, which approximate reachable area but can swallow unreachable zones (parks, water, fenced areas).

Academic basis: Jeff Allen's "Using Network Segments in the Visualization of Urban Isochrones" (Cartographica, 2018) demonstrates that edge-based isochrones highlight transport network structure, enable visual comparison across modes/times, and avoid polygon approximation artifacts. GraphHopper's deck.gl reachability demo proved this works at scale in browsers with millions of edges.

### Table Stakes (Edge-Based Isochrones)

Features that are required for edge-based visualization to feel complete and usable.

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Color street segments by time band | Core feature: each reachable edge gets a color based on its agg_cost band (0-5 min, 5-10, 10-15, 15-20) | MEDIUM | Existing pgr_drivingDistance already returns `edge` and `agg_cost` columns. Need new API endpoint or response format to return edge geometries instead of/alongside polygons. |
| Toggle between polygon and edge view | Users need a way to switch visualization modes. Some prefer the polygon overview, others want street-level detail. | LOW | Frontend toggle control. Both views use the same pgr_drivingDistance data, just rendered differently. |
| Sequential color ramp (green to red) | Must match the existing isochrone color scheme (ISOCHRONE_BAND_COLORS) for visual consistency. Users mentally associate green=close, red=far. | LOW | MapLibre `step` or `interpolate` expression on `line-color` using the `agg_cost` property from each edge feature. Existing data-driven styling pattern in style.ts. |
| Line width scaling by zoom | Street segments must be visible at city-wide zoom (thin) and readable at neighborhood zoom (thick). Without this, edges are either invisible at z12 or overwhelming at z16. | LOW | MapLibre zoom-interpolated `line-width`, identical pattern to existing route layer. |
| Loading state during computation | Edge-based data is larger than polygon data (hundreds to thousands of LineString features vs 4 polygons). Users need feedback. | LOW | Reuse existing `isFetching` pattern from `useIsochroneFetch`. |
| Legend showing time-band color mapping | With edges colored by time, users need a legend explaining what each color means. The polygon view uses colored dots in the sidebar (already built); edge view needs the same. | LOW | Extend existing IsochroneControls sidebar section. |

### Differentiators (Edge-Based Isochrones)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Continuous color gradient (not banded) | Instead of 4 discrete color bands, use a smooth interpolation from green (0 min) to red (max min) based on actual agg_cost. Shows fine-grained time variation within bands. | LOW | MapLibre `interpolate` expression on `line-color` with `agg_cost` property. More informative than discrete `step` bands. |
| Edge + polygon overlay mode | Show both polygon fill (faded) and colored edges simultaneously. The polygon gives spatial context while edges show detail. Best of both worlds. | LOW | Render polygon fill at very low opacity (0.1) beneath the edge line layer. Both layers use same data source. |
| Interactive hover on edge segments | Hover over a street segment to see its name and exact travel time (e.g., "Broadway - 7.3 min"). Gives precise information that neither polygons nor colored lines alone can convey. | MEDIUM | MapLibre `mouseenter`/`mouseleave` events on the edge layer. Requires street name and travel time in the GeoJSON properties. |
| Edge-based isochrone with traffic coloring | In drive mode with traffic enabled, color edges not by time band but by traffic factor -- showing which reachable streets have congestion. Unique combination of reachability + traffic awareness. | MEDIUM | Requires joining traffic_factor data to pgr_drivingDistance edge results. Extends existing traffic color scale in style.ts. |
| Boundary edge interpolation | For edges that cross a time-band boundary (partially reachable within the cutoff), clip the edge geometry at the precise cutoff point using linear interpolation along the line. Avoids the jarring effect of an edge being fully colored when only part of it is within reach. | HIGH | Requires PostGIS ST_LineSubstring with (cutoff - node_agg_cost) / edge_cost ratio. Adds significant SQL complexity. |

### Anti-Features (Edge-Based Isochrones)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Voronoi cell coloring around edges | GraphHopper's advanced approach creates colored Voronoi cells around each edge to fill space between streets. Computationally expensive (PostGIS ST_VoronoiPolygons) and adds visual noise for a dense NYC street grid. | Color the edges directly as lines. NYC's grid is dense enough that colored streets create a clear visual pattern without needing to fill gaps. |
| Binary/custom format for edge data | GraphHopper uses a custom binary edge format (5x smaller than GeoJSON). Premature optimization for this app's scale (NYC has ~177K edges, pgr_drivingDistance returns a subset). | Use standard GeoJSON. The reachable edge set for a 20-min isochrone is typically 2K-10K edges -- well within GeoJSON's practical limits for MapLibre. |
| Client-side edge rendering without server geometry | Fetching all edge geometries to the client upfront and filtering client-side. Would require sending 177K LineStrings (~50MB+) to the browser. | Return only reachable edges with geometries from the API. The server does the spatial join and returns a focused GeoJSON FeatureCollection. |
| 3D edge visualization (height = time) | Extruding street segments vertically by travel time creates a dramatic 3D effect but requires WebGL overhead and hurts readability on a 2D base map. | Keep visualization 2D. Color encodes time. |

---

## FEATURE 2: Waypoint / Via-Point Routing

### What It Is

Allow users to add intermediate stops (waypoints) between origin and destination. The route passes through each waypoint in order, creating a multi-leg journey. This is the "add a stop" feature familiar from Google Maps, Apple Maps, and every turn-by-turn navigation app.

Two distinct waypoint types exist in the routing domain:
1. **Stopover waypoints** -- the route stops at this location (for pickup, errand, etc.). Creates separate route legs with independent turn-by-turn directions.
2. **Via/pass-through waypoints** -- the route passes through this point without stopping. Used to influence route shape ("go via the bridge, not the tunnel"). Creates a single leg.

For this app, **stopover waypoints are the primary use case**. Via/pass-through points are a secondary enhancement.

### Table Stakes (Waypoint Routing)

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Add at least 1 intermediate waypoint | Every major mapping app supports adding stops. Users expect to plan multi-stop trips (e.g., "home -> coffee shop -> office"). Without this, the app is limited to single-leg routes. | MEDIUM | Requires extending RoutingContext from 2 addresses to N addresses. New waypoint state management. |
| Remove a waypoint | Users must be able to delete a waypoint they added. Standard pattern: X button next to the waypoint in the sidebar list. | LOW | Remove from waypoint array, re-fetch route. |
| Reorder waypoints via drag-and-drop | Google Maps, Apple Maps, Roadtrippers all use drag handles (6-dot grip icon or hamburger lines) to reorder stops. Users expect to rearrange stops by dragging them up or down in the sidebar list. | MEDIUM | MUI supports drag-and-drop list reordering. Need to integrate with route re-fetch on drop. |
| Per-leg route display | Each leg (origin->WP1, WP1->WP2, WP2->dest) should be visually distinguishable on the map. At minimum, waypoint markers should appear between legs. | MEDIUM | Multiple route segments rendered as separate layers or a single layer with waypoint markers overlaid. pgr_trspVia or sequential pgr_trsp calls return path_id per leg. |
| Per-leg turn-by-turn directions | The sidebar RouteList must show directions grouped by leg. "Leg 1: Home to Coffee Shop" with its own instruction list, then "Leg 2: Coffee Shop to Office" with separate instructions. | MEDIUM | Existing _format_route_response works per-leg. Need to call it per path_id and wrap in a leg-level grouping structure. |
| Total route summary (all legs) | Show aggregate distance and time across all legs, plus per-leg breakdown. Users want both the total trip stats and individual leg stats. | LOW | Sum travel_time and distance across all leg responses. Display in RouteList header. |
| Waypoint markers on map | Each waypoint needs a numbered or lettered marker on the map (A, B, C or 1, 2, 3) to show its position in the route sequence. Start (green) and End (red) markers already exist. | LOW | Add intermediate point markers with neutral color (blue or gray) and sequence labels. Extend existing startPointSource/endPointSource pattern. |
| URL deep links for waypoints | The existing deep link system encodes start/end in URL params. Waypoints must also be encoded so multi-stop routes can be shared. | LOW | Extend useRouteStateSync. Add params like `&via1=-73.98,40.75&via1Addr=Coffee+Shop`. |

### Differentiators (Waypoint Routing)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Click-on-map to add waypoint | After setting origin and destination, clicking the map (or clicking on the route line) adds a waypoint at that location. More intuitive than typing addresses for every stop. | MEDIUM | Map click handler that inserts a waypoint. Needs to determine insertion position (between which existing stops based on proximity to route segments). |
| Swap any adjacent stops | Extend existing swap button (SwapVert) to work between any adjacent pair in the waypoint list, not just origin/destination. Quick reordering without full drag-and-drop. | LOW | Swap two items in the waypoint array. |
| "Add stop" button between each pair | Show a subtle "+" button between each consecutive pair of stops in the sidebar. Clicking opens a search input to add a waypoint at that specific position. Google Maps uses this pattern. | LOW | Insert a new empty search input at the clicked position. |
| Via/pass-through waypoints | A toggle per waypoint: "Stop here" vs "Pass through". Pass-through waypoints influence route shape without creating separate legs. Useful for forcing a route via a specific bridge, tunnel, or street. | HIGH | pgr_trspVia treats all vertices as stopovers. Pass-through would require splitting the route differently or using pgr_withPoints for arbitrary on-edge points. Significant SQL complexity. |
| Waypoint address autocomplete | Each waypoint input field should have the same Geosupport autocomplete as the existing Start/End search. Users expect consistent search UX. | LOW | Reuse existing Search component. Each waypoint gets its own Search instance. |
| Leg-specific travel mode | Allow different travel modes per leg (e.g., walk to subway, then bike to destination). Multi-modal trip planning. | HIGH | Requires separate routing calls per leg with different mode parameters. Significant UI and state complexity. Per-leg mode selector in sidebar. |
| Route optimization ("best order") | Automatically reorder waypoints to minimize total travel time. Google Routes API offers this for up to 25 waypoints. | HIGH | Requires solving the Traveling Salesman Problem (TSP). pgRouting has pgr_TSP but it needs a full cost matrix (N^2 routing calls). Impractical for real-time use with >5 waypoints on this backend. |

### Anti-Features (Waypoint Routing)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Unlimited waypoints | Google Maps caps at 25 intermediate waypoints (and charges more for >10). For a PoC, supporting unlimited waypoints creates UI complexity (scrolling lists, performance issues with many legs) and backend load (N+1 routing calls). | Cap at 3-5 intermediate waypoints. This covers the vast majority of real-world multi-stop trips. |
| Drag route line to add waypoints | Google Maps lets you drag the route polyline on the map to create a detour waypoint. This requires complex hit-testing on the rendered route, snapping to the nearest road, and inserting a waypoint at the correct sequence position. | Use "click map to add waypoint" instead. Simpler to implement, works with existing click handlers, and is more explicit about user intent. |
| Real-time re-routing as waypoints are dragged on map | Continuously re-computing the route while a waypoint marker is being dragged on the map. Requires sub-second routing responses for smooth UX. | Re-fetch route only after marker is placed (on drag-end). Show loading indicator during re-computation. |
| Waypoint scheduling / time windows | Allowing users to set "arrive by" or "depart at" times for each waypoint. This is a logistics/fleet optimization feature, not a consumer mapping feature. | Show estimated arrival time at each waypoint based on cumulative travel time. No scheduling input. |
| Multi-modal per-leg routing | See differentiators. While valuable, the UI and backend complexity of per-leg mode switching is disproportionate to its value in a PoC. Every leg would need its own mode selector, and the existing pgr_trspVia assumes uniform edge costs. | Use a single travel mode for the entire trip. This matches the existing mode selector UX. |

---

## Feature Dependencies

### Edge-Based Isochrones

```
pgr_drivingDistance (existing) -----> Returns node + edge + agg_cost
                                           |
                                           v
                               Edge geometry JOIN (new SQL)
                               Join edges table on edge ID
                               Return LineString + agg_cost + street
                                           |
                                    +------+------+
                                    |             |
                                    v             v
                           New API response    Existing polygon
                           format (edges)      response (unchanged)
                                    |             |
                                    v             v
                           MapLibre line      MapLibre fill
                           layer (new)        layer (existing)
                                    |             |
                                    +------+------+
                                           |
                                           v
                                 Toggle control (new)
                                 polygon | edges | both
                                           |
                                           v
                                 Sidebar legend (extend)
```

**Critical dependency:** The existing pgr_drivingDistance functions already return `edge` IDs. The main new work is the geometry JOIN -- selecting edge geometries from the `edges` table using the edge IDs from pgr_drivingDistance results. This is a SQL extension, not a rewrite.

### Waypoint Routing

```
Address Search (existing) ---------> Waypoint State (new)
                                     Array of IMapFeature[]
                                           |
                                           v
                                     Waypoint UI Controls (new)
                                     Add / Remove / Reorder
                                           |
                                           v
                                     API Extension (new)
                                     GET /api/route?orig=...&dest=...&via=lon,lat&via=lon,lat
                                           |
                                           v
                                     pgr_trspVia / sequential pgr_trsp (new SQL)
                                     Returns path_id per leg
                                           |
                                           v
                                     Multi-leg response format (new)
                                     RouteResponse with legs[] array
                                           |
                                    +------+------+
                                    |             |
                                    v             v
                              Map rendering    Sidebar RouteList
                              waypoint markers  per-leg directions
                              per-leg lines     leg summaries
                                    |             |
                                    +------+------+
                                           |
                                           v
                                     URL deep links (extend)
                                     useRouteStateSync with via params
```

**Critical dependency:** Waypoint routing requires changes across all layers: state management (RoutingContext), UI (Search components + drag-reorder), API (new endpoint params), SQL (pgr_trspVia or sequential calls), response format (legs array), and map rendering (waypoint markers).

### Cross-Feature Dependencies

These two features are independent of each other. They can be built in parallel or in either order. Both depend on existing infrastructure:

- Edge-based isochrones depend on: existing isochrone SQL functions, existing MapLibre layer system
- Waypoint routing depends on: existing routing SQL functions, existing Search component, existing RoutingContext

Neither feature requires the other. However, both benefit from:
- The existing `useGeoJsonLayer` hook (already handles add/update/remove for any GeoJSON)
- The existing `useRouteStateSync` hook (URL deep linking framework)
- The existing color/style utilities in `style.ts`

---

## MVP Recommendation

### Edge-Based Isochrones -- Build First (lower complexity, higher visual impact)

**Priority order:**
1. **Edge geometry SQL function** -- Extend existing isochrone SQL to return edge LineStrings with agg_cost bands instead of (or alongside) polygons. JOIN pgr_drivingDistance edge IDs back to the edges table for geom_4326.
2. **API response format** -- Add edge-based GeoJSON FeatureCollection to IsochroneResponse (each feature: LineString geometry + properties: { agg_cost, band_index, street }).
3. **MapLibre edge line layer** -- New line layer with data-driven `line-color` using `step` expression on `band_index`. Follows existing pattern in style.ts.
4. **Toggle control** -- Simple segmented button or icon toggle: polygon view | edge view | both. In sidebar near existing isochrone controls.
5. **Legend integration** -- Extend existing IsochroneControls color dots to label the edge view too.

**Defer:**
- Continuous gradient coloring (use discrete bands first, match polygon colors)
- Hover interactions on edges (nice-to-have, not required for V1)
- Boundary edge interpolation (HIGH complexity, low visual impact at city scale)
- Traffic-colored edges (build after basic edge visualization is stable)

### Waypoint Routing -- Build Second (higher complexity, broader feature surface)

**Priority order:**
1. **Waypoint state management** -- Extend RoutingContext to hold `waypoints: IMapFeature[]` array between start and end addresses. Add setWaypoints, addWaypoint, removeWaypoint, reorderWaypoints.
2. **Sidebar waypoint UI** -- "Add stop" button that inserts a new Search input between existing stops. X button to remove. Drag handle to reorder (can defer drag to V2 if needed).
3. **API extension** -- Accept `via` query param(s) on `/api/route`. Parse into coordinate pairs. Route through them in order.
4. **SQL via-routing** -- Use pgr_dijkstraVia (stable) or pgr_trspVia (proposed, with turn restrictions) to compute multi-leg route. Return path_id per leg.
5. **Multi-leg response** -- Extend RouteResponse schema with legs array. Each leg contains its own features[], distance, travel_time, and turn instructions.
6. **Map rendering** -- Numbered waypoint markers. Per-leg route segments (can be same color, differentiated by markers).
7. **URL deep links** -- Encode waypoints in URL params for sharing.

**Defer:**
- Click-on-map to add waypoint (build after sidebar-based waypoint addition works)
- Via/pass-through waypoints (HIGH SQL complexity, niche use case)
- Route optimization / TSP (impractical at this backend scale)
- Per-leg travel mode (massive scope increase)
- Drag-and-drop reorder (can ship with up/down arrow buttons first, add drag later)

---

## UX Pattern Recommendations

### Edge-Based Isochrone Toggle

**Pattern:** Add a small icon toggle or segmented control near the existing isochrone controls. Three states: "Area" (polygon), "Streets" (edges), "Both" (overlay). Default to "Area" to match current behavior.

**Rationale:** Users who are familiar with the polygon view should not be surprised by a change. The edge view is an enhancement, not a replacement. "Both" mode shows polygon fill at very low opacity with colored edges on top -- useful for understanding both the approximate area and the precise network.

**Interaction:** Switching between modes should not require a new API call if both polygon and edge data are already loaded. The toggle only changes which MapLibre layers are visible.

### Waypoint Addition

**Pattern:** The Google Maps pattern is the established standard:
1. A "+" button (or "Add stop" text button) appears between the last filled search input and the destination.
2. Clicking it inserts a new empty search input at that position.
3. The new input has the same autocomplete behavior as Start/End.
4. An "X" button on each waypoint removes it and collapses the list.

**Sidebar layout in route mode with waypoints:**
```
[ From: Home                          [X] [loc] ]
   [+] Add stop
[ Via: Coffee Shop                    [X] [loc] ]
   [+] Add stop
[ To: Office                          [X] [loc] ]
   [swap] [clear]
```

**Rationale:** This is the most familiar pattern. Users understand it immediately because Google Maps trained the behavior. The vertical list of inputs clearly shows the route sequence.

### Waypoint Reorder

**Pattern:** Two approaches, in order of implementation simplicity:

1. **V1: Up/down arrow buttons** -- Small up/down arrow icons on each waypoint (not on origin/destination). Clicking swaps with adjacent stop. Simple, accessible, works on touch devices.
2. **V2: Drag-and-drop** -- Grip handle (6-dot icon) on the left of each waypoint. User clicks, holds, and drags to reorder. Existing SwapVert button between Start/End can remain for the simple 2-point swap case.

**Rationale:** Drag-and-drop is the expected pattern but is harder to implement correctly (touch support, accessibility, visual feedback during drag). Up/down arrows give 80% of the value with 20% of the complexity.

### Waypoint Map Markers

**Pattern:** Intermediate waypoints get numbered circular markers with a neutral color (e.g., blue #3b82f6 or gray #6b7280) and white text showing the stop number. Start remains green, end remains red.

```
[green A] ----route---- [blue 1] ----route---- [blue 2] ----route---- [red B]
```

**Rationale:** Numbered markers create a clear visual sequence. Using a neutral color for intermediates avoids confusion with start (green) and end (red) markers. The letter/number distinction (A/B for endpoints, 1/2/3 for waypoints) is used by Google Maps and is intuitive.

### Multi-Leg Route Display

**Pattern:** All legs rendered as a single continuous route line (same color), with waypoint markers overlaid at each stop. The turn-by-turn directions in the sidebar are grouped by leg with a header: "Leg 1: Home to Coffee Shop (12 min, 2.3 mi)".

**Alternative considered and rejected:** Different colors per leg. This creates visual confusion when 3-5 legs overlap or run adjacent. A single color with marker breaks is cleaner.

---

## Backend Considerations

### Edge-Based Isochrones: SQL Approach

The existing isochrone functions call `pgr_drivingDistance` which returns `(seq, depth, start_vid, pred, node, edge, cost, agg_cost)`. The `edge` column contains the spanning tree edges. To get ALL reachable edges (not just the spanning tree), use:

```sql
-- Approach: All edges connecting any two reachable nodes
WITH reachable AS (
    SELECT node, agg_cost FROM pgr_drivingDistance(...)
)
SELECT DISTINCT ON (e.id)
    e.id, e.street, e.geom_4326,
    LEAST(rn1.agg_cost, rn2.agg_cost) AS min_agg_cost,
    -- Assign band index
    CASE
        WHEN LEAST(rn1.agg_cost, rn2.agg_cost) <= 5 THEN 1
        WHEN LEAST(rn1.agg_cost, rn2.agg_cost) <= 10 THEN 2
        WHEN LEAST(rn1.agg_cost, rn2.agg_cost) <= 15 THEN 3
        ELSE 4
    END AS band_index
FROM edges e
JOIN reachable rn1 ON e.source = rn1.node
JOIN reachable rn2 ON e.target = rn2.node
WHERE e.{mode}able = TRUE;
```

This returns all edges where BOTH endpoints are reachable within the max interval. Using `LEAST(source_cost, target_cost)` assigns the band based on the closer endpoint, giving the earliest arrival time to that edge.

### Waypoint Routing: pgr_trspVia vs Sequential pgr_trsp

Two approaches:

1. **pgr_trspVia** (proposed in pgRouting 3.7+): Single function call with vertex array and restrictions SQL. Returns path_id per leg. Handles turn restrictions. Status is "proposed" -- may not be available in the Docker image's pgRouting 3.8.

2. **Sequential pgr_trsp calls**: Call the existing `getdrivingroute(lat1, lon1, lat2, lon2)` function once per leg. Concatenate results with a leg_index. Guaranteed to work with existing infrastructure. Slightly less efficient but simpler.

**Recommendation:** Start with sequential calls to existing routing functions. This is guaranteed to work with zero SQL changes. The Python service layer chains N routing calls and assembles the multi-leg response. If pgr_trspVia is available and stable, migrate to it later for a single-query optimization.

---

## Sources

- [pgr_dijkstraVia - pgRouting Manual 3.8](https://access.crunchydata.com/documentation/pgrouting/3.8.0/pgr_dijkstraVia.html) -- Via vertex routing function signature, return columns (path_id, route_agg_cost), behavior with multiple waypoints
- [pgr_trspVia - pgRouting Manual (proposed)](https://access.crunchydata.com/documentation/pgrouting/latest/pgr_trspVia.html) -- Turn-restricted via routing, proposed status, two-phase algorithm (Dijkstra then TRSP for restricted segments)
- [pgr_drivingDistance - pgRouting Manual 3.8](https://docs.pgrouting.org/latest/en/pgr_drivingDistance.html) -- Return columns including edge (spanning tree), agg_cost; basis for edge-based isochrone extraction
- [Google Routes API: Intermediate Waypoints](https://developers.google.com/maps/documentation/routes/intermed_waypoints) -- Leg-per-waypoint response structure, stopover vs pass-through distinction, 25 waypoint max
- [Google Routes API: Waypoint Types](https://developers.google.com/maps/documentation/routes/waypoint-types) -- via (boolean) for pass-through, vehicleStopover for stops, sideOfRoad preference
- [Google Routes API: Pass-Through Points](https://developers.google.com/maps/documentation/routes/pass-through) -- Single-leg behavior for via waypoints vs multi-leg for stopovers
- [GraphHopper: High Precision Reachability with deck.gl](https://www.graphhopper.com/blog/2018/07/04/high-precision-reachability/) -- Edge-based visualization approach, binary edge format, deck.gl performance with millions of edges, animated time-dependent reachability
- [Jeff Allen: Using Network Segments in the Visualization of Urban Isochrones](https://jamaps.github.io/docs/allen_2018_isochrones.pdf) -- Academic basis for edge-based isochrone visualization, advantages over polygon approaches, Toronto case study
- [MapLibre Style Spec: Layers](https://maplibre.org/maplibre-style-spec/layers/) -- line-color data-driven styling, step/interpolate expressions for property-based coloring
- [MapLibre Expressions & Data-Driven Styling](https://deepwiki.com/maplibre/maplibre-gl-js/3.2-expressions-and-data-driven-styling) -- get, match, step, interpolate expression patterns for feature-property-based styling
- [Drag & Drop UX Best Practices - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-drag-and-drop) -- Grab handle patterns, visual feedback during drag, touch device considerations
- [TRSP Family - pgRouting Manual 3.6](https://docs.pgrouting.org/3.6/en/TRSP-family.html) -- pgr_trsp, pgr_trspVia, pgr_trspVia_withPoints function family overview

---
*Feature research for: NYC Open Routing v2.0 -- Edge-Based Isochrones & Waypoint Routing*
*Researched: 2026-02-14*
