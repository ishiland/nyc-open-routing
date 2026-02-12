# Architecture

**Analysis Date:** 2026-02-12

## Pattern Overview

**Overall:** Multi-tier service architecture with strict separation of concerns across FastAPI backend, React Context-based frontend, and pgRouting spatial database. The system follows a request-response pattern with caching at the service layer and client-side state management through React Context.

**Key Characteristics:**
- Service layer abstraction over database operations (no raw SQL queries in routes)
- Dependency injection for singleton instances (database engine, Geosupport, services)
- Context API for frontend state management with localStorage persistence
- GeoJSON as universal data format between layers
- Route caching at service layer (not HTTP caching)
- Mode-specific routing with traffic awareness (drive only)

## Layers

**Presentation (Client):**
- Purpose: Interactive map UI with routing controls, responsive layout, address search
- Location: `client/src/`
- Contains: React components, hooks, contexts, utilities, type definitions
- Depends on: API via HTTP fetch, browser APIs (localStorage, geolocation)
- Used by: End users via browser

**API Route Handlers (FastAPI):**
- Purpose: HTTP endpoint definitions with parameter validation and error mapping
- Location: `api/routes/` (`routing.py`, `search.py`, `health.py`)
- Contains: APIRouter definitions, Pydantic request/response models, Depends() dependency injection
- Depends on: Services layer for business logic
- Used by: Frontend via HTTP requests

**Services (Business Logic):**
- Purpose: Domain logic for routing and search operations, including caching and error handling
- Location: `api/services/` (`routing.py`, `search.py`)
- Contains: RoutingService (mode-specific route calculation), SearchService (NYC Geosupport integration)
- Depends on: Database engine, SQL queries, Geosupport client, utils (geo parsing, cache)
- Used by: Route handlers

**Utilities (Infrastructure):**
- Purpose: Cross-cutting helpers for coordinate parsing, caching, retries, time handling
- Location: `api/utils/` (`geo.py`, `cache.py`, `retry.py`, `clock.py`)
- Contains: Pure functions and helper classes
- Depends on: External libraries (shapely, Geosupport, etc.)
- Used by: Services, routes

**Configuration & Dependencies:**
- Purpose: Centralized configuration, singleton instance management
- Location: `api/config/settings.py`, `api/dependencies.py`
- Contains: Settings class with env var loading, singleton service/database instance creation
- Depends on: Environment, external clients
- Used by: All layers

**Database & SQL:**
- Purpose: pgRouting spatial queries, turn restrictions, traffic factors
- Location: PostgreSQL 17 with PostGIS/pgRouting, SQL functions in database
- Contains: edges table (graph network), vertices, restrictions, traffic data; routing functions: `getdrivingroute()`, `getdrivingroute_with_traffic()`, `getbikingroute()`, `getwalkingroute()`
- Depends on: LION street network data, NYC traffic data (optional)
- Used by: RoutingService via SQLAlchemy

## Data Flow

**Route Calculation Flow:**

1. Frontend: User selects start/end addresses via autocomplete (RoutingContext state)
2. Frontend: User clicks route button → `useRouteFetch` hook triggers
3. Frontend → API: POST to `GET /api/route?orig={lon,lat}&dest={lon,lat}&mode={drive|bike|walk}&use_traffic={bool}`
4. Route Handler: Validates query params, calls RoutingService.get_*_route()
5. RoutingService: Checks route cache by (orig, dest, mode) key
6. Cache Miss: Parses coordinates → executes SQL function → converts WKB rows to GeoJSON Features
7. Database: pgr_trsp shortest path with mode-specific costs, traffic factors, turn restrictions
8. RoutingService: Formats response as RouteResponse (list of Features) → caches result
9. Route Handler: Returns RouteResponse JSON
10. Frontend: MapLibre GL renders route geometry, RouteList displays turn-by-turn instructions

**Address Search Flow:**

1. Frontend: User types in Search component → `useDebouncedFetch` delays input
2. Frontend → API: GET /api/search?address={query}
3. Search Handler: Passes to SearchService
4. SearchService: Calls Geosupport.suggest() with retry logic
5. Geosupport: Returns NYC address suggestions (blocking operation, runs in thread pool)
6. SearchService: Converts to GeoJSON, adds 'label' property for frontend
7. Frontend: Displays suggestions in SuggestionDropdown, clicking sets start/end address in RoutingContext

**State Synchronization Flow:**

1. RoutingContext stores: startAddress, endAddress, mode, useTraffic, avoidFerries, trafficHour, trafficDayOfWeek
2. RouteStateManager: useRouteStateSync syncs context to URL query params (shareable URLs)
3. On URL load: useRouteStateSync restores context from URL
4. RouteStateManager: Auto-fetches route when both addresses present (enables shared link deep linking)

**State Management:**

- **RoutingContext** (React Context): Centralized routing state (addresses, mode, traffic settings)
- **MessageContext**: Toast notifications for errors/info
- **MapInstanceContext**: MapLibre GL map reference for cross-component access
- **localStorage**: Persistence for useTraffic, avoidFerries, trafficHour, trafficDayOfWeek
- **Route Cache**: Service-layer in-memory cache keyed by (orig, dest, mode-traffic-variant)

## Key Abstractions

**Route Cache:**
- Purpose: Avoid recalculating identical route requests
- Examples: `api/utils/cache.py` → `get_route_cache()` returns LRU cache
- Pattern: Service checks cache before querying database; stores formatted GeoJSON features
- Key structure: `(orig_coord, dest_coord, mode-traffic-variant)` e.g., `"drive-traffic-static"`, `"bike"`, `"walk-no-ferry"`

**Geosupport Service:**
- Purpose: Singleton NYC address geocoder/autocompleter (prevents redundant initialization)
- Examples: `api/dependencies.py` stores `_geosupport` and `_geosupport_suggest` instances
- Pattern: SearchService receives pre-initialized GeosupportSuggest; uses thread pool for blocking operations
- Async wrapper: Runs synchronous Geosupport in `anyio.to_thread.run_sync()` to prevent event loop blocking

**Mode-Specific Routing:**
- Purpose: Apply different costs/restrictions per travel mode
- Pattern: RoutingService has separate methods `get_driving_route()`, `get_biking_route()`, `get_walking_route()`
- Database side: `edges` table stores mode-specific columns: cost_drive, cost_bike, cost_walk (+ reverse variants), time_* fields, traffic_factor, driveable/bikeable/walkable flags
- Restrictions applied per mode: `restrictions_for_driving`, `restrictions_for_biking` (walking has none)

**Traffic-Aware Routing:**
- Purpose: Optional traffic factor application for drive mode only
- Pattern: Two SQL functions: `getdrivingroute()` (no traffic) vs `getdrivingroute_with_traffic()` (with traffic)
- Time parameters: Service accepts hour (0-23) and day_of_week (1-7 Mon-Sun); passed to SQL
- Cache key variance: Same route gets different cache entries based on time parameters: `drive-traffic-h14-d3`, `drive-traffic-static`, `drive-no-traffic`

**Exception Hierarchy:**
- Purpose: Domain-specific error handling mapped to HTTP status codes
- Pattern: `RoutingError` (base) → `InvalidCoordinatesError` (400), `RouteNotFoundError` (404), `DatabaseError` (500)
- In route handler: Caught by `routing_error_handler()`, mapped to HTTP response with error message and correlation_id

## Entry Points

**API Entry Point:**
- Location: `api/main.py`
- Triggers: Container startup via `docker compose up`
- Responsibilities: FastAPI app creation, middleware setup (CORS, request logging, rate limiting), router registration, exception handler registration

**Frontend Entry Point:**
- Location: `client/src/main.tsx`
- Triggers: Vite dev server or built bundle execution
- Responsibilities: React root mount, theme provider setup, context providers wrapping App component

**Database Entry Point (Data Import):**
- Location: `data-importer/import-lion.sh` → `data-importer/src/sql/01_edges.sql` through `09_ferry_connections.sql`
- Triggers: `docker compose exec api sh /data-imports/import-lion.sh 25a` (manual, one-time)
- Responsibilities: Create edges/vertices tables, compute costs, apply turn restrictions, create routing functions, add indexes, configure ferry connections

## Error Handling

**Strategy:** Layered error handling with domain exceptions at service layer, HTTP mapping at route handler layer, UI toast display at frontend.

**Patterns:**

**Service Layer (api/services/):**
- Raises domain exceptions with message and details dict: `InvalidCoordinatesError("Latitude out of bounds", {"lat": 40.0})`
- Catches database errors, wraps in DatabaseError with context
- Traffic routing falls back gracefully: if traffic_factor column missing, retries without traffic
- Search service: Catches GeosupportError, TimeoutError, wraps in HTTPException with user-friendly messages

**Route Handler Layer (api/routes/):**
- Depends() injects RoutingService, calls mode-specific methods
- HTTPException propagates with status_code (400, 404, 500) and detail message
- Correlation ID from request state attached to error response (for logging)

**Frontend Layer (client/src/):**
- ErrorBoundary wraps App, catches React errors, shows ErrorFallback component with reload button
- useRouteFetch hook: Catches HTTP errors, calls `displayMessage(error_text, 'error')`
- MessageContext: Toast notifications display error/warning/info/success messages

## Cross-Cutting Concerns

**Logging:**
- Backend: Python logging configured in `api/config/settings.py` LOGGING_CONFIG, StreamHandler outputs to console (INFO level by default)
- Middleware: `api/middleware/logging.py` RequestLoggingMiddleware logs request method/path/status
- Frontend: Console.log for debugging, no persistent logs

**Validation:**
- Backend: Pydantic models in `api/models/schemas.py` validate request/response structure; Route handlers validate coords with Query params
- Geo validation: `parse_coordinates()` checks format "lon,lat" and NYC bounds (lat 40.4-40.95, lon -74.3 to -73.7)
- Frontend: Input field types enforce number format for coordinates; Search component prevents empty queries

**Authentication:**
- Not implemented (POC). CORS configured to allow localhost:3001, localhost:3000, client:3000 for development
- No user accounts, no token validation

**Rate Limiting:**
- Backend: slowapi library configured with default 60/minute limit per IP
- Not enforced client-side

---

*Architecture analysis: 2026-02-12*
