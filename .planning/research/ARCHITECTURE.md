# Architecture: Isochrone/Reachability Visualization

**Domain:** Multi-modal routing app with pgRouting + PostGIS + React/MapLibre
**Researched:** 2026-02-13
**Confidence:** HIGH (verified against codebase, pgRouting 3.8 docs, PostGIS 3.5 capabilities)

## Executive Summary

Isochrone visualization answers "where can I reach from here within N minutes?" It integrates as a parallel feature to routing -- same database, same API patterns, same map rendering infrastructure, but a fundamentally different query shape. Routing finds a path between two points. Isochrones find all reachable nodes from one point, then generate a polygon boundary around them.

The architecture adds four components: a SQL function (`getisochrone`), an `IsochroneService` class, an `/api/isochrone` endpoint, and a frontend `useIsochroneLayer` rendering pipeline. Each maps directly onto existing patterns in the codebase. The critical technical decision is polygon generation: use `ST_ConcaveHull` on collected edge geometries (not `pgr_alphaShape`, which is deprecated in pgRouting 3.8).

## Recommended Architecture

### System Overview

```
User clicks map + selects time/mode
         |
         v
  [React Frontend]
  IsochroneContext       -- origin point, time bands, mode, polygon data
  useIsochroneFetch      -- API call (mirrors useRouteFetch)
  useGeoJsonLayer        -- fill layer rendering (existing hook, reused)
         |
         | GET /api/isochrone?origin={lon,lat}&mode=drive&times=5,10,15
         v
  [FastAPI API]
  /api/isochrone         -- new endpoint (mirrors /api/route)
  IsochroneService       -- new service (mirrors RoutingService)
  RouteCache             -- reuse existing cache (different mode keys)
         |
         | SELECT * FROM getisochrone(...)
         v
  [PostgreSQL + pgRouting + PostGIS]
  getisochrone()         -- new SQL function
    pgr_drivingDistance   -- node reachability (Dijkstra, no turn restrictions)
    ST_ConcaveHull        -- polygon from edge geometries
    ST_Transform          -- coordinate system conversion
```

### Component Boundaries

| Component | Responsibility | Communicates With | New/Existing |
|-----------|---------------|-------------------|-------------|
| `getisochrone()` SQL function | Run pgr_drivingDistance, join edges, generate polygons per time band | edges table, edges_vertices_pgr | **NEW** |
| `getnearestXXXnode()` SQL functions | Snap origin to nearest mode-accessible node | edges_vertices_pgr | Existing (reused) |
| `IsochroneService` | Parse params, call SQL, format GeoJSON, cache results | db_engine, RouteCache, geo utils | **NEW** |
| `/api/isochrone` endpoint | HTTP interface, param validation, DI | IsochroneService | **NEW** |
| `IsochroneContext` | Store origin, time bands, mode, polygon GeoJSON | React state | **NEW** |
| `useIsochroneFetch` | Fetch isochrone data from API | IsochroneContext, MessageContext | **NEW** |
| `useGeoJsonLayer` | Render GeoJSON polygons as MapLibre fill layer | MapLibre map instance | Existing (reused) |
| `MapLibreGLMap` | Add isochrone fill layer beneath route layers | useGeoJsonLayer, IsochroneContext | Existing (modified) |
| `IsochroneControls` | UI for origin selection, time/mode inputs | IsochroneContext | **NEW** |

## Data Flow

### Request Flow (Happy Path)

```
1. User action: Click map point (or enter address) + set mode + set time bands
                                    |
2. IsochroneContext updates:        |
   origin = {lon, lat}              |
   mode = "drive"                   |
   timeBands = [5, 10, 15]          |
                                    v
3. useIsochroneFetch triggers:
   GET /api/isochrone?origin=-73.985,40.748&mode=drive&times=5,10,15
                                    |
4. FastAPI endpoint:                |
   - Validates origin (NYC bounds)  |
   - Validates mode enum            |
   - Validates times (1-60 min)     |
   - Calls IsochroneService        |
                                    v
5. IsochroneService:
   a. Check cache (key: origin + mode + times)
   b. Parse coordinates (reuse parse_coordinates)
   c. Execute SQL:
      SELECT * FROM getisochrone(:lon, :lat, :mode, ARRAY[:times])
   d. Convert WKB polygons to GeoJSON (reuse dump_geo)
   e. Build response with color/opacity per band
   f. Cache result
                                    |
6. SQL function getisochrone():     |
   a. Snap to nearest node:        |
      getnearestdrivenode(lon, lat) |
   b. Find reachable nodes:        |
      pgr_drivingDistance(          |
        edges_sql,                  |
        start_node,                 |
        max(times) * 60,  -- seconds|
        directed := true            |
      )                             |
   c. For each time band:          |
      - Filter edges by agg_cost   |
      - Collect edge geometries    |
      - ST_ConcaveHull(ST_Collect(  |
          geom_4326), 0.7)          |
      - Return polygon + metadata  |
                                    v
7. Response (GeoJSON FeatureCollection):
   [
     { type: "Feature",
       properties: { time: 5, color: "#1a9850", opacity: 0.3 },
       geometry: { type: "Polygon", coordinates: [...] } },
     { type: "Feature",
       properties: { time: 10, color: "#fee08b", opacity: 0.25 },
       geometry: { type: "Polygon", coordinates: [...] } },
     { type: "Feature",
       properties: { time: 15, color: "#d73027", opacity: 0.2 },
       geometry: { type: "Polygon", coordinates: [...] } }
   ]
                                    |
8. Frontend rendering:             |
   useGeoJsonLayer(                 |
     map, "isochroneSource",       |
     "isochroneLayer",             |
     polygonFeatures,              |
     { type: "fill",               |
       paint: {                    |
         "fill-color": ["get","color"],
         "fill-opacity": ["get","opacity"]
       }                           |
     },                            |
     "routeHaloLayer"  -- beneath route
   )                               |
```

### Response Format

```typescript
// API response
interface IsochroneResponse {
  features: IsochroneFeature[]
  origin: { lon: number; lat: number }
  mode: string
}

interface IsochroneFeature {
  type: "Feature"
  properties: {
    time_minutes: number      // e.g., 5, 10, 15
    color: string             // hex color for this band
    opacity: number           // decreasing opacity for outer bands
    area_sq_miles: number     // computed area for display
    node_count: number        // reachable intersections (debugging/info)
  }
  geometry: {
    type: "Polygon" | "MultiPolygon"
    coordinates: number[][][]
  }
}
```

## Integration Points with Existing Code

### SQL Layer -- Reuse Patterns

**Reuse directly:**
- `getnearestdrivenode()`, `getnearestbikenode()`, `getnearestwalknode()` -- snap origin to network
- Edge table columns: `cost_drive`/`cost_bike`/`cost_walk`, `rcost_drive`/`rcost_bike`/`rcost_walk`, `driveable`/`bikeable`/`walkable` flags
- `geom_4326` cached column -- avoids ST_Transform per-row during polygon generation
- `edges_vertices_pgr` with `has_driveable`/`has_bikeable`/`has_walkable` flags

**Key difference from routing:**
- Routing uses `pgr_trsp` (turn-restricted shortest path between 2 nodes)
- Isochrones use `pgr_drivingDistance` (Dijkstra from 1 node, all reachable within cost)
- Isochrones do NOT need turn restrictions (pgr_drivingDistance doesn't support them, and the aggregate reachability result makes individual turn restrictions negligible)

**Proposed SQL function:**

```sql
CREATE OR REPLACE FUNCTION getisochrone(
  _lon FLOAT, _lat FLOAT,
  _mode TEXT,               -- 'drive', 'bike', 'walk'
  _time_bands FLOAT[]       -- minutes, e.g., ARRAY[5, 10, 15]
)
RETURNS TABLE(
  time_minutes FLOAT,
  node_count   INT,
  area_sq_ft   FLOAT,
  geom         GEOMETRY     -- polygon in WGS84 (4326)
) AS $func$
DECLARE
  start_node INT;
  max_cost FLOAT;
  edges_sql TEXT;
BEGIN
  -- 1. Snap to nearest mode-accessible node (reuse existing functions)
  start_node := CASE _mode
    WHEN 'drive' THEN getnearestdrivenode(_lon, _lat)
    WHEN 'bike'  THEN getnearestbikenode(_lon, _lat)
    WHEN 'walk'  THEN getnearestwalknode(_lon, _lat)
  END;

  IF start_node IS NULL THEN
    RAISE EXCEPTION 'Could not find % node near location', _mode;
  END IF;

  -- 2. Build mode-specific edges SQL (same pattern as routing functions)
  edges_sql := CASE _mode
    WHEN 'drive' THEN
      'SELECT id, source, target, cost_drive AS cost, rcost_drive AS reverse_cost
       FROM edges WHERE driveable = TRUE'
    WHEN 'bike' THEN
      'SELECT id, source, target, cost_bike AS cost, rcost_bike AS reverse_cost
       FROM edges WHERE bikeable = TRUE'
    WHEN 'walk' THEN
      'SELECT id, source, target, cost_walk AS cost, rcost_walk AS reverse_cost
       FROM edges WHERE walkable = TRUE'
  END;

  -- 3. Convert max time band from minutes to cost units (seconds)
  --    Cost columns in edges are in seconds (time = distance / speed)
  max_cost := (SELECT MAX(t) FROM UNNEST(_time_bands) AS t) * 60;

  -- 4. Single pgr_drivingDistance call, then filter per band
  RETURN QUERY
  WITH reachable AS (
    SELECT dd.node, dd.edge, dd.agg_cost
    FROM pgr_drivingDistance(edges_sql, start_node, max_cost, TRUE) dd
    WHERE dd.edge != -1  -- exclude start node placeholder
  ),
  reachable_edges AS (
    SELECT r.agg_cost, e.geom_4326
    FROM reachable r
    JOIN edges e ON r.edge = e.id
    WHERE e.geom_4326 IS NOT NULL
  )
  SELECT
    band.t AS time_minutes,
    COUNT(re.geom_4326)::INT AS node_count,
    ST_Area(
      ST_Transform(
        ST_ConcaveHull(ST_Collect(re.geom_4326), 0.7),
        2263  -- NYC State Plane for accurate area
      )
    ) AS area_sq_ft,
    ST_ConcaveHull(ST_Collect(re.geom_4326), 0.7) AS geom
  FROM UNNEST(_time_bands) AS band(t)
  LEFT JOIN reachable_edges re ON re.agg_cost <= band.t * 60
  GROUP BY band.t
  HAVING COUNT(re.geom_4326) >= 3  -- need 3+ edges for ConcaveHull
  ORDER BY band.t;
END;
$func$ LANGUAGE plpgsql;
```

**Why `ST_ConcaveHull` over `pgr_alphaShape`:**
- `pgr_alphaShape` is **deprecated in pgRouting 3.8** (the project's version) in favor of PostGIS alternatives
- `ST_ConcaveHull` works on edge geometries (lines), not just points, producing better polygon shapes
- PostGIS 3.5 with GEOS 3.9+ provides fast ST_ConcaveHull implementation
- The `target_percent` parameter (0.7) controls tightness: 1.0 = convex hull, 0.0 = tightest concave hull

### API Layer -- Reuse Patterns

**Reuse directly:**
- `parse_coordinates()` from `utils/geo.py` -- validates NYC bounds
- `dump_geo()` from `utils/geo.py` -- WKB hex to GeoJSON dict
- `RouteCache` from `utils/cache.py` -- cache with mode key `isochrone-drive-5-10-15`
- `get_db_engine()` from `dependencies.py` -- shared SQLAlchemy engine
- Pydantic response models pattern from `models/schemas.py`

**New service class follows RoutingService pattern:**

```python
# api/services/isochrone.py
class IsochroneService:
    def __init__(self, db_engine: Engine):
        self.engine = db_engine
        self.cache = get_route_cache()  # reuse same cache instance

    def get_isochrone(self, origin: str, mode: str,
                      time_bands: List[float]) -> IsochroneResponse:
        # 1. Check cache
        cache_key = f"isochrone-{mode}-{'-'.join(map(str, sorted(time_bands)))}"
        cached = self.cache.get(origin, origin, cache_key)
        if cached: return IsochroneResponse(features=cached, ...)

        # 2. Parse & validate
        lon, lat = parse_coordinates(origin)

        # 3. Execute SQL
        sql = text("SELECT * FROM getisochrone(:lon, :lat, :mode, :bands)")
        with self.engine.connect() as conn:
            result = conn.execute(sql, {...})
            rows = result.fetchall()

        # 4. Format response (dump_geo for each polygon)
        features = self._format_isochrone_response(rows, mode, time_bands)

        # 5. Cache and return
        self.cache.set(origin, origin, cache_key, features)
        return IsochroneResponse(features=features, ...)
```

**New endpoint follows /api/route pattern:**

```python
# api/routes/isochrone.py
@router.get("/isochrone", response_model=IsochroneResponse)
def get_isochrone(
    origin: str = Query(..., description="Origin coordinates (lon,lat)"),
    mode: TravelMode = Query(..., description="Travel mode"),
    times: str = Query("5,10,15", description="Comma-separated minutes"),
    isochrone_service: IsochroneService = Depends(get_isochrone_service)
):
    time_bands = [float(t) for t in times.split(",")]
    return isochrone_service.get_isochrone(origin, mode.value, time_bands)
```

**Dependency injection (add to dependencies.py):**

```python
_isochrone_service = IsochroneService(_db_engine)

def get_isochrone_service() -> IsochroneService:
    return _isochrone_service
```

### Frontend Layer -- Reuse Patterns

**Reuse directly:**
- `useGeoJsonLayer` hook -- already supports `type: "fill"` layers with data-driven paint
- `MapInstanceContext` -- access map instance for layer management
- `MessageContext` -- error/warning display
- `removeMapLayerAndSource` utility -- cleanup
- `IMapFeature` type -- generic GeoJSON feature interface

**New context follows RoutingContext pattern:**

The isochrone feature should NOT extend RoutingContext. It has different state (single origin vs origin+destination, time bands vs none, polygon output vs line output). A separate `IsochroneContext` keeps concerns cleanly separated.

```typescript
// contexts/IsochroneContext.tsx
interface IsochroneContextType {
  // State
  origin: IMapFeature | null
  timeBands: number[]         // default [5, 10, 15]
  mode: TravelMode
  isochrone: IsochroneData | null
  isActive: boolean           // toggle between route mode and isochrone mode

  // Setters
  setOrigin: (origin: IMapFeature | null) => void
  setTimeBands: (bands: number[]) => void
  setMode: (mode: TravelMode) => void
  setIsochrone: (data: IsochroneData | null) => void
  setIsActive: (active: boolean) => void
  clearIsochrone: () => void
}
```

**Map layer integration in MapLibreGLMap:**

```typescript
// MapLibreGLMap.tsx additions
const { isochrone, isActive } = useContext(IsochroneContext)

// Isochrone fill layer -- renders BENEATH everything else
useGeoJsonLayer(
  map,
  "isochroneSource",
  "isochroneLayer",
  isActive ? isochrone?.features || null : null,
  {
    type: "fill",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": ["get", "opacity"],
    },
  },
  "routeHaloLayer",  // place before (beneath) route halo
)

// Isochrone outline layer for crisp boundaries
useGeoJsonLayer(
  map,
  "isochroneOutlineSource",
  "isochroneOutlineLayer",
  isActive ? isochrone?.features || null : null,
  {
    type: "line",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 2,
      "line-opacity": 0.8,
    },
  },
  "routeHaloLayer",
)
```

**Layer Z-Order (bottom to top):**

```
Base map tiles
  isochroneLayer (fill, semi-transparent polygons)
  isochroneOutlineLayer (line, polygon boundaries)
  routeHaloLayer (line, route glow effect)
  routeLayer (line, main route)
  startPointLayer (circle, origin marker)
  endPointLayer (circle, destination marker)
  startPointLabelLayer (symbol, "A" label)
  endPointLabelLayer (symbol, "B" label)
```

## Patterns to Follow

### Pattern 1: Service Layer with Cache-First

Matches RoutingService exactly: check cache, parse input, execute SQL, format output, cache result.

```python
def get_isochrone(self, origin, mode, time_bands):
    cached = self.cache.get(origin, origin, cache_key)
    if cached: return cached
    # ... compute ...
    self.cache.set(origin, origin, cache_key, result)
    return result
```

### Pattern 2: SQL Function Encapsulation

All routing logic lives in SQL functions called via `text()` queries. The API never builds raw SQL. This pattern continues for isochrones.

```python
# Good: parameterized function call
sql = text("SELECT * FROM getisochrone(:lon, :lat, :mode, :bands)")

# Bad: building SQL strings in Python
sql = f"SELECT ... FROM pgr_drivingDistance(...)"
```

### Pattern 3: GeoJSON Response with dump_geo

WKB hex from PostgreSQL is converted to GeoJSON dict via `dump_geo()`. The frontend receives standard GeoJSON that MapLibre can render directly.

### Pattern 4: Context Separation

Routing and isochrone are different interaction modes. RoutingContext manages two addresses + a route. IsochroneContext manages one origin + time bands + polygons. They share TravelMode but are otherwise independent.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Extending RoutingContext for Isochrone State

**What:** Adding `isochroneOrigin`, `isochronePolygons`, `timeBands` to RoutingContext.
**Why bad:** RoutingContext already has 12 state values and 12 setters. Adding isochrone state creates a 20+ field context that re-renders everything when any isochrone state changes. The two features have different lifecycles (routing needs origin+destination, isochrone needs origin only).
**Instead:** Create a separate IsochroneContext. Components that need both (like MapLibreGLMap) consume both contexts.

### Anti-Pattern 2: Using pgr_alphaShape

**What:** Calling `pgr_alphaShape` to generate isochrone polygons.
**Why bad:** Deprecated in pgRouting 3.8 (the project's version). Will be removed in a future version. Only works on point clouds, not edge geometries.
**Instead:** Use `ST_ConcaveHull(ST_Collect(edge_geometries), 0.7)` from PostGIS.

### Anti-Pattern 3: Multiple pgr_drivingDistance Calls per Request

**What:** Calling `pgr_drivingDistance` once per time band (e.g., 3 calls for 5/10/15 min).
**Why bad:** pgr_drivingDistance with max cost already computes all shorter-cost nodes. Calling it 3 times triples query time for no benefit.
**Instead:** Single call with `max(time_bands) * 60` as cost limit, then filter results by `agg_cost` per band.

### Anti-Pattern 4: Computing Polygons in Python

**What:** Fetching raw node coordinates from pgr_drivingDistance, then using Shapely in Python to compute concave hulls.
**Why bad:** Transfers 10K-50K node geometries over the network. PostGIS computes ST_ConcaveHull orders of magnitude faster in-database where the geometry data already lives.
**Instead:** The SQL function returns finished polygons. Python only converts WKB to GeoJSON.

### Anti-Pattern 5: Isochrone as Route Overlay

**What:** Rendering isochrone polygons in the same GeoJSON source as route lines.
**Why bad:** Fill layers and line layers have different rendering pipelines. Mixing polygon and line features in one source causes MapLibre to attempt rendering lines as fills (invisible) or polygons as lines (just outlines). Also prevents independent show/hide toggling.
**Instead:** Separate source and layer IDs for isochrone (`isochroneSource`/`isochroneLayer`) and route (`routeSource`/`routeLayer`).

## Scalability Considerations

| Concern | Small isochrone (5 min) | Medium (15 min) | Large (30 min) |
|---------|------------------------|-----------------|----------------|
| pgr_drivingDistance nodes | ~500-2,000 | ~5,000-15,000 | ~20,000-50,000 |
| Edge geometries collected | ~500-2,000 | ~5,000-15,000 | ~20,000-50,000 |
| ST_ConcaveHull time | <100ms | 200-500ms | 500ms-2s |
| Total query time | <500ms | 1-3s | 3-8s |
| GeoJSON response size | ~5-20 KB | ~20-80 KB | ~80-300 KB |
| MapLibre render time | Instant | Instant | <100ms |

**Performance mitigations:**
- Cache results aggressively (5-minute TTL matches route cache)
- Limit max time band to 30 minutes (NYC network gets huge beyond that)
- Use `geom_4326` cached column to avoid per-row ST_Transform
- ST_ConcaveHull `target_percent` of 0.7 balances quality vs speed (lower = tighter but slower)
- Consider `ST_SimplifyPreserveTopology` on output polygon for very large isochrones to reduce GeoJSON size

**For 30+ minute isochrones (if needed later):**
- Pre-aggregate edge geometries using `ST_SnapToGrid` before ST_ConcaveHull
- Or use `ST_ConvexHull` for the outermost band (fast, acceptable quality at large scales)
- Or implement server-side polygon simplification before JSON serialization

## Suggested Build Order

Build order follows the data flow from database to frontend, ensuring each layer can be tested independently.

### Phase 1: SQL Function (Foundation)

**Build:** `getisochrone()` in `05_functions.sql`

**Why first:** Everything depends on this. Can be tested directly in psql without any API or frontend changes. Validates that pgr_drivingDistance works with the existing edge table and cost columns, and that ST_ConcaveHull produces reasonable polygons.

**Test:** Run directly in database container:
```sql
SELECT time_minutes, node_count, ST_AsText(geom)
FROM getisochrone(-73.985, 40.748, 'drive', ARRAY[5, 10, 15]);
```

**Dependencies:** None (uses existing edge table and node functions)

### Phase 2: API Endpoint

**Build:** `IsochroneService`, `IsochroneResponse` schema, `/api/isochrone` endpoint, dependency injection

**Why second:** Wraps the SQL function in the service layer pattern. Can be tested via Swagger UI / curl without any frontend changes. Validates WKB-to-GeoJSON conversion, caching, and error handling.

**Test:** `curl "http://localhost:5001/api/isochrone?origin=-73.985,40.748&mode=drive&times=5,10,15"`

**Dependencies:** Phase 1 (SQL function must exist)

**Reuses:**
- `parse_coordinates()` for input validation
- `dump_geo()` for WKB conversion
- `RouteCache` for caching
- `get_db_engine()` for database access
- Pydantic model patterns from `schemas.py`

### Phase 3: Frontend Rendering

**Build:** `IsochroneContext`, `useIsochroneFetch`, isochrone fill/outline layers in MapLibreGLMap

**Why third:** With the API working, focus on rendering polygons on the map. Start with hardcoded test data or a simple button that triggers the fetch. The existing `useGeoJsonLayer` hook handles all MapLibre layer management.

**Dependencies:** Phase 2 (API endpoint must be serving GeoJSON)

**Reuses:**
- `useGeoJsonLayer` for fill and line layers
- `MapInstanceContext` for map access
- `MessageContext` for error display

### Phase 4: UI Controls

**Build:** `IsochroneControls` component (origin picker, time band selector, mode selector, active toggle)

**Why last:** The most subjective part. Everything else works without it -- you can trigger isochrones from the browser console or a test button. Building controls last lets you iterate on UX without touching the data pipeline.

**Dependencies:** Phase 3 (rendering must work to validate controls)

### Phase Dependency Graph

```
Phase 1: SQL Function
    |
    v
Phase 2: API Endpoint
    |
    v
Phase 3: Frontend Rendering
    |
    v
Phase 4: UI Controls
```

Linear dependency chain -- each phase requires the previous. No parallelization opportunity within the isochrone feature itself, but each phase can be completed and merged independently.

## File Inventory (New and Modified)

| File | Action | Purpose |
|------|--------|---------|
| `data-importer/src/sql/05_functions.sql` | Modify | Add `getisochrone()` function |
| `api/services/isochrone.py` | Create | IsochroneService class |
| `api/models/schemas.py` | Modify | Add IsochroneResponse, IsochroneFeature models |
| `api/routes/isochrone.py` | Create | `/api/isochrone` endpoint |
| `api/dependencies.py` | Modify | Add `get_isochrone_service()` |
| `api/main.py` | Modify | Register isochrone router |
| `client/src/contexts/IsochroneContext.tsx` | Create | Isochrone state management |
| `client/src/hooks/useIsochroneFetch.ts` | Create | API fetch hook |
| `client/src/types/interfaces.ts` | Modify | Add IsochroneData, IsochroneFeature types |
| `client/src/components/MapLibreGLMap.tsx` | Modify | Add isochrone fill/outline layers |
| `client/src/components/controls/IsochroneControls.tsx` | Create | UI for isochrone parameters |
| `client/src/App.tsx` | Modify | Add IsochroneContextProvider |

## Sources

- [pgr_drivingDistance documentation (pgRouting 3.8)](https://docs.pgrouting.org/latest/en/pgr_drivingDistance.html) -- HIGH confidence
- [pgr_alphaShape deprecation in 3.8 (GitHub issue #2749)](https://github.com/pgRouting/pgrouting/issues/2749) -- HIGH confidence
- [pgRouting Docker image tags](https://github.com/pgRouting/docker-pgrouting) -- confirms project uses pgRouting 3.8 with PostGIS 3.5 -- HIGH confidence
- [PostGIS ST_ConcaveHull documentation](https://postgis.net/docs/ST_ConcaveHull.html) -- HIGH confidence
- [MapLibre fill layer specification](https://maplibre.org/maplibre-style-spec/layers/) -- HIGH confidence
- [Stadia Maps isochrone tutorial for MapLibre GL JS](https://docs.stadiamaps.com/tutorials/display-isochrones-on-a-map/) -- MEDIUM confidence (external API approach, but rendering pattern is applicable)
- [pgRouting isochrone alpha shape example (GitHub gist)](https://gist.github.com/audiojack/e5abd3a2f5451fdaff57310ea5734dd1) -- MEDIUM confidence (older pattern, but workflow structure applies)
- Direct codebase examination of all integration points -- HIGH confidence
