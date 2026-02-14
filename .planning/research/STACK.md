# Technology Stack: Isochrone Visualization

**Project:** NYC Open Routing -- Isochrone/Reachability Feature
**Researched:** 2026-02-13
**Confidence:** HIGH (database layer), MEDIUM (GEOS version), HIGH (frontend layer)
**Mode:** Subsequent milestone -- minimal new dependencies, leveraging existing stack

## Executive Summary

Isochrone visualization requires **zero new npm packages** and **zero new Python packages**. The entire feature is built on capabilities already present in the existing stack: pgRouting's `pgr_drivingDistance` for reachability computation, PostGIS's `ST_ConcaveHull` for polygon generation, the existing Shapely/Pydantic pipeline for GeoJSON serialization, and MapLibre GL's `fill` layer type for polygon rendering. The only uncertainty is whether the Docker image's GEOS version supports the fast native `ST_ConcaveHull` implementation -- this must be verified at development time and has a clear upgrade path if needed.

## Recommended Stack Additions

### Database Layer: pgRouting + PostGIS (No Changes to Docker Image)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| `pgr_drivingDistance` | pgRouting 3.8 (installed) | Compute all reachable nodes within time threshold | HIGH |
| `ST_ConcaveHull` | PostGIS 3.5 (installed) | Generate polygon boundaries from reachable node point clouds | MEDIUM |
| `ST_Collect` | PostGIS 3.5 (installed) | Aggregate node geometries into multipoint for hull input | HIGH |
| `ST_Transform` / `geom_4326` | PostGIS 3.5 (installed) | Coordinate system handling (SRID 2263 -> 4326 for GeoJSON) | HIGH |

#### pgr_drivingDistance -- How It Works

`pgr_drivingDistance` implements Dijkstra's algorithm to find all graph nodes reachable within a specified cost threshold from a source node. It returns a spanning tree of reachable nodes with their accumulated costs.

**Function signature (pgRouting 3.8):**
```sql
pgr_drivingDistance(
    'SELECT id, source, target, cost, reverse_cost FROM edges',  -- Edges SQL
    start_vid,    -- Source node (BIGINT)
    distance,     -- Maximum cost threshold (FLOAT)
    directed      -- BOOLEAN, default TRUE
)
-- Returns: (seq, depth, start_vid, pred, node, edge, cost, agg_cost)
```

**Key return columns for isochrone use:**
- `node` -- Reachable vertex ID (join to `edges_vertices_pgr` for geometry)
- `agg_cost` -- Accumulated cost from source (used to assign time bands)

**Integration with existing edge costs:**
The function accepts arbitrary cost SQL. This project's edges table already has mode-specific cost columns (`cost_drive`, `cost_bike`, `cost_walk`) and their reverse counterparts. The `distance` parameter uses cost units, which in this project are **minutes** (the `time_drive`, `time_bike`, `time_walk` columns are pre-computed travel times).

**Edges SQL per mode:**
```sql
-- Drive (uses existing cost columns, filtered by driveable flag)
'SELECT id, source, target, cost_drive AS cost, rcost_drive AS reverse_cost FROM edges WHERE driveable=TRUE'

-- Bike
'SELECT id, source, target, cost_bike AS cost, rcost_bike AS reverse_cost FROM edges WHERE bikeable=TRUE'

-- Walk (undirected -- set directed=FALSE)
'SELECT id, source, target, cost_walk AS cost, rcost_walk AS reverse_cost FROM edges WHERE walkable=TRUE'
```

**Traffic-aware isochrones (drive mode):** Apply the same traffic factor multiplication used in `getdrivingroute_with_traffic()`:
```sql
'SELECT id, source, target,
    cost_drive * COALESCE(traffic_factor, 1.0) AS cost,
    rcost_drive * COALESCE(traffic_factor, 1.0) AS reverse_cost
FROM edges WHERE driveable=TRUE'
```

**Version compatibility:** `pgr_drivingDistance` has been stable since pgRouting 2.0.0. The v3.6.0 update standardized output columns (adding `depth` and `start_vid`), which is the format in pgRouting 3.8. No compatibility concerns.

#### ST_ConcaveHull -- Polygon Generation

**Function signature:**
```sql
ST_ConcaveHull(
    param_geom GEOMETRY,       -- Input point collection
    param_pctconvex FLOAT,     -- 0.0 (most concave) to 1.0 (convex hull)
    param_allow_holes BOOLEAN  -- Default FALSE
)
-- Returns: GEOMETRY (Polygon)
```

**The pctconvex parameter** controls how tightly the hull wraps around the point cloud. It determines a length threshold as a fraction of the difference between the longest and shortest edges in the Delaunay Triangulation. Triangulation edges longer than this threshold are removed.

**Recommended values for street network isochrones:**
- `0.7` -- Good starting point. Produces a natural-looking boundary that follows the general shape of the reachable area without excessive concavity that could create artifacts at network edges
- `0.5` -- Tighter fit. Better for walking/biking isochrones where reachable areas are smaller and more irregular
- `0.3` -- Very tight. May produce spiky shapes with sparse point distributions; avoid unless the point cloud is dense

**Why NOT `0.99`:** Values close to 1.0 produce near-convex hulls that include large unreachable areas (water, parks, highways). Values close to 0.0 can produce very jagged boundaries or even degenerate geometries with sparse points.

**CRITICAL: GEOS Version Dependency**

PostGIS 3.3.0 enhanced `ST_ConcaveHull` with a native GEOS implementation, but **only when compiled with GEOS 3.11 or later**. With older GEOS versions, it falls back to the legacy PL/pgSQL implementation which is slower but functional.

The project's Docker image (`pgrouting/pgrouting:17-3.5-3.8`) is based on `postgis/postgis:17-3.5`, which likely ships with **GEOS 3.9.0** (based on the pgRouting Docker README showing GEOS 3.9.0 for the 17-3.5-3.7 example). This means the fast native implementation may NOT be available.

**Impact assessment:**
- For isochrone generation, we run `ST_ConcaveHull` on 4 point clouds (one per time band) with ~1,000-5,000 points each
- The legacy PL/pgSQL implementation handles this scale adequately (estimated 100-500ms per hull)
- Total isochrone query time with legacy implementation: ~1-3 seconds (acceptable for POC)
- The native GEOS 3.11+ implementation would reduce this to ~50-200ms total

**Verification step (must run during development):**
```sql
-- Check GEOS version in the running container
SELECT postgis_geos_compiled_version();
-- If >= 3.11.0: native fast implementation is available
-- If < 3.11.0: legacy implementation, still functional
```

**Upgrade path if performance is insufficient:**
Change Docker image from `pgrouting/pgrouting:17-3.5-3.8` to `pgrouting/pgrouting:17-3.6-3.8` (PostGIS 3.6 with Bookworm = GEOS 3.11+). This is a drop-in replacement with no SQL changes needed.

#### Complete Isochrone SQL Pattern

Single query producing all 4 time bands as polygons:

```sql
-- SQL function: getdrivingisochrone(lon, lat, max_minutes)
WITH reachable_nodes AS (
    SELECT
        dd.node,
        dd.agg_cost,
        v.geom  -- Vertex geometry in SRID 2263
    FROM pgr_drivingDistance(
        'SELECT id, source, target, cost_drive AS cost, rcost_drive AS reverse_cost
         FROM edges WHERE driveable=TRUE',
        getnearestdrivenode(:lon, :lat),
        :max_minutes,  -- e.g., 20.0 for 20-minute maximum
        TRUE           -- directed graph
    ) AS dd
    JOIN edges_vertices_pgr v ON dd.node = v.id
),
time_bands AS (
    SELECT
        band,
        ST_ConcaveHull(
            ST_Collect(rn.geom),
            0.7,    -- pctconvex (tunable)
            FALSE   -- no holes
        ) AS geom
    FROM reachable_nodes rn
    CROSS JOIN unnest(ARRAY[5, 10, 15, 20]) AS band
    WHERE rn.agg_cost <= band
    GROUP BY band
    HAVING COUNT(*) >= 3  -- Need at least 3 points for a polygon
)
SELECT
    band AS time_minutes,
    ST_AsGeoJSON(ST_Transform(geom, 4326))::json AS geojson
FROM time_bands
ORDER BY band DESC;  -- Largest first (for correct rendering order)
```

**Key design decisions in this SQL:**
1. **Single `pgr_drivingDistance` call** with the maximum time (20 min). Filter nodes per band with `WHERE agg_cost <= band`. This avoids 4 separate Dijkstra runs.
2. **`CROSS JOIN unnest`** generates bands from a single query result.
3. **`ORDER BY band DESC`** returns largest polygon first -- MapLibre renders features in array order, so largest must come first to appear beneath smaller bands.
4. **`HAVING COUNT(*) >= 3`** prevents degenerate geometries when too few nodes are reachable.
5. **Traffic-aware variant** uses the same traffic factor SQL from `getdrivingroute_with_traffic()`.

### API Layer: FastAPI (No New Dependencies)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| FastAPI | 0.115.12 (installed) | New `/api/isochrone` endpoint | HIGH |
| Pydantic | 2.11.1 (installed) | `IsochroneResponse` model | HIGH |
| Shapely | 2.0.7 (installed) | WKB-to-GeoJSON conversion (existing `dump_geo()`) | HIGH |
| SQLAlchemy | 2.0.40 (installed) | Database query execution (existing pattern) | HIGH |

**Why NOT geojson-pydantic:** The existing project defines its own lightweight `Feature` model with `geometry: Dict[str, Any]`. Adding `geojson-pydantic` (v2.1.0) would introduce a dependency for a single new endpoint when the existing pattern works. The project's `dump_geo()` function already handles WKB -> GeoJSON dict conversion via Shapely. Keep the existing pattern for consistency.

**New Pydantic models (extend existing `schemas.py`):**

```python
class IsochroneProperties(BaseModel):
    """Properties of an isochrone time band polygon."""
    time_minutes: int        # Time band value (5, 10, 15, 20)
    mode: TravelMode         # Travel mode used
    color: str               # Hex color for this band
    opacity: float           # Opacity value (0.0-1.0)

class IsochroneFeature(BaseModel):
    """GeoJSON Feature for an isochrone polygon."""
    type: Literal["Feature"] = "Feature"
    properties: IsochroneProperties
    geometry: Dict[str, Any]  # Polygon GeoJSON

class IsochroneResponse(BaseModel):
    """Response model for the isochrone endpoint."""
    features: List[IsochroneFeature]
    origin: Dict[str, Any]    # Origin point GeoJSON (for marker)
```

**API endpoint pattern:**

```python
@router.get("/isochrone", response_model=IsochroneResponse)
def get_isochrone(
    origin: str = Query(..., description="Origin (longitude,latitude)"),
    mode: TravelMode = Query(..., description="Travel mode: drive, bike, or walk"),
    max_time: int = Query(default=20, ge=5, le=30, description="Max time in minutes"),
    use_traffic: bool = Query(default=True, description="Use traffic factors (drive only)"),
):
    ...
```

**Color assignment per band** should happen server-side (embedded in feature properties) so the frontend can use `["get", "color"]` expressions without band-specific logic:

```python
ISOCHRONE_COLORS = {
    5:  {"color": "#1a9641", "opacity": 0.35},  # Green -- closest
    10: {"color": "#a6d96a", "opacity": 0.30},  # Light green
    15: {"color": "#fdae61", "opacity": 0.25},  # Orange
    20: {"color": "#d7191c", "opacity": 0.20},  # Red -- farthest
}
```

### Frontend Layer: MapLibre GL (No New Dependencies)

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| MapLibre GL JS | 5.3.0 (installed) | `fill` layer for polygon rendering | HIGH |
| React | 18.2.x (installed) | State management via existing Context API | HIGH |
| MUI | 7.0.1 (installed) | UI controls (slider, toggle) | HIGH |

#### MapLibre Fill Layer Configuration

Use a single GeoJSON source with a FeatureCollection containing all time band polygons. The `fill` layer type with data-driven styling renders them correctly:

```typescript
// Single source with all isochrone polygons
useGeoJsonLayer(
  map,
  "isochroneSource",
  "isochroneLayer",
  isochrone?.features || null,
  {
    type: "fill",
    paint: {
      "fill-color": ["get", "color"],        // Per-feature color from properties
      "fill-opacity": ["get", "opacity"],     // Per-feature opacity from properties
      "fill-outline-color": ["get", "color"], // Outline matches fill color
    },
  },
  "routeHaloLayer",  // Render beneath route layers
)
```

**Why a single layer with data-driven styling (not 4 separate layers):**
1. The existing `useGeoJsonLayer` hook already handles FeatureCollection sources with multiple features
2. One source/layer pair is simpler to manage (add/remove/update) than 4 pairs
3. Data-driven `fill-color` and `fill-opacity` via `["get", "property"]` expressions are well-supported since MapLibre Style Spec v0.19.0
4. Feature ordering within the FeatureCollection controls rendering order -- no z-index management needed

**Rendering order for concentric polygons:**
The API returns features ordered largest-first (20 min, then 15, 10, 5). MapLibre renders features in array order within a single layer, so the largest polygon renders first (bottom) and the smallest renders last (top). This produces the correct visual stacking without multiple layers.

**Optional: Outline layer for band boundaries:**
```typescript
useGeoJsonLayer(
  map,
  "isochroneOutlineSource",
  "isochroneOutlineLayer",
  isochrone?.features || null,
  {
    type: "line",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 1.5,
      "line-opacity": 0.6,
    },
  },
  "isochroneLayer",  // On top of fill layer
)
```

#### Layer Z-Ordering

Isochrone layers should render **beneath** all route and marker layers:

```
Bottom (map tiles)
  -> isochroneLayer (fill)
  -> isochroneOutlineLayer (line, optional)
  -> routeHaloLayer (existing)
  -> routeLayer (existing)
  -> startPointLayer (existing)
  -> endPointLayer (existing)
  -> label layers (existing)
Top
```

The existing `useGeoJsonLayer` hook supports a `beforeId` parameter for layer ordering. Place isochrone layers before `routeHaloLayer` to ensure correct stacking.

## What NOT to Use (and Why)

| Technology | Why Not |
|------------|---------|
| `pgr_alphaShape` | **Deprecated in pgRouting 3.8.** Officially removed. Use PostGIS ST_ConcaveHull instead. |
| `ST_AlphaShape` / `CG_AlphaShape` | Requires SFCGAL extension, which is not installed in the `pgrouting/pgrouting` Docker image. Would require custom Docker image or extension installation. |
| `pgr_pointsAsPolygon` | Legacy wrapper around pgr_alphaShape. Also deprecated. |
| `ST_ConvexHull` | Produces convex boundaries that include large unreachable areas (water bodies, parks). Visually misleading for urban isochrones. |
| `fill-extrusion` layer type | 3D polygon extrusion is unnecessary for 2D isochrone visualization. Opacity is per-layer (not per-feature), preventing band-specific transparency. Adds visual complexity without value. |
| `geojson-pydantic` library | Project already has a working GeoJSON model pattern. Adding a dependency for one endpoint introduces unnecessary coupling. |
| `turf.js` (client-side) | All polygon generation happens server-side in PostGIS. No need for client-side geometry processing. |
| Multiple pgr_drivingDistance calls | A single call with max_time=20 + client-side band filtering is 4x more efficient than 4 separate Dijkstra computations. |
| Voronoi/Delaunay client-side | All spatial computation belongs in PostGIS where it can leverage spatial indexes and the GEOS library. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Polygon generation | `ST_ConcaveHull` | `ST_AlphaShape` | Requires SFCGAL (not installed). ST_ConcaveHull uses GEOS (always available). |
| Polygon generation | `ST_ConcaveHull` | `pgr_alphaShape` | Deprecated in pgRouting 3.8. Will be removed in future versions. |
| Polygon tightness | `pctconvex=0.7` | `pctconvex=0.3` | Too tight for sparse outer bands -- produces spiky/degenerate polygons. 0.7 balances shape fidelity with visual quality. |
| API response | Custom Pydantic models | `geojson-pydantic` library | Adds dependency for 1 endpoint. Existing pattern works. |
| Frontend rendering | Single fill layer + expressions | 4 separate fill layers | More layer management code. `useGeoJsonLayer` already handles FeatureCollections. Data-driven styling is simpler. |
| Docker image | Keep `17-3.5-3.8` | Upgrade to `17-3.6-3.8` | Only upgrade if GEOS version causes performance issues. Verify first with `postgis_geos_compiled_version()`. |
| Time bands | Fixed [5, 10, 15, 20] | User-configurable | Adds UI complexity for marginal value. Fixed bands match industry standard (Google Maps, Mapbox). |

## Performance Characteristics

| Operation | Expected Time | Network Size | Notes |
|-----------|--------------|-------------|-------|
| `pgr_drivingDistance` (20 min drive) | 200-800ms | 177k edges | Dijkstra on full driveable subgraph (~120k edges) |
| `pgr_drivingDistance` (20 min walk) | 100-400ms | 177k edges | Smaller walkable subgraph, lower max cost |
| `ST_ConcaveHull` per band (legacy GEOS) | 100-500ms | 1-5k points | With GEOS < 3.11, PL/pgSQL fallback |
| `ST_ConcaveHull` per band (native GEOS) | 10-50ms | 1-5k points | With GEOS >= 3.11, native C implementation |
| Total isochrone query (legacy) | 1-3s | -- | Acceptable for POC |
| Total isochrone query (native) | 300-900ms | -- | Optimal |
| MapLibre fill layer render | <16ms | 4 polygons | Negligible -- WebGL polygon rendering is instant for 4 features |

## Installation

### Python Dependencies
```bash
# No new packages needed
# All isochrone functionality uses existing dependencies:
# - sqlalchemy (database queries)
# - shapely (WKB -> GeoJSON)
# - pydantic (response models)
# - fastapi (endpoint)
```

### JavaScript Dependencies
```bash
# No new packages needed
# MapLibre GL 5.3.0 already supports fill layers with data-driven styling
```

### Database
```sql
-- No extensions to install
-- pgRouting 3.8 includes pgr_drivingDistance
-- PostGIS 3.5 includes ST_ConcaveHull, ST_Collect, ST_Transform
-- All already available in pgrouting/pgrouting:17-3.5-3.8

-- Verify GEOS version (run during development):
SELECT postgis_geos_compiled_version();
```

## Verification Checklist

Before implementation, verify these assumptions:

- [ ] Run `SELECT postgis_geos_compiled_version();` in the DB container to confirm GEOS version
- [ ] Run a test `pgr_drivingDistance` query to confirm function availability and performance
- [ ] Run a test `ST_ConcaveHull` on a sample point set to confirm it produces valid polygons
- [ ] Verify `geom_4326` cached WGS84 geometries exist on `edges_vertices_pgr` (may need to add -- currently only on `edges` table)
- [ ] Test MapLibre `fill` layer with `["get", "color"]` expression on a sample FeatureCollection

## Sources

**HIGH Confidence (Official Documentation):**
- [pgr_drivingDistance -- pgRouting Manual 3.8](https://docs.pgrouting.org/latest/en/pgr_drivingDistance.html) -- Function signature, parameters, return columns, version history
- [ST_ConcaveHull -- PostGIS Documentation](https://postgis.net/docs/ST_ConcaveHull.html) -- Function signature, pctconvex parameter, GEOS 3.11+ enhancement note
- [MapLibre GL JS Style Spec -- Layers](https://maplibre.org/maplibre-style-spec/layers/) -- Fill layer paint properties, data-driven styling support
- [pgr_alphaShape Deprecation -- pgRouting Issue #2749](https://github.com/pgRouting/pgrouting/issues/2749) -- Deprecated in 3.8, replaced by PostGIS ST_ConcaveHull

**MEDIUM Confidence (Verified with Multiple Sources):**
- [pgRouting Docker Repository](https://github.com/pgRouting/docker-pgrouting) -- Tag naming convention, PostGIS 3.5 with GEOS 3.9.0 (from README example output)
- [PostGIS 3.5.0 Release](https://postgis.net/2024/09/PostGIS-3.5.0/) -- Minimum GEOS 3.8, recommended GEOS 3.12+
- [Stadia Maps Isochrone Tutorial](https://docs.stadiamaps.com/tutorials/display-isochrones-on-a-map/) -- MapLibre fill layer with data-driven color/opacity from feature properties
- [MapLibre Isochrone Example -- Maptoolkit](https://www.maptoolkit.com/doc/routing/isochrone-example-maplibre/) -- Fill + line layer pattern for isochrone visualization
- [pgr_drivingDistance Performance Issue #882](https://github.com/pgRouting/pgrouting/issues/882) -- Array-of-vertices can crash; single-vertex calls are safe

**LOW Confidence (Needs Runtime Verification):**
- GEOS version in `pgrouting/pgrouting:17-3.5-3.8` -- Inferred as 3.9.0 from similar tag example; must verify with `postgis_geos_compiled_version()`
- ST_ConcaveHull performance with legacy GEOS -- Estimated from general PostGIS benchmarks; must benchmark with actual data

---
*Stack research for: NYC Open Routing -- Isochrone Visualization*
*Researched: 2026-02-13*
