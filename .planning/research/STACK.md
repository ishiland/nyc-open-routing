# Technology Stack: Edge-Based Isochrones & Waypoint Routing

**Project:** NYC Open Routing -- v2.0 Milestone
**Researched:** 2026-02-14
**Confidence:** HIGH (database layer), HIGH (frontend layer), MEDIUM (waypoint routing)
**Mode:** Subsequent milestone -- extending existing stack, zero new dependencies

## Executive Summary

Both edge-based isochrone visualization and waypoint routing require **zero new npm packages, zero new Python packages, and zero new PostgreSQL extensions**. Everything builds on the existing pgRouting 3.8 + PostGIS 3.5 + MapLibre GL 5 stack.

**Edge-based isochrones** replace the current polygon (ST_ConcaveHull) approach with line geometry from the actual reachable street network. The key insight: `pgr_drivingDistance` already returns an `edge` column -- JOIN it to the `edges` table to get geometries. Each edge carries its `agg_cost`, enabling time-band coloring via MapLibre's data-driven `line-color` expressions. This produces a more accurate, visually striking result than polygons.

**Waypoint routing** uses `pgr_dijkstraVia` (Proposed in 3.8, official in 4.0) or sequential `pgr_trsp` calls. Given that the project already uses `pgr_trsp` (also Proposed in 3.8) without issues, `pgr_trspVia` is the natural choice for turn-restriction-aware multi-stop routing. Alternatively, chaining `pgr_trsp` calls in a PL/pgSQL function provides identical results with a familiar pattern.

## Recommended Stack Additions

### Database Layer: Edge-Based Isochrones (No New Extensions)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `pgr_drivingDistance` | pgRouting 3.8 (installed) | Compute reachable spanning tree with edge IDs | HIGH |
| `JOIN edges` on `edge` column | Existing table | Retrieve `geom_4326` for each reachable edge | HIGH |
| `ST_Transform` / `geom_4326` | PostGIS 3.5 (installed) | Geometry already cached in WGS84 on edges table | HIGH |

#### How Edge-Based Isochrones Work

`pgr_drivingDistance` returns `(seq, depth, start_vid, pred, node, edge, cost, agg_cost)`. The `edge` column is the edge ID used to reach each node. JOIN this to the `edges` table to get actual street geometry:

```sql
-- Edge-based isochrone: returns line geometries with time costs
WITH reachable AS (
    SELECT dd.edge, dd.agg_cost
    FROM pgr_drivingDistance(
        'SELECT id, source, target, cost_drive AS cost, rcost_drive AS reverse_cost
         FROM edges WHERE driveable = TRUE',
        getnearestdrivenode(:lon, :lat),
        :max_minutes,
        TRUE  -- directed
    ) dd
    WHERE dd.edge != -1  -- Exclude start node row (edge = -1)
)
SELECT
    r.edge AS edge_id,
    r.agg_cost,
    e.street,
    e.length_feet,
    e.geom_4326 AS geom
FROM reachable r
JOIN edges e ON e.id = r.edge
ORDER BY r.agg_cost;
```

**Why this replaces ST_ConcaveHull:**
1. Actual street geometry -- no polygon approximation covering parks/water
2. Per-edge time cost enables continuous color gradients
3. Faster -- no hull computation (ST_ConcaveHull was 100-500ms per band)
4. More informative -- users see which streets are reachable, not just an area blob

**Time-band assignment** happens either server-side (classify `agg_cost` into bands) or client-side (MapLibre expression on the `agg_cost` property). Server-side classification is simpler:

```sql
-- Add band assignment to the query
SELECT
    e.id AS edge_id,
    r.agg_cost,
    CASE
        WHEN r.agg_cost <= 5 THEN 1
        WHEN r.agg_cost <= 10 THEN 2
        WHEN r.agg_cost <= 15 THEN 3
        ELSE 4
    END AS band_index,
    e.street,
    e.geom_4326 AS geom
FROM reachable r
JOIN edges e ON e.id = r.edge
```

**Or use continuous coloring** (recommended) -- pass raw `agg_cost` to the frontend and let MapLibre interpolate colors smoothly across the time range. This avoids arbitrary band boundaries and produces a more natural visualization.

#### Performance Comparison: Edge-Based vs Polygon

| Operation | Polygon (Current) | Edge-Based (New) | Notes |
|-----------|-------------------|-------------------|-------|
| `pgr_drivingDistance` | 200-800ms | 200-800ms | Same call |
| Geometry retrieval | ST_ConcaveHull x4: 400-2000ms | JOIN edges: ~5ms | Simple index lookup |
| Response size | 4 polygons (~2KB) | 1000-5000 edges (~200-500KB) | Larger but compressible |
| MapLibre render | <16ms (4 polygons) | <30ms (line layer) | WebGL handles thousands of lines |
| **Total** | **600-2800ms** | **200-810ms** | **2-3x faster** |

The tradeoff is response size: edge-based returns more geometry data (each edge is a LineString). For a 20-minute driving isochrone in NYC, expect ~3000-5000 edges. At ~100 bytes per edge GeoJSON feature, that is ~300-500KB uncompressed, ~50-100KB gzipped. Acceptable for a POC.

### Database Layer: Waypoint/Via-Point Routing

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `pgr_trspVia` | pgRouting 3.8 (Proposed) | Multi-stop routing with turn restrictions | MEDIUM |
| `pgr_dijkstraVia` | pgRouting 3.8 (Proposed) | Multi-stop routing without turn restrictions | HIGH |
| Sequential `pgr_trsp` calls | pgRouting 3.8 (Proposed, already in use) | Fallback: chain A->B->C as separate calls | HIGH |

#### Waypoint Routing: Three Approaches

**Approach 1: `pgr_trspVia` (Recommended if turn restrictions matter)**

```sql
SELECT * FROM pgr_trspVia(
    'SELECT id, source, target, cost_drive AS cost, rcost_drive AS reverse_cost
     FROM edges WHERE driveable = TRUE',
    'SELECT path, cost FROM restrictions_for_driving',
    ARRAY[start_node, via_node_1, via_node_2, end_node],
    directed => TRUE,
    strict => FALSE,      -- Return partial route if segment fails
    U_turn_on_edge => TRUE
);
-- Returns: (seq, path_id, path_seq, start_vid, end_vid, node, edge, cost, agg_cost, route_agg_cost)
```

Status: Proposed in pgRouting 3.8. Same status as `pgr_trsp` which this project already uses successfully. The "Proposed" designation means the function is available and tested but its API signature may change in the next major release (4.0). Given that `pgr_trsp` has been Proposed since 3.4 and works reliably, `pgr_trspVia` is expected to be equally stable.

**Approach 2: `pgr_dijkstraVia` (Simpler, no turn restrictions)**

```sql
SELECT * FROM pgr_dijkstraVia(
    'SELECT id, source, target, cost_drive AS cost, rcost_drive AS reverse_cost
     FROM edges WHERE driveable = TRUE',
    ARRAY[start_node, via_node_1, via_node_2, end_node],
    directed => TRUE,
    strict => FALSE,
    U_turn_on_edge => TRUE
);
-- Returns: same columns as pgr_trspVia
```

Status: Proposed in 3.8, promoted to official in 4.0. Simpler than `pgr_trspVia` but ignores turn restrictions. For bike/walk modes (where restrictions are minimal), this may be sufficient.

**Approach 3: Sequential `pgr_trsp` calls (Safest, most familiar)**

Chain individual `pgr_trsp` calls in a PL/pgSQL function, one per leg:

```sql
-- Pseudo-code for PL/pgSQL wrapper
FOR i IN 1..(array_length(via_vertices, 1) - 1) LOOP
    -- Route from via_vertices[i] to via_vertices[i+1]
    SELECT * FROM pgr_trsp(edges_sql, restrictions_sql,
                           via_vertices[i], via_vertices[i+1], TRUE)
    -- Append to result with path_id = i
END LOOP;
```

This is the safest approach because:
- Uses the same `pgr_trsp` call pattern already working in `getdrivingroute()`
- Full control over per-leg error handling
- Easy to add per-leg turn instructions using existing CTE pattern
- No dependency on Via function API stability

**Recommendation:** Use **sequential `pgr_trsp` calls** (Approach 3) for the initial implementation. It reuses the existing, proven pattern from `getdrivingroute()`. Migrate to `pgr_trspVia` later if the sequential approach has performance issues (unlikely for 2-5 waypoints).

#### Return Column Differences

| Column | `pgr_trsp` (current) | `pgr_trspVia` / `pgr_dijkstraVia` |
|--------|----------------------|-------------------------------------|
| `seq` | Row sequence | Row sequence |
| `path_id` | N/A | Leg identifier (1, 2, 3...) |
| `path_seq` | Sequence within path | Sequence within leg |
| `node` | Vertex ID | Vertex ID |
| `edge` | Edge ID | Edge ID |
| `cost` | Edge cost | Edge cost |
| `agg_cost` | Total from start | Total from leg start |
| `route_agg_cost` | N/A | Total from route start |

The Via functions add `path_id` (which leg) and `route_agg_cost` (cumulative across all legs) -- useful for total trip time and per-leg instruction grouping.

### Database Layer: K-Shortest Paths (Alternative Routes)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `pgr_KSP` | pgRouting 3.8 (Official) | K alternative routes between two points | HIGH |

`pgr_KSP` implements Yen's algorithm. It is an **official function** since pgRouting 2.0.0 -- fully stable.

```sql
SELECT * FROM pgr_KSP(
    'SELECT id, source, target, cost_drive AS cost, rcost_drive AS reverse_cost
     FROM edges WHERE driveable = TRUE',
    start_node, end_node,
    3,                    -- K = number of alternative routes
    directed => TRUE,
    heap_paths => FALSE   -- Only return K best paths
);
-- Returns: (seq, path_id, path_seq, start_vid, end_vid, node, edge, cost, agg_cost)
```

**Caveats:**
- Does NOT support turn restrictions (uses Dijkstra internally, not TRSP)
- `heap_paths => TRUE` can return many more paths than K (N * K where N is edge count of shortest path) -- avoid for large networks
- Alternative routes may share most edges (Yen's finds mathematically shortest alternatives, not necessarily geographically distinct routes)
- For a POC, K=3 with `heap_paths => FALSE` is sufficient

**Use case:** Show 2-3 alternative routes to choose from. NOT for waypoint routing.

### API Layer: FastAPI (No New Dependencies)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| FastAPI | Installed | Extended `/api/isochrone` endpoint, new waypoint param on `/api/route` | HIGH |
| Pydantic | Installed | Extended response models | HIGH |
| Shapely | Installed | WKB-to-GeoJSON conversion (existing `dump_geo()`) | HIGH |
| SQLAlchemy | Installed | Database query execution (existing pattern) | HIGH |

#### Edge-Based Isochrone Response Model

Extend existing `IsochroneResponse` or create a new response type:

```python
class IsochroneEdgeProperties(BaseModel):
    """Properties for a single reachable edge in edge-based isochrone."""
    edge_id: int
    agg_cost: float           # Minutes from origin
    street: Optional[str]
    length_feet: Optional[float]

class IsochroneEdgeFeature(BaseModel):
    """GeoJSON Feature for a reachable edge."""
    type: Literal["Feature"] = "Feature"
    properties: IsochroneEdgeProperties
    geometry: Dict[str, Any]  # LineString GeoJSON

class IsochroneEdgeResponse(BaseModel):
    """Response model for edge-based isochrone endpoint."""
    features: List[IsochroneEdgeFeature]
    origin: Dict[str, Any]    # Origin point GeoJSON
    max_minutes: float
```

#### Waypoint Route API Extension

Add optional `via` parameter to existing `/api/route`:

```python
@router.get("/route", response_model=RouteResponse)
def get_route(
    orig: str = Query(..., description="Origin (lon,lat)"),
    dest: str = Query(..., description="Destination (lon,lat)"),
    via: Optional[str] = Query(
        default=None,
        description="Via points as semicolon-separated lon,lat pairs (e.g., '-73.98,40.75;-73.97,40.76')"
    ),
    mode: TravelMode = Query(...),
    ...
):
```

### Frontend Layer: MapLibre GL (No New Dependencies)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| MapLibre GL JS | 5.3.0 (installed) | `line` layer with data-driven `line-color` for edge isochrones | HIGH |
| React | 18.2.x (installed) | State management via existing Context API | HIGH |
| MUI | 7.0.1 (installed) | UI controls | HIGH |

#### Edge-Based Isochrone: Line Layer with Time-Based Coloring

Use a `line` layer type instead of `fill`. Data-driven `line-color` with `interpolate` on the `agg_cost` property creates smooth time-gradient coloring:

```typescript
// Edge-based isochrone layer
useGeoJsonLayer(
  map,
  "isochroneEdgeSource",
  "isochroneEdgeLayer",
  isochroneEdgeFeatures,
  {
    type: "line",
    paint: {
      // Continuous color gradient based on travel time
      "line-color": [
        "interpolate",
        ["linear"],
        ["get", "agg_cost"],
        0,  "#22c55e",   // Green at origin (0 min)
        5,  "#84cc16",   // Yellow-green at 5 min
        10, "#facc15",   // Yellow at 10 min
        15, "#f97316",   // Orange at 15 min
        20, "#ef4444",   // Red at 20 min
      ],
      // Width varies by zoom
      "line-width": [
        "interpolate", ["linear"], ["zoom"],
        10, 1.5,
        14, 3,
        16, 5,
      ],
      "line-opacity": 0.85,
    },
  },
)
```

**Why `interpolate` on `agg_cost` (not band_index):**
- Smooth color gradient across the entire time range -- no visible band boundaries
- `line-color` fully supports data-driven `interpolate` expressions (since MapLibre GL JS 0.23.0)
- `line-width` also supports data-driven expressions (since 0.39.0)
- Both are well within MapLibre GL 5.3.0's capabilities

**Critical: `line-gradient` is NOT the right choice.** `line-gradient` colors along a single LineString's length and does NOT support data-driven expressions from feature properties (open issue [maplibre/maplibre-gl-js#5037](https://github.com/maplibre/maplibre-gl-js/issues/5037)). For edge-based isochrones, each edge is a separate feature with its own `agg_cost` property, so standard `line-color` with `["get", "agg_cost"]` is correct.

#### Layer Z-Ordering Update

Edge-based isochrone lines should render below route layers:

```
Bottom (map tiles)
  -> isochroneEdgeLayer (line, time-colored reachable edges)
  -> routeHaloLayer (existing)
  -> routeLayer (existing)
  -> waypointLayers (new, for via points)
  -> startPointLayer (existing)
  -> endPointLayer (existing)
  -> label layers (existing)
Top
```

Update `CUSTOM_LAYER_ORDER` in `mapHelpers.ts` to include `isochroneEdgeLayer` (and remove old polygon layers if fully replaced).

#### Waypoint Markers

For via-point markers, reuse the existing `useGeoJsonLayer` circle pattern with sequential labels (A, B, C...):

```typescript
// Via point markers: intermediate points between start and end
useGeoJsonLayer(
  map,
  "waypointSource",
  "waypointLayer",
  waypointFeatures,  // Array of point features with {label: "B", index: 1} properties
  {
    type: "circle",
    paint: {
      ...addressPointPaint,
      "circle-color": "#6366f1",  // Indigo for waypoints (distinct from green start, red end)
    },
  },
)
```

## What NOT to Add (and Why)

| Technology | Why Not |
|------------|---------|
| `ST_ConcaveHull` for edge-based isochrones | Edge geometries from the edges table are more accurate and faster than hull computation. Keep polygon isochrones as a fallback option, but edge-based is the primary visualization. |
| `line-gradient` MapLibre property | Does not support data-driven expressions from feature properties. Use `line-color` with `["interpolate", ..., ["get", "agg_cost"]]` instead. |
| `turf.js` | All geometry processing happens server-side. No client-side spatial computation needed. |
| `deck.gl` / `kepler.gl` | Overkill for line rendering. MapLibre's native line layer handles thousands of features at 60fps. |
| `pgr_turnRestrictedPath` | Experimental status in pgRouting 3.8 with "possible server crash" warning. Avoid entirely. |
| `pgr_KSP` with `heap_paths => TRUE` | Returns N*K paths for large networks. With 177k edges, this could be hundreds of paths. Always use `heap_paths => FALSE`. |
| `pgr_withPoints` family | Designed for routing from arbitrary points on edges (not vertices). Waypoint routing between intersections (vertices) doesn't need this. Only useful if accepting arbitrary lat/lon waypoints snapped to edge midpoints -- the existing nearest-node functions are simpler. |
| `geojson-pydantic` | Same rationale as before -- existing lightweight model pattern works. |
| New GeoJSON library (client) | TypeScript interfaces already handle the response structure. |
| WebSocket for isochrones | Response time is <1 second. HTTP request-response is simpler. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Isochrone visualization | Edge-based lines | Polygon (ST_ConcaveHull) | Polygons cover parks/water. Lines show actual street network. Faster too. |
| Isochrone coloring | Continuous `interpolate` on `agg_cost` | Discrete band_index match | Continuous is more informative, no arbitrary boundaries |
| Waypoint routing | Sequential `pgr_trsp` calls | `pgr_trspVia` | Sequential reuses proven pattern, easier per-leg instructions |
| Waypoint routing | Sequential `pgr_trsp` calls | `pgr_dijkstraVia` | No turn restrictions -- worse route quality for driving |
| Alternative routes | `pgr_KSP` (K=3) | Multiple `pgr_trsp` with penalty | KSP is official, single call, mathematically optimal |
| Edge isochrone response | Raw `agg_cost` per edge | Pre-classified bands | Let frontend interpolate for smoother gradients |
| Waypoint API design | `via` query param | Separate `/route/via` endpoint | Single endpoint with optional `via` is simpler |
| Waypoint markers | Circle + label (existing pattern) | Custom SVG markers | Consistency with existing start/end markers |

## Integration with Existing Codebase

### SQL Function Additions (in `05_functions.sql`)

New functions needed:

1. **`getdrivingisochroneedges(lon, lat, intervals, use_traffic, hour, day_of_week)`** -- Edge-based driving isochrone
2. **`getbikingisochroneedges(lon, lat, intervals)`** -- Edge-based biking isochrone
3. **`getwalkingisochroneedges(lon, lat, intervals)`** -- Edge-based walking isochrone
4. **`getdrivingroutevia(lats, lons)`** -- Multi-stop driving route (wrapping sequential pgr_trsp calls)
5. **`getbikingroutevia(lats, lons, avoid_ferries)`** -- Multi-stop biking route
6. **`getwalkingroutevia(lats, lons, avoid_ferries)`** -- Multi-stop walking route

These follow the existing naming convention (`get{mode}{feature}`) and reuse the same CTE patterns for turn instructions.

### Python Service Layer

- `IsochroneService` -- Add edge-based methods alongside existing polygon methods
- `RoutingService` -- Add `get_driving_route_via()`, `get_biking_route_via()`, `get_walking_route_via()` methods

### Frontend State

- `IsochroneContext` -- Add `displayMode: "polygon" | "edges"` toggle
- `RoutingContext` -- Add `waypoints: GeoJSON.Point[]` array and `addWaypoint` / `removeWaypoint` / `reorderWaypoints` actions

## Performance Characteristics

| Operation | Expected Time | Scale | Notes |
|-----------|--------------|-------|-------|
| Edge-based isochrone (20 min drive) | 200-810ms | ~5000 edges | pgr_drivingDistance + JOIN |
| Edge-based isochrone (20 min walk) | 100-450ms | ~2000 edges | Smaller walkable subgraph |
| Waypoint route (3 stops, drive) | 300-600ms | 2 pgr_trsp calls | Linear in number of legs |
| Waypoint route (5 stops, drive) | 600-1200ms | 4 pgr_trsp calls | Linear in number of legs |
| `pgr_KSP` (K=3, drive) | 500-1500ms | 177k edges | Yen's algorithm, 3 iterations |
| MapLibre line render (5000 features) | <30ms | -- | WebGL line rendering |
| MapLibre marker render (5 waypoints) | <1ms | -- | Negligible |

## Installation

### Python Dependencies
```bash
# No new packages needed
```

### JavaScript Dependencies
```bash
# No new packages needed
```

### Database
```sql
-- No extensions to install
-- All functions (pgr_drivingDistance, pgr_trsp, pgr_dijkstraVia, pgr_KSP)
-- are included in pgrouting/pgrouting:17-3.5-3.8
```

## Verification Checklist

Before implementation:

- [ ] Run test `pgr_drivingDistance` with `JOIN edges` to confirm edge geometry retrieval works
- [ ] Verify `geom_4326` exists on `edges` table (confirmed -- used in existing route functions)
- [ ] Test `pgr_dijkstraVia` with ARRAY[node1, node2, node3] to confirm function availability
- [ ] Test MapLibre `line-color` with `["interpolate", ["linear"], ["get", "agg_cost"]]` expression
- [ ] Confirm response size for 20-min driving isochrone is acceptable (~300-500KB uncompressed)
- [ ] Benchmark sequential `pgr_trsp` calls for 3-5 waypoints vs single `pgr_trspVia`

## Sources

**HIGH Confidence (Official Documentation, verified for pgRouting 3.8):**
- [pgr_drivingDistance -- pgRouting 3.8 Manual](https://docs.pgrouting.org/3.8/en/pgr_drivingDistance.html) -- Returns `(seq, depth, start_vid, pred, node, edge, cost, agg_cost)`. Confirmed `edge` column for edge-based isochrones.
- [pgr_KSP -- pgRouting 3.8 Manual](https://docs.pgrouting.org/3.8/en/pgr_KSP.html) -- Official since 2.0.0. One-to-One signature with K, directed, heap_paths parameters.
- [MapLibre Style Spec -- Layers](https://maplibre.org/maplibre-style-spec/layers/) -- `line-color` supports data-driven styling since GL JS 0.23.0. `line-width` since 0.39.0.
- [MapLibre Style Spec -- Expressions](https://maplibre.org/maplibre-style-spec/expressions/) -- `interpolate` expression syntax for smooth color gradients.

**MEDIUM Confidence (Official docs, Proposed function status):**
- [pgr_dijkstraVia -- pgRouting 3.8 Manual](https://docs.pgrouting.org/3.8/en/pgr_dijkstraVia.html) -- Proposed. Signature: `(Edges SQL, via vertices, [directed, strict, U_turn_on_edge])`.
- [pgr_trspVia -- pgRouting 3.8 Manual](https://docs.pgrouting.org/3.8/en/pgr_trspVia.html) -- Proposed. Signature: `(Edges SQL, Restrictions SQL, via vertices, [directed, strict, U_turn_on_edge])`.
- [TRSP Family -- pgRouting 3.8](https://docs.pgrouting.org/3.8/en/TRSP-family.html) -- All TRSP functions are Proposed in 3.8. pgr_trsp itself is Proposed but proven stable in this project.

**LOW Confidence (Needs Runtime Verification):**
- `pgr_trspVia` reliability -- Same "Proposed" status as `pgr_trsp` which works fine, but pgr_trspVia hasn't been tested in this project yet.
- Edge-based isochrone response size -- Estimated 300-500KB for 20-min driving; actual size depends on NYC network density near origin.
- MapLibre rendering performance with 5000+ line features -- Expected to be fine based on WebGL capabilities, but should benchmark with actual data.

**NOT a valid source (open issue, unresolved):**
- [line-gradient data-driven styling -- maplibre/maplibre-gl-js#5037](https://github.com/maplibre/maplibre-gl-js/issues/5037) -- Confirms `line-gradient` does NOT support feature-property expressions. Use `line-color` instead.

---
*Stack research for: NYC Open Routing -- Edge-Based Isochrones & Waypoint Routing*
*Researched: 2026-02-14*
