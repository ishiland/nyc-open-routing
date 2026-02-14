# Phase 11: Waypoint Routing Backend - Research

**Researched:** 2026-02-14
**Domain:** pgRouting multi-stop routing, FastAPI endpoint design, SQL function composition
**Confidence:** HIGH

## Summary

Waypoint routing requires calculating ordered multi-stop routes (A -> B -> C) with per-leg turn directions. The existing codebase has a clean separation: SQL functions (`getdrivingroute`, `getbikingroute`, `getwalkingroute`) handle single-origin-to-destination routing via `pgr_trsp`, a Python service layer (`RoutingService`) coordinates DB calls and response formatting, and a FastAPI route layer (`/api/route`) handles HTTP concerns.

The implementation approach is straightforward: **sequential pgr_trsp calls** per leg (one call per waypoint pair), with each leg processed through the existing SQL turn-direction/segment-grouping logic, then assembled with a `leg` identifier in the API layer. This avoids any dependency on `pgr_trspVia` (which is "Proposed" status in pgRouting 3.8 and would require restructuring the existing complex turn-instruction CTEs). The POC scope of max 3 waypoints (max 2 legs) makes sequential calls negligible in performance cost.

**Primary recommendation:** Use sequential calls to existing SQL functions per leg, add a `leg` field to the response schema, and create a new `/api/route/waypoints` endpoint (or extend `/api/route` with a `waypoints` query parameter). Keep the existing two-point routing completely untouched.

## Standard Stack

### Core (Already In Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pgRouting | 3.8 (Docker: `pgrouting/pgrouting:17-3.5-3.8`) | Graph routing engine | Already handles all routing via `pgr_trsp` |
| FastAPI | Current in project | API framework | Already serves `/api/route` endpoint |
| Pydantic | v2 (via FastAPI) | Request/response validation | Already defines `RouteResponse`, `Feature`, `Properties` |
| SQLAlchemy | Current in project | DB access | Already used in `RoutingService` |

### Supporting (Already In Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Shapely | Current in project | WKB geometry parsing | Already used in `utils/geo.py` for `dump_geo()` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sequential `pgr_trsp` calls | `pgr_trspVia` (single query) | `pgr_trspVia` is "Proposed" status, returns raw edges without turn instructions, would require rewriting 200+ lines of turn-direction CTE logic per mode. Sequential calls reuse existing battle-tested SQL. For 2-3 waypoints the performance difference is negligible (~50ms per leg). |
| New `/api/route/waypoints` endpoint | Extend existing `/api/route` with `waypoints` param | Extending existing endpoint risks breaking backward compatibility. Separate endpoint is cleaner and keeps two-point routing untouched (success criterion #4). |

**Installation:** No new packages needed. All dependencies already in project.

## Architecture Patterns

### Recommended Approach: Service-Layer Leg Assembly

The cleanest pattern is to loop over waypoint pairs in the Python service layer, calling existing SQL functions per leg, then tagging results with a `leg` index.

```
Request: /api/route/waypoints?waypoints=-73.98,40.75|-73.99,40.76|-74.00,40.77&mode=drive

Service Layer Logic:
  waypoints = [(-73.98,40.75), (-73.99,40.76), (-74.00,40.77)]
  legs = []
  for i in range(len(waypoints) - 1):
      leg_features = get_driving_route(waypoints[i], waypoints[i+1])
      tag each feature with leg=i
      legs.extend(leg_features)
  return WaypointRouteResponse(legs=legs)
```

### Pattern 1: Coordinate List Parsing
**What:** Accept waypoints as pipe-delimited coordinate pairs in a single query param
**When to use:** Multi-stop routing endpoint
**Why:** Consistent with existing `orig`/`dest` format ("lon,lat"), avoids complex JSON body for a GET request

```
# URL format:
/api/route/waypoints?waypoints=-73.98,40.75|-73.99,40.76|-74.00,40.77&mode=drive

# Parsing:
waypoints_raw = "lon1,lat1|lon2,lat2|lon3,lat3"
pairs = waypoints_raw.split("|")
coords = [parse_coordinates(p) for p in pairs]  # reuse existing parse_coordinates()
```

### Pattern 2: Per-Leg Response with Leg Index
**What:** Each route feature gets a `leg` integer field identifying which waypoint-to-waypoint segment it belongs to
**When to use:** Waypoint route responses
**Why:** Enables frontend to group directions per leg, compute per-leg summaries, color-code legs on map

```python
# Response structure:
{
    "legs": [
        {
            "leg": 0,
            "summary": {"distance": 5280.0, "travel_time": 12.5},
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "seq": 1,
                        "leg": 0,
                        "street": "BROADWAY",
                        "distance": 2640.0,
                        "travel_time": 6.2,
                        "turn_instruction": "Start",
                        "turn_type": "continue",
                        "traffic_factor": 1.0
                    },
                    "geometry": { "type": "LineString", "coordinates": [...] }
                }
            ]
        }
    ],
    "summary": {"total_distance": 10560.0, "total_travel_time": 25.0, "num_legs": 2}
}
```

### Pattern 3: Reuse Existing SQL Functions Verbatim
**What:** Call `getdrivingroute()`, `getbikingroute()`, `getwalkingroute()` per leg with no SQL changes
**When to use:** Always for waypoint routing
**Why:** These functions already handle node snapping, turn restrictions, turn directions, segment grouping, geometry merging. Zero risk of regression to existing routing.

### Anti-Patterns to Avoid
- **Modifying existing SQL functions:** The 200+ line CTE chains in `05_functions.sql` are complex and battle-tested. Adding array parameters or loop logic inside SQL creates regression risk. Let Python handle the orchestration.
- **Overloading `/api/route`:** Adding waypoint support to the existing endpoint mixes two different concerns and risks breaking backward compatibility. Keep it as a separate endpoint.
- **Single DB connection for all legs:** Each leg call should use its own connection from the pool (the existing `with self.engine.connect()` pattern). Don't try to reuse a single connection across legs -- the pool handles this efficiently.
- **Sending `pgr_trspVia` raw results to the frontend:** `pgr_trspVia` returns raw node/edge/cost rows without street names, turn instructions, segment grouping, or geometry. You'd need to rebuild the entire 200-line CTE chain per mode around its output.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Route calculation per leg | Custom SQL for multi-stop | Existing `getdrivingroute()` / `getbikingroute()` / `getwalkingroute()` | 200+ lines of tested turn-direction/grouping logic per mode |
| Coordinate parsing/validation | New parser for waypoints | Existing `parse_coordinates()` from `utils/geo.py` | Already handles NYC bounds validation |
| Geometry conversion | New WKB parser | Existing `dump_geo()` from `utils/geo.py` | Already handles WKB->GeoJSON |
| Response formatting | New feature builder | Existing `_format_route_response()` from `RoutingService` | Already handles row->Feature conversion for all modes |
| Caching | New cache strategy | Existing `RouteCache` from `utils/cache.py` | Works with any key structure, just needs a new key format |

**Key insight:** The entire waypoint feature is an orchestration problem, not a routing-algorithm problem. The hard parts (pgr_trsp, turn restrictions, turn directions, segment grouping) are already solved. The new code just loops over legs and tags results.

## Common Pitfalls

### Pitfall 1: Sequence Number Collision Across Legs
**What goes wrong:** Each leg's SQL function returns `seq` starting from 1. If you naively concatenate features, multiple features will have `seq=1`.
**Why it happens:** SQL functions are designed for single-route use, each starts seq at 1.
**How to avoid:** Either (a) re-number seq globally across all legs (seq = previous_leg_max_seq + leg_seq), or (b) make the `leg` field the primary grouping key and keep seq local to each leg. Option (b) is simpler and matches the per-leg directions requirement.
**Warning signs:** Frontend displays garbled turn-by-turn if sorting by seq without considering leg.

### Pitfall 2: Traffic-Aware Routing Inconsistency Across Legs
**What goes wrong:** If `use_traffic=true` but traffic data is missing, the first leg may fall back to non-traffic while subsequent legs use traffic (or vice versa), creating inconsistent time estimates.
**Why it happens:** The existing `get_driving_route()` has a try/except fallback that retries without traffic on error. Each leg makes this decision independently.
**How to avoid:** Detect traffic availability once before the loop. Either use traffic for ALL legs or NONE. The simplest approach: run the first leg, check if it fell back, and use the same traffic setting for remaining legs.
**Warning signs:** Wildly different `traffic_factor` distributions between legs of the same route.

### Pitfall 3: Empty Leg (No Route Found)
**What goes wrong:** One waypoint pair might not have a valid route (disconnected areas, water crossings), but other legs succeed. The response is partially valid.
**Why it happens:** NYC has areas (islands, restricted zones) where certain modes can't route.
**How to avoid:** Fail the entire request if any leg returns 0 segments. Return a clear error message indicating which leg (pair of waypoints) failed. Don't return partial results.
**Warning signs:** Response has some legs with features and others empty.

### Pitfall 4: Coordinate Validation for Variable-Length Input
**What goes wrong:** The waypoints parameter accepts 2-3 coordinate pairs, but edge cases include: 0 pairs, 1 pair (single point, not routable), duplicate adjacent pairs, >3 pairs.
**Why it happens:** Open query parameter without proper validation.
**How to avoid:** Validate: minimum 2 waypoints, maximum 3 waypoints (POC scope), no adjacent duplicates. Return 400 with clear message for violations.
**Warning signs:** 500 errors from database when single-point or empty arrays are passed.

### Pitfall 5: Breaking Existing Two-Point Routing
**What goes wrong:** Modifying `RoutingService` methods or SQL functions introduces regressions in the existing `/api/route` endpoint.
**Why it happens:** Coupling new waypoint logic too tightly with existing code.
**How to avoid:** Add a NEW method to `RoutingService` (e.g., `get_waypoint_route()`) that CALLS the existing mode-specific methods. Don't modify `get_driving_route()`, `get_biking_route()`, or `get_walking_route()`. Add a new API endpoint, not new params on the existing one.
**Warning signs:** Existing unit tests or smoke tests fail after changes.

## Code Examples

### Example 1: Waypoints Query Parameter Parsing

```python
# In api/routes/routing.py (new endpoint)
from fastapi import APIRouter, Query, HTTPException
from typing import List, Tuple

@router.get("/route/waypoints", response_model=WaypointRouteResponse)
def get_waypoint_route(
    waypoints: str = Query(
        ...,
        description="Pipe-delimited waypoints in lon,lat format (2-3 points). Example: -73.98,40.75|-73.99,40.76|-74.00,40.77"
    ),
    mode: TravelMode = Query(..., description="Travel mode: drive, bike, or walk"),
    use_traffic: bool = Query(default=True, description="Use traffic-aware routing (drive mode only)"),
    avoid_ferries: bool = Query(default=False, description="Avoid ferry crossings (bike/walk only)"),
    routing_service: RoutingService = Depends(get_routing_service)
):
    # Parse waypoints
    pairs = waypoints.split("|")
    if len(pairs) < 2:
        raise HTTPException(status_code=400, detail="At least 2 waypoints required")
    if len(pairs) > 3:
        raise HTTPException(status_code=400, detail="Maximum 3 waypoints supported")

    return routing_service.get_waypoint_route(
        waypoints=pairs, mode=mode, use_traffic=use_traffic, avoid_ferries=avoid_ferries
    )
```

### Example 2: Service Layer Leg Assembly

```python
# In api/services/routing.py (new method)
def get_waypoint_route(
    self, waypoints: List[str], mode: str,
    use_traffic: bool = True, avoid_ferries: bool = False
) -> WaypointRouteResponse:
    legs = []
    total_distance = 0.0
    total_time = 0.0

    for i in range(len(waypoints) - 1):
        orig = waypoints[i]
        dest = waypoints[i + 1]

        # Call existing mode-specific routing
        if mode == "drive":
            leg_response = self.get_driving_route(orig, dest, use_traffic=use_traffic)
        elif mode == "bike":
            leg_response = self.get_biking_route(orig, dest, avoid_ferries=avoid_ferries)
        elif mode == "walk":
            leg_response = self.get_walking_route(orig, dest, avoid_ferries=avoid_ferries)

        # Tag features with leg index
        leg_features = []
        leg_distance = 0.0
        leg_time = 0.0
        for feature in leg_response.features:
            feature.properties.leg = i
            leg_features.append(feature)
            leg_distance += feature.properties.distance or 0
            leg_time += feature.properties.travel_time or 0

        legs.append(LegResponse(
            leg=i,
            summary=LegSummary(distance=leg_distance, travel_time=leg_time),
            features=leg_features
        ))
        total_distance += leg_distance
        total_time += leg_time

    return WaypointRouteResponse(
        legs=legs,
        summary=RouteSummary(
            total_distance=total_distance,
            total_travel_time=total_time,
            num_legs=len(legs)
        )
    )
```

### Example 3: Pydantic Response Models

```python
# In api/models/schemas.py (new models)
class WaypointProperties(Properties):
    """Extended properties with leg identifier."""
    leg: int = 0  # Which waypoint-to-waypoint segment this belongs to

class LegSummary(BaseModel):
    """Summary statistics for a single leg."""
    distance: float  # total feet
    travel_time: float  # total minutes

class LegResponse(BaseModel):
    """A single leg (waypoint-to-waypoint segment)."""
    leg: int
    summary: LegSummary
    features: List[Feature]

class RouteSummary(BaseModel):
    """Overall route summary."""
    total_distance: float
    total_travel_time: float
    num_legs: int

class WaypointRouteResponse(BaseModel):
    """Response model for waypoint routing."""
    legs: List[LegResponse]
    summary: RouteSummary
```

### Example 4: Cache Key for Waypoint Routes

```python
# Waypoint routes need a unique cache key that includes all waypoints
# Reuse existing RouteCache._make_key pattern
waypoints_key = "|".join(waypoints)  # "lon1,lat1|lon2,lat2|lon3,lat3"
cache_key = f"waypoint-{mode}-{traffic_suffix}"
cached = self.cache.get(waypoints_key, "", cache_key)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pgr_trsp` with `(from_edge, to_edge, via_node)` restriction format | `pgr_trsp` with `ARRAY[edge_ids]` as `path` column | pgRouting 3.4+ | Project already uses the new format |
| `pgr_dijkstraVia` (no turn restrictions) | `pgr_trspVia` (proposed, with restrictions) | pgRouting 3.4+ | Available but "Proposed" status; sequential `pgr_trsp` is safer |

**Deprecated/outdated:**
- The old `pgr_trsp` signature with `(from_edge, to_edge, via_node)` restriction columns is deprecated. The project already uses the newer `ARRAY` format.
- `pgr_trspVia` remains "Proposed" in pgRouting 3.8. It works but the API may change in future releases.

## pgr_trspVia Reference (for future optimization)

If the project later wants to optimize multi-stop routing with a single DB call, `pgr_trspVia` is available:

**Signature:**
```sql
pgr_trspVia(Edges SQL, Restrictions SQL, ARRAY[via_node_ids], directed := true)
```

**Result columns:** `seq, path_id, path_seq, start_vid, end_vid, node, edge, cost, agg_cost, route_agg_cost`

**Key field:** `path_id` identifies which leg (1-indexed, one per waypoint pair).

**Restriction SQL format:** `SELECT path, cost FROM restrictions_for_driving` -- identical to current project format.

**Why not use now:** Returns raw edges without street names, turn instructions, or grouped segments. Would require rewriting ~200 lines of CTE logic per mode (driving, biking, walking, traffic-aware driving = 4 variants). Sequential calls to existing functions are simpler, proven, and fast enough for 2-3 waypoints.

## Open Questions

1. **API endpoint design: new endpoint vs. extended parameter?**
   - What we know: Success criterion #4 requires existing two-point routing to work unchanged. A new endpoint guarantees this.
   - What's unclear: Whether the user prefers `/api/route/waypoints?waypoints=...` or extending `/api/route?waypoints=...` with backward-compatible fallback.
   - Recommendation: Use a new endpoint `/api/route/waypoints`. Cleaner separation, zero regression risk.

2. **Response structure: flat features list vs. nested legs?**
   - What we know: Per-leg directions are required (success criterion #1). Frontend needs to display per-leg summaries.
   - What's unclear: Whether to return a flat `features` array with `leg` field on each feature, or a nested `legs` array containing per-leg feature arrays.
   - Recommendation: Nested `legs` array. It naturally groups per-leg data and makes per-leg summaries trivial.

3. **Traffic consistency across legs**
   - What we know: Existing `get_driving_route()` can silently fall back from traffic to non-traffic routing on error.
   - What's unclear: Whether inconsistent traffic handling across legs matters for POC.
   - Recommendation: For POC, accept the existing fallback behavior per-leg. If traffic fails on one leg, that leg uses non-traffic. Document as known limitation.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct reading of `05_functions.sql` (1463 lines), `api/services/routing.py`, `api/routes/routing.py`, `api/models/schemas.py`, `04_restrictions.sql`, `api/services/isochrone.py`, test files, client-side types/hooks
- **pgRouting official docs** (v3.8) - [pgr_trspVia](https://docs.pgrouting.org/3.8/en/pgr_trspVia.html), [pgr_trsp](https://docs.pgrouting.org/3.8/en/pgr_trsp.html), [TRSP family](https://access.crunchydata.com/documentation/pgrouting/latest/TRSP-family.html)
- **Context7 /pgrouting/pgrouting** - pgr_trspVia signature, result columns, via-result structure, restriction SQL format

### Secondary (MEDIUM confidence)
- **pgRouting Docker image** `pgrouting/pgrouting:17-3.5-3.8` - Confirmed PostGIS 3.5, pgRouting 3.8 from `docker-compose.yml`
- **CrunchyData pgRouting docs** - [pgr_trspVia proposed status](https://access.crunchydata.com/documentation/pgrouting/latest/pgr_trspVia.html) - Confirmed "Proposed" since v3.4.0

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; everything is already in the project
- Architecture: HIGH - Sequential leg assembly is a simple orchestration pattern; existing SQL functions handle all complexity
- Pitfalls: HIGH - Identified from direct codebase analysis of existing error handling, fallback logic, and response formatting

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable -- no external dependency changes expected)
