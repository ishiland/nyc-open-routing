# Architecture

NYC Open Routing is a three-service Docker Compose application that computes multi-modal routes across NYC's street network using pgRouting.

## Services

| Service | Stack | Role |
|---------|-------|------|
| **client** | React 18, TypeScript, Vite, MUI 7, MapLibre GL 5 | Map UI, address search, route/isochrone display |
| **api** | Python 3.11, FastAPI, uvicorn | REST API — geocoding, routing, isochrone, traffic |
| **db** | PostgreSQL 17, PostGIS, pgRouting | Street network graph, spatial queries, routing algorithms |

## Data Flow

A route request follows this path:

```
Browser → GET /api/route?orig=...&dest=...&mode=drive
  → FastAPI route handler (api/routes/routing.py)
    → Service layer (api/services/routing.py)
      → SQL function: getdrivingroute(orig_lon, orig_lat, dest_lon, dest_lat)
        → getnearestdrivenode() snaps coords to nearest graph vertex
        → pgr_trsp() computes turn-restricted shortest path
        → Returns GeoJSON LineString with turn-by-turn steps
      ← JSON response with geometry + directions
    ← MapLibre renders route on map
```

Address search uses NYC's Geosupport geocoder (via `python-geosupport`) to convert addresses to coordinates. The `geosupport-suggest` library provides autocomplete.

## Import Pipeline

The street network is built from NYC's LION dataset (Department of City Planning). The import runs once on first setup:

```bash
make import  # or: docker compose exec api sh /data-imports/import-lion.sh 25a
```

`import-lion.sh` downloads LION, loads it via `create_network.py`, then runs 9 SQL phases:

| Phase | File | Purpose |
|-------|------|---------|
| 01 | `01_edges.sql` | Build edge table from LION segments with mode flags (driveable/bikeable/walkable) |
| 02 | `02_travel_time.sql` | Calculate travel times per mode using speed limits and segment lengths |
| 03 | `03_cost.sql` | Compute routing costs (time-based) with directional cost/reverse_cost |
| 04 | `04_restrictions.sql` | Generate turn restrictions from grade-separation data (overpass/underpass) |
| 05 | `05_functions.sql` | Create SQL routing and isochrone functions |
| 06 | `06_performance_indexes.sql` | Add spatial and B-tree indexes for query performance |
| 07 | `07_vertex_accessibility.sql` | Mark vertices reachable per mode (drive/bike/walk) |
| 08 | `08_cached_geometries.sql` | Pre-transform geometries to WGS84 for API responses |
| 09 | `09_ferry_connections.sql` | Isolate ferry internal nodes from bridge/tunnel topology |

Optional `--download-traffic` flag imports NYC DOT traffic volume data into `traffic_volumes` table and sets `edges.traffic_factor`.

## Routing Algorithm

All routing uses **pgr_trsp** (Turn-Restricted Shortest Path), which finds the lowest-cost path while respecting turn restrictions at grade-separated intersections (bridges, tunnels, overpasses).

**Mode-specific behavior:**
- **Drive**: Respects one-way streets, turn restrictions, optional traffic factor adjustment
- **Bike**: Uses bikeable edges (includes ferry routes), applies bike-specific turn restrictions
- **Walk**: Uses walkable edges, no turn restrictions (pedestrians unrestricted)

**Traffic-aware routing** (drive mode only): When `use_traffic=true`, costs are multiplied by `traffic_factor` — a value derived from real-time TRANSCOM speed data (`posted_speed / observed_speed`). Values > 1.0 indicate congestion. Fallback: `COALESCE(traffic_factor, 1.0)`.

**Isochrones** use `pgr_drivingDistance` to find all reachable edges within time thresholds (5/10/15/20 min), then `ST_ConcaveHull` to generate boundary polygons. An edge-based mode returns per-street geometries with band assignments.

## Key SQL Functions

**Node snapping** — Find nearest graph vertex to input coordinates:
- `getnearestdrivenode(lon, lat)`, `getnearestbikenode()`, `getnearestwalknode()`

**Routing** — Return GeoJSON route with turn-by-turn directions:
- `getdrivingroute(orig_lon, orig_lat, dest_lon, dest_lat)`
- `getdrivingroute_with_traffic(...)` — traffic-adjusted costs
- `getbikingroute(...)`, `getwalkingroute(...)`

**Isochrones** — Return reachability polygons or edge geometries:
- `getdrivingisochrone(lon, lat, intervals, ...)` + bike/walk variants

All functions are defined in `data-importer/src/sql/05_functions.sql`.

## Database Schema

**`edges`** — Street segments as a directed graph. Key fields:
- `source`, `target` — graph node IDs (foreign key to `edges_vertices_pgr`)
- `cost_drive`, `cost_bike`, `cost_walk` — forward traversal cost (seconds)
- `reverse_cost_drive`, `reverse_cost_bike`, `reverse_cost_walk` — reverse traversal cost (-1 = one-way)
- `traffic_factor` — congestion multiplier (NULL = no data, 1.0 = free flow)
- `driveable`, `bikeable`, `walkable` — boolean mode flags
- `street`, `geom` — street name and PostGIS geometry

**`edges_vertices_pgr`** — Graph vertices (intersections). Created by `pgr_createTopology`.

**`restrictions`** — Turn restriction table for pgr_trsp. Generated from LION's grade-separation fields.

**`traffic_volumes`** — Static NYC DOT traffic counts per street segment.
