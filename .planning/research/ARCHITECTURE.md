# Architecture: Edge-Based Isochrones & Waypoint Routing

**Domain:** Multi-modal routing app with pgRouting + PostGIS + React/MapLibre
**Researched:** 2026-02-14
**Confidence:** HIGH (verified against codebase, pgRouting 3.8 docs, PostGIS 3.5 capabilities)

## Executive Summary

This document covers two features that integrate with the existing NYC Open Routing architecture: **edge-based isochrones** (upgrading the existing node-based approach to use edge geometries for more accurate polygons) and **waypoint/via-point routing** (allowing intermediate stops between origin and destination).

Edge-based isochrones replace the current approach of collecting node points and running `ST_ConcaveHull` on them. Instead, the reachable edges themselves are collected as line geometries, with partial edges clipped at the cost boundary using `ST_LineSubstring`. This produces tighter, more accurate polygons that follow the actual street network rather than having jagged gaps between sparse nodes.

Waypoint routing extends the existing A-to-B routing to support A-to-B-to-C-to-... with intermediate stops. pgRouting 3.8 provides `pgr_trspVia` (proposed status) which accepts an ordered array of vertex IDs and returns sequenced path legs with turn restriction support -- matching the project's existing use of `pgr_trsp`. The API changes from accepting `orig`/`dest` string pairs to accepting an ordered array of waypoints, and the frontend extends `RoutingContext` to manage a list of waypoints instead of a start/end pair.

These features are independent of each other and can be built in parallel, but waypoint routing has broader architectural impact (touching context, sidebar, URL state sync, and the route response format).

## Recommended Architecture

### System Overview

```
EDGE-BASED ISOCHRONES (upgrade to existing isochrone pipeline)
=============================================================

Same data flow as current isochrone, with SQL-layer changes:

  [PostgreSQL]
  getdrivingisochrone()  -- MODIFY: collect edge geometries + partial edge clipping
    pgr_drivingDistance   -- unchanged (returns reachable nodes + edges)
    ST_LineSubstring      -- NEW: clip edges at cost boundary
    ST_ConcaveHull        -- unchanged (but fed edge lines, not node points)

  [API]   -- No changes needed (same response shape)
  [Frontend] -- No changes needed (same GeoJSON polygons)


WAYPOINT ROUTING (new multi-stop capability)
============================================

  [React Frontend]
  RoutingContext          -- MODIFY: waypoints[] replaces startAddress/endAddress
  useRouteFetch           -- MODIFY: send waypoints array
  Sidebar                 -- MODIFY: dynamic waypoint inputs
  RouteList               -- MODIFY: show per-leg summaries
  MapLibreGLMap           -- MODIFY: waypoint markers (A, B, C, ...)
  useRouteStateSync       -- MODIFY: URL format for N waypoints
         |
         | POST /api/route  (new endpoint, existing GET remains for 2-point)
         v
  [FastAPI API]
  /api/route (POST)       -- NEW endpoint accepting waypoints array
  RoutingService          -- MODIFY: add multi-waypoint method
         |
         | SELECT * FROM getdrivingroute_via(...)
         v
  [PostgreSQL]
  getdrivingroute_via()   -- NEW: uses pgr_trspVia
  getbikingroute_via()    -- NEW: uses pgr_dijkstraVia (or pgr_trspVia)
  getwalkingroute_via()   -- NEW: uses pgr_dijkstraVia
```

### Component Boundaries

#### Edge-Based Isochrones

| Component | Responsibility | Action | Files |
|-----------|---------------|--------|-------|
| `getdrivingisochrone()` | Collect edge geometries, clip partial edges, generate polygons | **MODIFY** | `05_functions.sql` |
| `getbikingisochrone()` | Same edge-based approach for biking | **MODIFY** | `05_functions.sql` |
| `getwalkingisochrone()` | Same edge-based approach for walking | **MODIFY** | `05_functions.sql` |
| `IsochroneService` | No changes (same response shape) | Unchanged | `api/services/isochrone.py` |
| `IsochroneContext` | No changes | Unchanged | `client/src/contexts/IsochroneContext.tsx` |
| Frontend layers | No changes | Unchanged | `MapLibreGLMap.tsx` |

#### Waypoint Routing

| Component | Responsibility | Action | Files |
|-----------|---------------|--------|-------|
| `getdrivingroute_via()` | Multi-stop routing with turn restrictions | **NEW** | `05_functions.sql` |
| `getbikingroute_via()` | Multi-stop biking route | **NEW** | `05_functions.sql` |
| `getwalkingroute_via()` | Multi-stop walking route | **NEW** | `05_functions.sql` |
| `getdrivingroute_via_with_traffic()` | Multi-stop with traffic | **NEW** | `05_functions.sql` |
| `RoutingService` | Add `get_via_route()` method | **MODIFY** | `api/services/routing.py` |
| Route schemas | Add `WaypointRouteRequest`, `LegResponse` | **MODIFY** | `api/models/schemas.py` |
| `/api/route` (POST) | Accept waypoints array body | **NEW** endpoint | `api/routes/routing.py` |
| `RoutingContext` | `waypoints[]` replaces `startAddress`/`endAddress` | **MODIFY** | `client/src/contexts/RoutingContext.tsx` |
| `useRouteFetch` | POST with waypoints body | **MODIFY** | `client/src/hooks/useRouteFetch.ts` |
| `useRouteStateSync` | URL format for N waypoints | **MODIFY** | `client/src/hooks/useRouteStateSync.ts` |
| `Sidebar` | Dynamic waypoint input list | **MODIFY** | `client/src/components/Sidebar.tsx` |
| `Search` | Support waypoint index identity | **MODIFY** | `client/src/components/controls/Search.tsx` |
| `RouteList` | Per-leg summaries | **MODIFY** | `client/src/components/controls/RouteList.tsx` |
| `MapLibreGLMap` | Multiple waypoint markers | **MODIFY** | `client/src/components/MapLibreGLMap.tsx` |
| `ButtonControls` | Add waypoint button | **MODIFY** | `client/src/components/controls/ButtonControls.tsx` |
| `RouteStateManager` | Handle multi-waypoint auto-calculate | **MODIFY** | `client/src/components/RouteStateManager.tsx` |

## Data Flow

### Edge-Based Isochrones: SQL Changes Only

The current isochrone functions use this approach:
1. `pgr_drivingDistance` returns reachable nodes with `agg_cost`
2. Join `edges_vertices_pgr` to get node point geometries
3. `ST_ConcaveHull(ST_Collect(point_geoms))` to generate polygon

The edge-based approach changes steps 2-3:
1. `pgr_drivingDistance` returns reachable nodes with `edge` ID and `agg_cost` (unchanged)
2. Join `edges` to get edge line geometries (`geom_4326`)
3. For edges where `agg_cost` is near the boundary: clip with `ST_LineSubstring` based on remaining cost fraction
4. `ST_ConcaveHull(ST_Collect(edge_line_geoms))` to generate polygon

**Key insight:** `pgr_drivingDistance` already returns an `edge` column (the edge used to reach each node). By joining on edges instead of vertices, we get line geometries that trace the actual street network. Partial edge clipping at the boundary prevents over-extension.

```sql
-- Current approach (node-based):
node_geoms AS (
    SELECT rn.node, rn.agg_cost, v.geom AS the_geom  -- POINT geometries
    FROM reachable_nodes rn
    JOIN edges_vertices_pgr v ON v.id = rn.node
)
-- Then: ST_ConcaveHull(ST_Collect(ng.the_geom), 0.8)  -- hull around points

-- Edge-based approach:
edge_geoms AS (
    SELECT DISTINCT ON (rn.edge)
        rn.edge,
        rn.agg_cost,
        e.geom_4326 AS the_geom,         -- LINE geometries
        e.cost_drive AS edge_cost         -- for partial edge clipping
    FROM reachable_nodes rn
    JOIN edges e ON e.id = rn.edge
    WHERE rn.edge != -1
),
clipped_edges AS (
    SELECT
        CASE
            -- Edge fully within the time band: use full geometry
            WHEN eg.agg_cost <= band_limit THEN eg.the_geom
            -- Edge partially within: clip to the reachable fraction
            ELSE ST_LineSubstring(eg.the_geom, 0,
                LEAST(1.0, (band_limit - (eg.agg_cost - eg.edge_cost)) / eg.edge_cost))
        END AS the_geom
    FROM edge_geoms eg
)
-- Then: ST_ConcaveHull(ST_Collect(ce.the_geom), 0.8)  -- hull around lines
```

**Partial edge clipping logic:**
- `agg_cost` = total cost from origin to the node at the end of this edge
- `agg_cost - edge_cost` = cost to reach the start of this edge
- `band_limit - (agg_cost - edge_cost)` = how much of this edge's cost fits within the band
- Divide by `edge_cost` to get the fraction (0.0 to 1.0) for `ST_LineSubstring`

**Response format is unchanged.** The API still returns `(band_index, minutes, node_count, geom)` tuples. The `geom` polygons will simply be more accurate. No API or frontend changes needed.

### Waypoint Routing: Full-Stack Changes

#### SQL Layer

**New functions** using `pgr_trspVia` (available in pgRouting 3.8, proposed status):

```sql
CREATE FUNCTION getdrivingroute_via(
    _waypoint_lats FLOAT[],   -- array of latitudes in visit order
    _waypoint_lons FLOAT[]    -- array of longitudes in visit order
)
RETURNS TABLE(
    seq             INT,
    path_id         INT,      -- leg identifier (1 = first leg, 2 = second, etc.)
    path_seq        INT,      -- sequence within leg
    id              VARCHAR,
    street          VARCHAR,
    travel_time     FLOAT,
    distance        FLOAT,
    turn_instruction TEXT,
    turn_type       TEXT,
    traffic_factor  NUMERIC(5,2),
    geom            GEOMETRY
) AS $func$
DECLARE
    via_nodes INT[];
    i INT;
BEGIN
    -- Snap each waypoint to nearest driveable node
    FOR i IN 1..array_length(_waypoint_lats, 1) LOOP
        via_nodes := array_append(via_nodes,
            getnearestdrivenode(_waypoint_lons[i], _waypoint_lats[i]));
    END LOOP;

    -- Validate all nodes found
    IF array_position(via_nodes, NULL) IS NOT NULL THEN
        RAISE EXCEPTION 'Could not find driveable nodes near one or more waypoints';
    END IF;

    RETURN QUERY
    WITH ordered_edges AS (
        SELECT
            r.seq, r.path_id, r.path_seq,
            r.edge, r.node,
            e.join_id, e.street, e.time_drive, e.length_feet,
            e.geom_4326 AS edge_geom,
            v.geom AS node_geom
        FROM pgr_trspVia(
            'SELECT id, source, target, cost_drive AS cost, rcost_drive AS reverse_cost
             FROM edges WHERE driveable=TRUE',
            'SELECT path, cost FROM restrictions_for_driving',
            via_nodes, TRUE
        ) AS r
        JOIN edges e ON r.edge = e.id
        LEFT JOIN edges_vertices_pgr v ON r.node = v.id
        WHERE r.edge > 0  -- exclude placeholder rows
        ORDER BY r.seq
    ),
    -- Turn instruction generation (same CTE chain as getdrivingroute)
    -- but preserving path_id for leg identification
    ...
```

**Key differences from existing route functions:**
- Accepts arrays of coordinates instead of two pairs
- Returns `path_id` column identifying each leg
- Uses `pgr_trspVia` instead of `pgr_trsp`
- Turn instruction logic resets at leg boundaries (each leg starts with "Start")
- Edge grouping resets at leg boundaries

**`pgr_trspVia` return columns:**
`(seq, path_id, path_seq, start_vid, end_vid, node, edge, cost, agg_cost, route_agg_cost)`

The `path_id` increments for each leg (1 = first waypoint to second, 2 = second to third, etc.). This maps directly to the "legs" concept in the API response.

**Fallback strategy:** If `pgr_trspVia` is unavailable (proposed status concern), fall back to sequential `pgr_trsp` calls per leg pair. This is less efficient but guaranteed to work. The SQL function can detect availability:

```sql
-- Test if pgr_trspVia exists
SELECT EXISTS(
    SELECT 1 FROM pg_proc WHERE proname = 'pgr_trspvia'
);
```

For bike/walk modes, `pgr_dijkstraVia` is simpler and equally viable since walking has no turn restrictions and biking restrictions are minimal.

#### API Layer

**New POST endpoint** (existing GET remains for backward compatibility):

```python
# api/routes/routing.py - NEW endpoint

class WaypointRouteRequest(BaseModel):
    waypoints: List[str]  # ["lon,lat", "lon,lat", "lon,lat"]
    mode: TravelMode
    use_traffic: bool = True
    avoid_ferries: bool = False
    hour: Optional[int] = None
    day_of_week: Optional[int] = None

class LegSummary(BaseModel):
    leg_index: int
    from_waypoint: int
    to_waypoint: int
    total_time: float
    total_distance: float
    feature_count: int

class WaypointRouteResponse(BaseModel):
    features: List[Feature]  # all features with leg_index in properties
    legs: List[LegSummary]
    total_time: float
    total_distance: float

@router.post("/route", response_model=WaypointRouteResponse)
def post_route(
    request: WaypointRouteRequest,
    routing_service: RoutingService = Depends(get_routing_service)
):
    if len(request.waypoints) < 2:
        raise HTTPException(400, "At least 2 waypoints required")
    if len(request.waypoints) > 10:
        raise HTTPException(400, "Maximum 10 waypoints supported")
    return routing_service.get_via_route(request)
```

**Modified Properties schema:**

```python
class Properties(BaseModel):
    seq: int
    street: Optional[str] = None
    distance: Optional[float] = None
    travel_time: Optional[float] = None
    turn_instruction: Optional[str] = None
    turn_type: Optional[str] = None
    traffic_factor: Optional[float] = None
    leg_index: Optional[int] = None  # NEW: which leg this segment belongs to
```

**RoutingService additions:**

```python
def get_via_route(self, request: WaypointRouteRequest) -> WaypointRouteResponse:
    # 1. Validate all waypoints
    coords = [parse_coordinates(wp) for wp in request.waypoints]
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]

    # 2. Cache key includes all waypoints
    cache_key = f"via-{request.mode}-{'-'.join(request.waypoints)}"

    # 3. Call appropriate SQL function
    sql = text("SELECT * FROM getdrivingroute_via(:lats, :lons)")
    # ... execute, format, cache ...

    # 4. Group features by path_id to compute leg summaries
    legs = self._compute_leg_summaries(features)
```

#### Frontend Layer

**RoutingContext refactor** -- the most impactful change:

```typescript
// Current: startAddress + endAddress (2 fixed slots)
// New: waypoints array (2+ dynamic slots)

export interface RoutingContextType {
  // REPLACE startAddress/endAddress with:
  waypoints: (IMapFeature | null)[]  // ordered waypoint list, min 2 slots
  waypointInputs: string[]           // display strings for each input

  // Keep existing:
  mode: TravelMode
  route: WaypointRoute | null   // extended with legs
  selectedStreet: RouteFeature | null
  useTraffic: boolean
  avoidFerries: boolean
  trafficHour: number | null
  trafficDayOfWeek: number | null
  isInputEnabled: boolean

  // REPLACE setAddress with:
  setWaypoint: (feature: IMapFeature, index: number) => void
  setWaypointInput: (value: string, index: number) => void
  addWaypoint: () => void        // add intermediate stop
  removeWaypoint: (index: number) => void  // remove intermediate stop
  reorderWaypoints: (fromIndex: number, toIndex: number) => void

  // Keep existing:
  setMode: (mode: TravelMode) => void
  setRoute: (route: WaypointRoute | null) => void
  // ... rest unchanged
}
```

**Backward compatibility strategy:**
- `waypoints[0]` = old `startAddress` (origin)
- `waypoints[waypoints.length - 1]` = old `endAddress` (destination)
- Default: 2-element array (functionally identical to current behavior)
- "Add stop" button inserts at `waypoints.length - 1` (before destination)
- Maximum 10 waypoints (API limit)

**Sidebar changes:**

```
Current layout (route mode):
  [Start search]
  [Swap button]
  [End search]
  [Get Directions] [Clear] [Share]
  [Route list]

New layout (route mode, 2 waypoints - default):
  [Search: A (Start)]
  [Swap button]
  [Search: B (End)]
  [+ Add stop]
  [Get Directions] [Clear] [Share]
  [Route list]

New layout (route mode, 3+ waypoints):
  [Search: A (Start)]
  [Search: B (Stop 1)]  [x remove]
  [Search: C (Stop 2)]  [x remove]
  [Search: D (End)]
  [+ Add stop]
  [Get Directions] [Clear] [Share]
  [Route list with leg headers]
```

**Map marker changes:**
- Current: "A" (start, green) and "B" (end, red) markers
- New: "A", "B", "C", ... markers with consistent coloring
  - First marker: green (origin)
  - Last marker: red (destination)
  - Intermediate markers: blue or orange (via stops)

**Route list with legs:**

```typescript
// RouteList groups instructions by leg
<Box>
  {route.legs.map((leg, legIndex) => (
    <Box key={legIndex}>
      <Typography variant="subtitle2">
        Leg {legIndex + 1}: {waypointLabels[legIndex]} to {waypointLabels[legIndex + 1]}
      </Typography>
      <Typography variant="caption">
        {formatTime(leg.total_time)} - {formatDistance(leg.total_distance)}
      </Typography>
      {route.features
        .filter(f => f.properties.leg_index === legIndex + 1)
        .map(feature => <RouteSegment ... />)}
    </Box>
  ))}
  <RouteSummaryCard totalTime={route.total_time} totalDistance={route.total_distance} />
</Box>
```

**URL state sync changes:**

```
Current: ?start=-74.006,40.713&end=-73.935,40.731&mode=drive
New:     ?wp0=-74.006,40.713&wp0Addr=Times+Square
         &wp1=-73.985,40.748&wp1Addr=Empire+State
         &wp2=-73.935,40.731&wp2Addr=Central+Park
         &mode=drive&traffic=true

Legacy format (?start=&end=) continues to work, mapped to wp0/wp1.
```

### Interface Types

```typescript
// New/modified types in interfaces.ts

export interface WaypointRoute {
  features: RouteFeature[]     // all segments, with leg_index
  legs: LegSummary[]
  total_time: number
  total_distance: number
}

export interface LegSummary {
  leg_index: number
  from_waypoint: number
  to_waypoint: number
  total_time: number
  total_distance: number
  feature_count: number
}

// Extend RouteProperties
export interface RouteProperties {
  seq: number
  street: string
  distance: number
  travel_time: number
  turn_instruction?: string
  turn_type?: string
  traffic_factor?: number
  leg_index?: number           // NEW: which leg (1-based)
  [key: string]: unknown
}
```

## Patterns to Follow

### Pattern 1: SQL Function Encapsulation (Existing)
All pgRouting logic stays in SQL functions. The API calls `SELECT * FROM get*route_via(...)` and never constructs raw graph queries. This continues for both features.

### Pattern 2: Backward-Compatible API Evolution
The existing `GET /api/route?orig=...&dest=...` remains unchanged. A new `POST /api/route` endpoint handles waypoints. The GET endpoint internally maps to the same service layer (treating 2 waypoints as orig/dest). This avoids breaking existing URL sharing and bookmarks.

### Pattern 3: Context State Arrays with Minimum Size
The waypoints array always has at least 2 elements (origin + destination). Operations enforce this invariant:
- `addWaypoint()` inserts before last element (cannot exceed 10)
- `removeWaypoint(index)` only works for indices 1..n-2 (cannot remove first/last)
- `clearAddresses()` resets to `[null, null]`

### Pattern 4: Progressive Enhancement
The default state (2 waypoints) is functionally identical to the current UI. Users see the same start/end inputs. The "Add stop" button reveals the new capability. This minimizes learning curve and testing surface.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Sequential pgr_trsp Calls for Via Routing
**What:** Calling `pgr_trsp(A, B)` then `pgr_trsp(B, C)` then `pgr_trsp(C, D)` in a loop.
**Why bad:** N-1 separate database round trips for N waypoints. Each call independently optimizes its leg without considering the global path. No `route_agg_cost` for total journey time.
**Instead:** Use `pgr_trspVia(edges_sql, restrictions_sql, ARRAY[A,B,C,D])` -- single call, single result set with `path_id` per leg and cumulative `route_agg_cost`.

### Anti-Pattern 2: Sending Waypoints as Repeated Query Params
**What:** `GET /api/route?wp=A&wp=B&wp=C` with repeated parameter names.
**Why bad:** Some HTTP clients and proxies handle repeated params inconsistently. Query strings have length limits (~2000 chars in practice) that restrict the number of waypoints with addresses.
**Instead:** Use `POST /api/route` with JSON body `{ "waypoints": [...] }` for multi-stop routes. Keep `GET` for simple 2-point routes (backward compatible).

### Anti-Pattern 3: Storing Waypoints in Separate useState Calls
**What:** `const [wp1, setWp1] = useState()`, `const [wp2, setWp2] = useState()`, etc.
**Why bad:** Fixed number of state variables. Cannot dynamically add/remove waypoints. State updates are not atomic (setting wp1 and wp2 causes two re-renders).
**Instead:** Single `const [waypoints, setWaypoints] = useState<(IMapFeature | null)[]>([null, null])` with immutable array updates.

### Anti-Pattern 4: Recomputing Full Isochrone on Edge-Based Upgrade
**What:** Changing the API response format or adding new fields when upgrading to edge-based isochrones.
**Why bad:** Forces frontend changes for what is purely a quality improvement. The polygon shape changes but the data contract stays the same.
**Instead:** Edge-based isochrone is a SQL-only change. Same `(band_index, minutes, node_count, geom)` return signature. The frontend renders whatever polygon geometry it receives.

### Anti-Pattern 5: Mixing Leg Data with Turn Instruction State
**What:** Using turn instruction resets ("Start") to infer leg boundaries on the frontend.
**Why bad:** Fragile heuristic. A leg that starts with "Continue on X ST" (when the previous leg ends on the same street) would be missed.
**Instead:** Use the explicit `leg_index` (from `path_id`) in each feature's properties. The frontend groups by `leg_index`, not by instruction text.

## Scalability Considerations

### Edge-Based Isochrones

| Concern | Current (node-based) | Edge-based | Notes |
|---------|---------------------|------------|-------|
| Geometry data volume | ~500B per node point | ~200B per edge line | Lines have more coordinates but fewer total geometries (edges < nodes) |
| ST_ConcaveHull quality | Gaps in sparse areas | Follows street network | Edge lines fill gaps where nodes are far apart |
| ST_ConcaveHull cost | Similar | Similar | Hull algorithm is O(n log n) regardless of point vs line input |
| Partial edge clipping | N/A | ~0.1ms per edge | ST_LineSubstring is very fast |
| Polygon complexity | Low (few vertices) | Higher (more vertices) | Add ST_SimplifyPreserveTopology(geom, 50) if needed |

### Waypoint Routing

| Concern | 2 waypoints | 5 waypoints | 10 waypoints |
|---------|-------------|-------------|--------------|
| pgr_trspVia time | ~200ms | ~600ms | ~1.5s |
| Edge result count | 50-200 | 150-600 | 300-1200 |
| Turn instruction compute | ~50ms | ~150ms | ~300ms |
| GeoJSON response size | 20-80 KB | 60-240 KB | 120-480 KB |
| Total request time | <500ms | <1s | <2s |
| Frontend render time | Instant | <50ms | <100ms |

**Performance mitigations:**
- Bounding box pre-filter on edges for isochrones (already implemented)
- Cache waypoint routes with full waypoint array as key
- Limit waypoints to 10 (reasonable for NYC, prevents abuse)
- Use `geom_4326` cached column throughout (no per-row ST_Transform)

## Integration Points with Existing Code

### Edge-Based Isochrones: Minimal Integration

**Modified files (1 file):**

| File | Change | Risk |
|------|--------|------|
| `data-importer/src/sql/05_functions.sql` | Replace node_geoms CTE with edge_geoms + clipped_edges CTEs in all 3 isochrone functions | LOW - same return signature |

**No other files need changes.** The isochrone response format `(band_index, minutes, node_count, geom)` is unchanged. The `geom` column contains a polygon either way. `IsochroneService`, `IsochroneContext`, `useIsochroneFetch`, and `MapLibreGLMap` all operate on the polygon geometry without caring how it was generated.

**Testing:** Compare polygon output visually for identical origin/mode/intervals. Edge-based polygons should have smoother boundaries with fewer concavities.

### Waypoint Routing: Broad Integration

**New files (4 files):**

| File | Purpose |
|------|---------|
| `api/routes/routing.py` | POST endpoint (added to existing router) |
| `api/models/schemas.py` | `WaypointRouteRequest`, `LegSummary`, `WaypointRouteResponse` |
| (SQL functions in existing `05_functions.sql`) | `getdrivingroute_via()`, `getbikingroute_via()`, `getwalkingroute_via()` |

**Modified files (10+ files):**

| File | Change | Risk |
|------|--------|------|
| `05_functions.sql` | Add 3-4 new via route functions | LOW - additive |
| `api/services/routing.py` | Add `get_via_route()` method | LOW - new method |
| `api/models/schemas.py` | Add waypoint schemas | LOW - additive |
| `api/dependencies.py` | No changes needed (RoutingService already instantiated) | NONE |
| `client/src/contexts/RoutingContext.tsx` | Replace `startAddress`/`endAddress` with `waypoints[]` | **HIGH** - touches most components |
| `client/src/hooks/useRouteFetch.ts` | POST with waypoints body | MEDIUM |
| `client/src/hooks/useRouteStateSync.ts` | URL format for N waypoints | MEDIUM |
| `client/src/types/interfaces.ts` | Add `WaypointRoute`, `LegSummary`, extend `RouteProperties` | LOW |
| `client/src/components/Sidebar.tsx` | Dynamic waypoint inputs | MEDIUM |
| `client/src/components/controls/Search.tsx` | Waypoint index identity | LOW |
| `client/src/components/controls/RouteList.tsx` | Per-leg grouping | MEDIUM |
| `client/src/components/controls/ButtonControls.tsx` | "Add stop" button, multi-waypoint enable check | MEDIUM |
| `client/src/components/MapLibreGLMap.tsx` | Dynamic waypoint markers (A, B, C, ...) | MEDIUM |
| `client/src/components/RouteStateManager.tsx` | Multi-waypoint auto-calculate | LOW |
| `client/src/components/controls/RouteSummaryCard.tsx` | Show per-leg + total summaries | LOW |

### Shared Context Refactoring Strategy

The `RoutingContext` refactor from `startAddress`/`endAddress` to `waypoints[]` is the riskiest change because virtually every component reads `startAddress` or `endAddress`. The recommended approach:

1. **Add `waypoints` array alongside existing fields** (not replacing them yet)
2. **Derive `startAddress`/`endAddress` from `waypoints[0]`/`waypoints[last]`** as computed values
3. **Keep all existing component interfaces working** via the derived values
4. **Gradually migrate components** to read from `waypoints[]` directly
5. **Remove `startAddress`/`endAddress` fields** once all consumers are migrated

```typescript
// Transitional RoutingContext (step 2):
const startAddress = waypoints[0]            // derived, not stored
const endAddress = waypoints[waypoints.length - 1]  // derived, not stored

// Components still read startAddress/endAddress and work unchanged
// New waypoint UI reads waypoints[] directly
```

This lets the "Add stop" feature be built incrementally without breaking the existing 2-point routing flow.

## Suggested Build Order

### Phase 1: Edge-Based Isochrones (SQL-only, isolated)

**Build:** Modify `getdrivingisochrone()`, `getbikingisochrone()`, `getwalkingisochrone()` in `05_functions.sql`

**Why first:**
- Zero dependencies on waypoint routing
- SQL-only change with no API or frontend impact
- Immediate visual quality improvement
- Can be tested by comparing polygon output in psql
- Low risk (same return signature, same concave hull approach)

**Specific changes:**
- Replace `node_geoms` CTE (joining `edges_vertices_pgr` for point geometries)
- With `edge_geoms` CTE (joining `edges` for line geometries)
- Add `clipped_edges` CTE (using `ST_LineSubstring` for boundary edges)
- Feed line collection to `ST_ConcaveHull` instead of point collection
- Adjust `ST_SimplifyPreserveTopology` tolerance if polygons are too complex

**Test:** `SELECT * FROM getdrivingisochrone(-73.985, 40.748, ARRAY[5, 10, 15]::float[])` and visually compare polygon boundaries in QGIS or similar.

**Dependencies:** None

### Phase 2: Via Route SQL Functions (database layer)

**Build:** `getdrivingroute_via()`, `getbikingroute_via()`, `getwalkingroute_via()`, `getdrivingroute_via_with_traffic()` in `05_functions.sql`

**Why second:**
- Foundation for all waypoint routing
- Can be tested directly in psql
- Validates that `pgr_trspVia` works correctly with the existing edge table and restrictions
- Independent of frontend changes

**Key decisions:**
- Accept coordinate arrays (not node IDs) -- function handles node snapping internally
- Return `path_id` column (from `pgr_trspVia`) for leg identification
- Reuse the existing turn instruction CTE chain, modified to reset at leg boundaries
- Edge grouping resets at leg boundaries (SUM window function partitioned by `path_id`)

**Test:**
```sql
SELECT * FROM getdrivingroute_via(
    ARRAY[40.748, 40.758, 40.731]::float[],
    ARRAY[-73.985, -73.971, -73.935]::float[]
);
-- Should return segments with path_id = 1 (leg 1) and path_id = 2 (leg 2)
```

**Dependencies:** None (parallel with Phase 1)

### Phase 3: Waypoint API Endpoint (service + route layer)

**Build:** `WaypointRouteRequest`/`WaypointRouteResponse` schemas, `get_via_route()` service method, `POST /api/route` endpoint

**Why third:**
- Wraps SQL functions in service pattern
- Can be tested via Swagger/curl
- Validates WKB conversion, caching, error handling for multi-waypoint case
- Independent of frontend changes

**Test:** `curl -X POST http://localhost:5001/api/route -H "Content-Type: application/json" -d '{"waypoints": ["-73.985,40.748", "-73.971,40.758", "-73.935,40.731"], "mode": "drive"}'`

**Dependencies:** Phase 2 (SQL functions must exist)

### Phase 4: RoutingContext Refactor (frontend state)

**Build:** Add `waypoints[]` to RoutingContext with derived `startAddress`/`endAddress`

**Why fourth:**
- The transitional approach (deriving start/end from waypoints) means existing components keep working
- This is the highest-risk change but is contained within RoutingContext
- All existing tests should continue to pass with the derived values
- No visual changes yet -- just state plumbing

**Dependencies:** None (frontend-independent of backend phases)

### Phase 5: Waypoint UI (sidebar + map + URL sync)

**Build:** Dynamic waypoint inputs in Sidebar, "Add stop" button, waypoint markers on map, URL state sync for N waypoints, per-leg RouteList

**Why last:**
- Most visible, most subjective, most iterative
- Everything else works without it (can test via POST endpoint)
- Building UI last lets you validate the data pipeline before adding interaction complexity

**Dependencies:** Phases 3 + 4 (API endpoint + context refactor must be done)

### Phase Dependency Graph

```
Phase 1: Edge-Based Isochrones -----> (independent, can ship alone)
              (SQL only)

Phase 2: Via Route SQL Functions ---> Phase 3: Waypoint API ---> Phase 5: Waypoint UI
              (SQL)                        (API)                      (Frontend)
                                                                        ^
Phase 4: RoutingContext Refactor --------------------------------/
              (Frontend state)
```

**Phases 1 and 2 can run in parallel.** They touch the same SQL file (`05_functions.sql`) but different functions, so merge conflicts are unlikely.

**Phases 2 and 4 can run in parallel.** Backend SQL and frontend state are independent.

**Phase 5 requires both 3 and 4.** The UI needs the API endpoint (Phase 3) and the waypoints state (Phase 4).

## File Inventory

### Edge-Based Isochrones

| File | Action | Risk |
|------|--------|------|
| `data-importer/src/sql/05_functions.sql` | Modify 3 isochrone functions | LOW |

### Waypoint Routing

| File | Action | Risk |
|------|--------|------|
| `data-importer/src/sql/05_functions.sql` | Add 3-4 new SQL functions | LOW |
| `api/services/routing.py` | Add `get_via_route()` method | LOW |
| `api/models/schemas.py` | Add 3 new Pydantic models | LOW |
| `api/routes/routing.py` | Add POST endpoint | LOW |
| `client/src/types/interfaces.ts` | Add/extend 3 interfaces | LOW |
| `client/src/contexts/RoutingContext.tsx` | Major refactor (waypoints array) | **HIGH** |
| `client/src/hooks/useRouteFetch.ts` | Switch to POST for 3+ waypoints | MEDIUM |
| `client/src/hooks/useRouteStateSync.ts` | New URL format | MEDIUM |
| `client/src/components/Sidebar.tsx` | Dynamic waypoint inputs | MEDIUM |
| `client/src/components/controls/Search.tsx` | Waypoint index support | LOW |
| `client/src/components/controls/RouteList.tsx` | Per-leg grouping | MEDIUM |
| `client/src/components/controls/ButtonControls.tsx` | Add stop button | MEDIUM |
| `client/src/components/MapLibreGLMap.tsx` | Dynamic markers | MEDIUM |
| `client/src/components/RouteStateManager.tsx` | Multi-waypoint auto-calc | LOW |
| `client/src/components/controls/RouteSummaryCard.tsx` | Leg summaries | LOW |

## Sources

- [pgr_drivingDistance documentation (pgRouting 3.8)](https://docs.pgrouting.org/latest/en/pgr_drivingDistance.html) -- HIGH confidence, verified return columns include `edge`
- [pgr_trspVia documentation (pgRouting 3.8, proposed)](https://access.crunchydata.com/documentation/pgrouting/latest/pgr_trspVia.html) -- HIGH confidence, verified function signature and `path_id` semantics
- [pgr_dijkstraVia documentation (pgRouting 3.8, proposed)](https://access.crunchydata.com/documentation/pgrouting/latest/pgr_dijkstraVia.html) -- HIGH confidence, verified function signature
- [TRSP Family functions (pgRouting 3.8)](https://docs.pgrouting.org/3.8/en/TRSP-family.html) -- HIGH confidence, confirms pgr_trspVia availability
- [PostGIS ST_LineSubstring documentation](https://postgis.net/docs/ST_LineSubstring.html) -- HIGH confidence, for partial edge clipping
- [PostGIS ST_ConcaveHull documentation](https://postgis.net/docs/ST_ConcaveHull.html) -- HIGH confidence, works with both points and lines
- Project codebase examination of `05_functions.sql`, `routing.py`, `isochrone.py`, `RoutingContext.tsx`, `MapLibreGLMap.tsx`, `Sidebar.tsx`, `useRouteFetch.ts`, `useRouteStateSync.ts`, `schemas.py`, `dependencies.py` -- HIGH confidence
- Docker image `pgrouting/pgrouting:17-3.5-3.8` confirms PostgreSQL 17, PostGIS 3.5, pgRouting 3.8 -- HIGH confidence
