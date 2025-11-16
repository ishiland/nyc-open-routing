# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NYC Open Routing** is a proof-of-concept routing application for New York City that provides multi-modal routes (driving, walking, biking) using authoritative NYC data sources. The system uses pgRouting for routing calculations and NYC's LION (Linear Integrated Ordered Network) dataset as the street network foundation.

**Status**: Proof of concept - not intended for production/real-world routing scenarios.

**Tech Stack**:
- **Backend**: FastAPI (Python 3.11) with SQLAlchemy
- **Frontend**: React 18 + TypeScript + Vite + Material-UI + MapLibre GL
- **Database**: PostgreSQL 17 with PostGIS + pgRouting extensions
- **Infrastructure**: Docker Compose (3 services: client, api, database)

## Development Commands

### Initial Setup
```bash
# Build and start all services
docker-compose build
docker-compose up -d

# Import LION street data (required on first run)
docker compose exec api sh /data-imports/import-lion.sh 25a

# Import with traffic data (optional)
docker compose exec api sh /data-imports/import-lion.sh 25a --download-traffic
```

### API Development
```bash
# Run API service
docker-compose up api

# Run tests
docker compose exec api pytest

# Run tests with coverage
docker compose exec api pytest --cov=api

# Run specific test file
docker compose exec api pytest api/tests/test_routing.py

# Run smoke tests (end-to-end integration tests)
docker compose exec api pytest api/tests/test_smoke.py -v

# Run smoke tests without conftest (if Geosupport issues)
docker compose exec api pytest api/tests/test_smoke.py --noconftest -v

# Lint and format
docker compose exec api make lint
docker compose exec api make format
```

### Client Development
```bash
# Development server (hot reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint and format
npm run lint:check
npm run lint:fix
npm run format
```

### Database Operations
```bash
# Access database shell
docker compose exec db psql -U postgres -d routing

# Reset database (WARNING: destroys all data)
docker compose down -v
docker compose up -d
```

## Architecture Overview

### System Architecture
Three-tier microservices architecture:
- **Client** (React/Vite) - Port 3001
- **API** (FastAPI) - Port 5001
- **Database** (PostgreSQL+PostGIS+pgRouting) - Port 5433

### API Structure
The API follows a service layer pattern with dependency injection:

```
api/
├── routes/          # API endpoints (routing.py, search.py)
├── services/        # Business logic layer
├── models/          # Pydantic schemas for validation
├── utils/           # Utility functions (geo.py, clock.py)
├── config/          # Centralized settings
└── main.py          # Application entry point
```

**Note**: The legacy monolithic `app.py` is being refactored into this modular structure.

**API Endpoints**:
- `GET /api/route?orig={lon,lat}&dest={lon,lat}&mode={drive|bike|walk}&use_traffic={true|false}` - Calculate route
  - `use_traffic` (optional, default: true): Enable/disable traffic-aware routing for drive mode
- `GET /api/search?address={query}` - Search addresses with autocomplete
- Docs: http://localhost:5001/api/docs (Swagger UI)

### Frontend Structure
React application using Context API for state management:

**Key Contexts**:
- `AddressContext` - Address search state
- `RouteContext` - Route data and calculations
- `MapContext` - MapLibre GL instance management
- `TravelModeContext` - Travel mode selection (drive/bike/walk)

Components organized in `client/src/components/`:
- `controls/` - UI controls (Search, Sidebar, etc.)
- `map/` - Map-related components
- `shared/` - Reusable components

### Database Schema
Graph-based network model for routing:

**Core Tables**:
- `edges` - Street segments with routing costs per mode
- `edges_vertices_pgr` - Network nodes (intersections)
- `restrictions` - Turn restrictions for grade-separated roads
- `traffic_volumes` - Traffic count data (optional)
- `lion` - Raw LION import data

**Views**:
- `restrictions_for_routing` - Formatted restrictions for pgr_trsp (DRY principle)
  - Returns `path` (BIGINT[] array of [from_edge, to_edge]) and `cost` (penalty value)
  - Used by all routing functions to enforce turn restrictions

**Edge Table Key Fields**:
- `source`, `target` - Node IDs for graph connectivity
- `cost_drive`, `cost_bike`, `cost_walk` - Forward direction costs
- `rcost_drive`, `rcost_bike`, `rcost_walk` - Reverse direction costs
- `time_drive`, `time_bike`, `time_walk` - Travel times by mode
- `traffic_factor` - Dynamic traffic multiplier (1.0 = no traffic impact)
- `level_from`, `level_to` - Vertical topology for grade-separated roads
- `driveable`, `bikeable`, `walkable` - Mode-specific accessibility flags

**Routing Functions** (in database):
- Mode-specific node snapping:
  - `getnearestdrivenode(lon, lat)` - Find closest node with driveable edges
  - `getnearestbikenode(lon, lat)` - Find closest node with bikeable edges
  - `getnearestwalknode(lon, lat)` - Find closest node with walkable edges
- Routing calculation:
  - `getdrivingroute(orig_lat, orig_lon, dest_lat, dest_lon)` - Calculate driving route without traffic
  - `getdrivingroute_with_traffic(orig_lat, orig_lon, dest_lat, dest_lon, hour, day_of_week)` - Traffic-aware driving route
  - `getbikingroute(orig_lat, orig_lon, dest_lat, dest_lon)` - Calculate biking route
  - `getwalkingroute(orig_lat, orig_lon, dest_lat, dest_lon)` - Calculate walking route

## Data Import Pipeline

The import pipeline (`/data-importer/import-lion.sh` + `create_network.py`) executes these steps:

1. **Download LION Data** - Fetches NYC LION geodatabase from NYC DCP (version-specific, e.g., 25a)
2. **Import to PostgreSQL** - Uses `ogr2ogr` to load FileGDB into PostgreSQL
3. **Create Edges Table** - Filter and prepare routable street segments (excludes generic/faux segments)
4. **Calculate Travel Times** - Mode-specific speeds (walk: 3mph, bike: 12mph, drive: posted limits)
5. **Calculate Costs** - Routing costs based on distance, time, and mode restrictions
6. **Build Topology** - Uses `pgr_createTopology()` with parallel processing (batches of 500 segments)
7. **Create Turn Restrictions** - Analyzes grade-separated intersections using level fields
8. **Create Routing Functions** - SQL functions for route calculation and turn-by-turn directions
9. **Import Traffic Data** (optional) - Downloads NYC traffic volumes and calculates time-of-day factors

**Performance**: Full import takes 10-30 minutes. Topology creation is the most intensive step and is parallelized.

**SQL Files** (in `/data-importer/src/sql/`):
- `01_edges.sql` - Create edges from LION data
- `02_travel_time.sql` - Calculate travel times
- `03_cost.sql` - Calculate routing costs
- `04_restrictions.sql` - Create turn restrictions
- `05_functions.sql` - Create routing functions

## Key Technical Details

### Routing Algorithm
Uses **pgr_trsp** (Turn-Restricted Shortest Path) from pgRouting, which handles:
- One-way streets (via directional costs)
- Turn restrictions at grade-separated intersections
- Mode-specific accessibility (sidewalks for walking, bike lanes, driveways)

### Turn Restrictions
The system handles grade-separated roads (overpasses/underpasses) using LION's `nodelevelf` and `nodelevelt` fields. Restrictions are **mode-specific** and prevent impossible turns at grade-separated intersections.

**How it Works:**
- When edges connect at a node but are at different vertical levels (e.g., street below, highway above), a turn restriction is created
- Restrictions are filtered by travel mode to match real-world constraints:
  - **Driving**: All driveable-edge restrictions apply (vehicles need ramps to change levels)
  - **Biking**: Subset where both edges are bikeable (bikes can use some separated paths)
  - **Walking**: NO restrictions (pedestrians can use stairs, overpasses, underpasses)

**Generic Segments:** LION segments marked with `*` (asterisk) NodeLevel are non-physical geometry (e.g., divided highway centerlines). These are excluded from restriction generation by setting their levels to NULL.

**Excluded from Restrictions:**
- Ramps (RW_Type='9') - These are valid level transitions
- Ferries (FeatureTyp='F') - Already have high cost penalties
- Generic segments (NodeLevel='*') - Non-physical geometry

**Database Views:**
- `restrictions_for_driving` - Driveable edges only
- `restrictions_for_biking` - Bikeable edges only
- `restrictions_for_walking` - Empty (pedestrians unrestricted by vertical separation)

**Troubleshooting:** If walking/biking routes fail unexpectedly, check that mode-specific views are being used in routing functions (05_functions.sql). If all modes show "No route found" for valid paths, restrictions may be over-aggressive - check that ramps and generic segments are properly excluded.

### NYC Geosupport Integration
Uses `python-geosupport` library (v1.1.0) with `geosupport-suggest` (v0.1.0) for authoritative NYC address geocoding and autocomplete. This provides official NYC addresses validated against the city's master address database.

**Installation**: Geosupport Desktop Edition (GDE) is automatically downloaded and installed at container startup via [api/entrypoint.sh](api/entrypoint.sh). The installation:
- Downloads NYC DCP's official GDE distribution for the version specified in `DEFAULT_GEOSUPPORT`
- Extracts data files to `/home/api/gde/version-{VERSION}_{RELEASE}/`
- Sets required environment variables (`GEOFILES`, `LD_LIBRARY_PATH`)
- Persists across container restarts via Docker volume mount

**Address Search Implementation**:
- Service layer: [api/services/search.py](api/services/search.py)
- Dependency injection: Singleton `Geosupport` and `GeosupportSuggest` instances in [api/dependencies.py](api/dependencies.py)
- Features:
  - Autocomplete suggestions for NYC addresses
  - Retry logic with exponential backoff (3 attempts, configurable)
  - User-friendly error message mapping
  - Structured logging with timing metrics
  - Health check verification at `/api/v1/ready`

**Frontend Cache**: Search results cached in sessionStorage with:
- 1-hour TTL (configurable via `cacheTTL` prop)
- LRU eviction when cache exceeds 100 entries (configurable via `cacheMaxSize`)
- Automatic expiration and cleanup

### Traffic Data
Optional traffic integration matches NYC traffic volume data to street segments. Traffic factors are **static values** calculated from historical traffic volume averages and stored in the edges table. They are applied as cost multipliers during routing.

**Important**: Traffic factors are **not time-aware**. The same factor is used regardless of time of day or day of week. This is a POC limitation - implementing true time-dependent routing would require significant architectural changes and would degrade performance by ~36x.

**Importing Traffic Data**: Traffic data is NOT imported by default. To enable traffic-aware routing:
```bash
# Import LION data with traffic volumes
docker compose exec api sh /data-imports/import-lion.sh 25a --download-traffic
```

Without the `--download-traffic` flag, the `traffic_factor` column will exist in the edges table but will have default values of 1.0 (no traffic impact).

**Traffic Factor Values** (static, based on historical average volume):
- `1.0` - No traffic data available (default)
- `1.2` - Light traffic (avg volume > 0, ≤25th percentile)
- `1.5` - Medium traffic (avg volume > 25th percentile, ≤50th percentile)
- `2.0` - Heavy traffic (avg volume > 50th percentile, ≤75th percentile)
- `3.0` - Very heavy traffic (avg volume > 75th percentile)

**Traffic Toggle**: The `use_traffic` API parameter (default: true) allows switching between traffic-aware and non-traffic routing per request:
- `use_traffic=true`: Uses `getdrivingroute_with_traffic()` which applies static `traffic_factor` multipliers
- `use_traffic=false`: Uses `getdrivingroute()` which ignores traffic (effectively treats all factors as 1.0)

The service layer automatically falls back to non-traffic routing if traffic data is unavailable. Cache keys differentiate between traffic and non-traffic routes via mode suffix (`drive-traffic` vs `drive-no-traffic`).

**Validation**: The routing service logs a warning when `use_traffic=true` but all `traffic_factor` values are 1.0, indicating that traffic data has not been imported. Both routing functions (`getdrivingroute` and `getdrivingroute_with_traffic`) return `traffic_factor` in their result sets for consistency.

## Configuration

**Environment Variables**: `/docker/dev/.env`
- `DEFAULT_LION` - LION version to import (e.g., 25a)
- `DEFAULT_GEOSUPPORT` - Geosupport version
- Database credentials and connection settings
- `CHOKIDAR_USEPOLLING=true` - Required for Docker file watching

**Application Config**: [api/config/settings.py](api/config/settings.py)
- `GEOSUPPORT_TIMEOUT` - Timeout for Geosupport operations (default: 5 seconds)
- `SEARCH_CACHE_TTL` - Frontend cache TTL (default: 3600 seconds / 1 hour)
- `SEARCH_CACHE_MAX_SIZE` - Maximum cache entries (default: 100)
- `SEARCH_MAX_RETRIES` - Maximum retry attempts for Geosupport (default: 3)
- `SEARCH_RETRY_BACKOFF_BASE` - Base backoff delay for retries (default: 1.0 second)

**Other Configs**:
- Client build: [client/vite.config.ts](client/vite.config.ts)
- Test configs: [api/pytest.ini](api/pytest.ini), [client/vitest.config.ts](client/vitest.config.ts)

**No Secrets Management**: Currently uses plain environment variables. Do not commit sensitive credentials.

## Important Context

### Current Development State
Active refactoring from monolithic [api/app.py](api/app.py) to modular structure with separate routes, services, and models. The new structure is in [api/routes/](api/routes/), [api/services/](api/services/), and [api/models/](api/models/).

### Performance Considerations
- Database uses spatial indexes (GIST) on geometry columns
- Topology creation is CPU-intensive and parallelized across cores
- Connection pooling via SQLAlchemy
- Batch processing for large operations (500 segments at a time)

### Testing Strategy
The project uses a multi-layered testing approach:

**Unit Tests** ([api/tests/](api/tests/)):
- `test_routes.py` - Route endpoint validation with mocked services
- `test_services.py` - Service layer business logic with mocked database
- `test_utils.py` - Utility function testing (geo parsing, validation)
- `test_cache.py` - Route caching functionality
- `test_health.py` - Health check endpoints

**Integration Tests** ([api/tests/test_smoke.py](api/tests/test_smoke.py)):
- End-to-end smoke tests using real HTTP requests and database
- Tests all travel modes (drive, bike, walk)
- Validates traffic toggle functionality
- Cross-borough routing scenarios
- Edge cases and error handling
- Marked with `@pytest.mark.integration` and `@pytest.mark.slow`
- Requires running API service and imported LION data

**Running Tests**:
```bash
# Unit tests (fast, mocked)
docker compose exec api pytest -v

# Integration tests (slower, requires database)
docker compose exec api pytest api/tests/test_smoke.py -v --noconftest

# All tests with coverage
docker compose exec api pytest --cov=api
```

### Recent Improvements
**Traffic Toggle** (2025-01):
- Added `use_traffic` API parameter for per-request traffic control
- Automatic fallback mechanism when traffic data unavailable
- Service layer conditional function selection
- Cache differentiation via hour/day_of_week parameters

**Turn Restrictions** (2025-01):
- Fixed restriction logic bugs in [04_restrictions.sql](data-importer/src/sql/04_restrictions.sql)
- Created `restrictions_for_routing` view to eliminate duplication across routing functions
- Added UNIQUE constraint to prevent duplicate restrictions
- Improved grade separation handling

**Mode-Aware Node Snapping** (2025-01):
- Replaced generic `getnearestnode()` with mode-specific functions
- Prevents invalid routing (e.g., driving route starting on pedestrian-only path)
- Functions: `getnearestdrivenode()`, `getnearestbikenode()`, `getnearestwalknode()`

**Comprehensive Testing** (2025-01):
- Added end-to-end integration tests ([test_smoke.py](api/tests/test_smoke.py))
- 10 smoke tests covering all modes, traffic toggle, cross-borough routing
- Real HTTP requests to validate complete request lifecycle

**Traffic Factor Implementation** (2025-01):
- Initialized `traffic_factor` column in edge creation (always exists with default 1.0)
- Standardized `getdrivingroute()` to return `traffic_factor` (consistent with traffic-aware function)
- Added validation logging when traffic routing is requested but no data is available
- Added comprehensive test coverage for `traffic_factor` values

### Troubleshooting

**Traffic Factor Always Shows 1.0**

If route results always show `traffic_factor: 1.0`, this indicates that traffic data has not been imported:

**Diagnosis**:
```bash
# Check if traffic_factor column exists and has varied values
docker compose exec db psql -U postgres -d routing -c \
  "SELECT DISTINCT traffic_factor FROM edges ORDER BY traffic_factor;"
```

**Solution**:
```bash
# Re-import LION data with traffic volumes
docker compose exec api sh /data-imports/import-lion.sh 25a --download-traffic
```

**Expected Output**: If traffic data is properly imported, you should see multiple distinct values: 1.0, 1.2, 1.5, 2.0, 3.0

**Note**: The API will log a warning message when traffic routing is requested but all `traffic_factor` values are 1.0:
```
WARNING: Traffic routing requested but no traffic data available (all traffic_factor=1.0).
Run import with --download-traffic flag to enable traffic-aware routing.
```

### Future Enhancements
From README, planned improvements include:
- Live traffic data integration (currently using static traffic volumes)
- Public transit routing with MTA data
- Ferry schedule integration
- Travel time isochrones
- Line merging for graph optimization
- Enhanced turn-by-turn directions
