# Codebase Structure

**Analysis Date:** 2026-02-12

## Directory Layout

```
/Users/ishiland/Code/nyc-open-routing/
├── api/                           # FastAPI backend service (Python 3.11)
│   ├── main.py                    # FastAPI app creation and middleware setup
│   ├── dependencies.py            # Singleton instance factory functions (DI)
│   ├── config/
│   │   └── settings.py            # Pydantic Settings with env vars and logging config
│   ├── routes/                    # HTTP endpoint handlers
│   │   ├── routing.py             # GET /api/route endpoint
│   │   ├── search.py              # GET /api/search endpoint
│   │   └── health.py              # Health check endpoint
│   ├── services/                  # Business logic layer
│   │   ├── routing.py             # RoutingService (route calculation, caching)
│   │   └── search.py              # SearchService (Geosupport integration)
│   ├── models/
│   │   └── schemas.py             # Pydantic models (TravelMode, RouteResponse, etc.)
│   ├── utils/                     # Utility functions
│   │   ├── geo.py                 # Coordinate parsing, WKB to GeoJSON conversion
│   │   ├── cache.py               # Route result caching (LRU)
│   │   ├── retry.py               # Retry decorator for transient failures
│   │   └── clock.py               # Timezone-aware clock for traffic timing
│   ├── middleware/
│   │   └── logging.py             # Request logging middleware
│   ├── exceptions.py              # Domain exception classes
│   ├── sql/
│   │   └── routing.sql            # SQL query snippets (runtime loaded, not used)
│   ├── tests/                     # pytest test suite
│   │   ├── test_services.py       # Service unit tests
│   │   ├── test_routes.py         # Route handler tests
│   │   ├── test_health.py         # Health endpoint tests
│   │   ├── test_utils.py          # Utility function tests
│   │   ├── test_cache.py          # Cache tests
│   │   ├── test_smoke.py          # Integration tests (requires db)
│   │   └── conftest.py            # pytest fixtures
│   ├── requirements.txt           # Python dependencies
│   ├── pyproject.toml             # Build config, dependencies
│   ├── Dockerfile                 # Container image definition
│   ├── Makefile                   # lint, format, test commands
│   ├── pytest.ini                 # pytest configuration
│   ├── entrypoint.sh              # Container startup script (installs Geosupport)
│   └── gde/                       # Geosupport bin (large, committed to git)
│
├── client/                        # React frontend service (Node 23, Vite, TypeScript)
│   ├── src/
│   │   ├── main.tsx               # React root entry point
│   │   ├── App.tsx                # Main App component with context providers
│   │   ├── contexts/              # React Context providers
│   │   │   ├── RoutingContext.tsx # Route state (addresses, mode, traffic, cache)
│   │   │   ├── MessageContext.tsx # Toast notification state
│   │   │   └── MapInstanceContext.tsx # MapLibre GL map reference
│   │   ├── components/
│   │   │   ├── Sidebar.tsx        # Left sidebar container
│   │   │   ├── ControlsContainer.tsx # Control inputs wrapper
│   │   │   ├── MapLibreGLMap.tsx  # MapLibre GL map component
│   │   │   ├── RouteStateManager.tsx # URL sync + auto-fetch on load
│   │   │   ├── controls/          # Routing control inputs
│   │   │   │   ├── Search.tsx     # Address search component (debounced)
│   │   │   │   ├── SuggestionDropdown.tsx # Search result list
│   │   │   │   ├── TravelModeSelect.tsx # Drive/bike/walk selector
│   │   │   │   ├── TrafficToggle.tsx # Enable/disable traffic routing
│   │   │   │   ├── FerryToggle.tsx # Avoid ferries toggle
│   │   │   │   ├── TimeSelector.tsx # Hour/day-of-week picker for traffic
│   │   │   │   ├── RouteList.tsx  # Turn-by-turn instructions list
│   │   │   │   ├── RouteSummaryCard.tsx # Distance/time summary
│   │   │   │   ├── ButtonControls.tsx # Swap, clear, calculate buttons
│   │   │   │   ├── MapControls.tsx # Zoom/fit buttons
│   │   │   │   └── ZoomToRouteButton.tsx # Zoom to route bounds
│   │   │   ├── shared/            # Reusable UI components
│   │   │   │   ├── ErrorFallback.tsx # React error boundary fallback
│   │   │   │   ├── LoadingSpinner.tsx # Loading indicator
│   │   │   │   ├── Message.tsx    # Toast notification display
│   │   │   │   ├── TurnIcon.tsx   # SVG turn direction icon
│   │   │   │   ├── TitleBar.tsx   # Header with app title
│   │   │   │   ├── InfoModal.tsx  # Modal for info/about
│   │   │   │   ├── DismissibleBanner.tsx # Dismissible notification banner
│   │   │   │   └── SkipLink.tsx   # Accessibility skip-to-content link
│   │   │   ├── layouts/
│   │   │   │   └── AdaptiveLayout.tsx # Responsive sidebar/map layout
│   │   │   └── mobile/
│   │   │       └── BottomSheet.tsx # Mobile-only controls drawer
│   │   ├── hooks/                 # Custom React hooks
│   │   │   ├── useRouteFetch.ts   # Fetch route from API
│   │   │   ├── useRouteStateSync.ts # Sync routing context ↔ URL params
│   │   │   ├── useGeoJsonLayer.ts # Render route GeoJSON on map
│   │   │   ├── useMapInit.ts      # Initialize MapLibre GL map
│   │   │   ├── useMapZoom.ts      # Zoom and fit bounds
│   │   │   ├── useDebouncedFetch.ts # Debounce search input
│   │   │   ├── useResponsive.ts   # Detect mobile/tablet/desktop
│   │   │   ├── useGeolocation.ts  # Browser geolocation
│   │   │   ├── useLocalStorage.ts # localStorage wrapper
│   │   │   ├── useKeyboardNavigation.ts # Keyboard shortcuts
│   │   │   └── useAutofillPrevention.ts # Browser autofill handling
│   │   ├── types/
│   │   │   └── interfaces.ts      # TypeScript interfaces (GeoJSON, Route, Address, etc.)
│   │   ├── utils/
│   │   │   ├── search.tsx         # Fetch search suggestions from API
│   │   │   ├── coordinates.ts     # Coordinate validation/formatting
│   │   │   ├── theme.ts           # MUI theme customization
│   │   │   └── ...                # Other utilities
│   │   ├── testUtils/             # Test fixtures and helpers
│   │   └── App.test.tsx           # App component integration test
│   ├── public/                    # Static assets
│   ├── dist/                      # Built production bundle (generated)
│   ├── package.json               # npm dependencies
│   ├── tsconfig.json              # TypeScript configuration
│   ├── tsconfig.node.json         # TypeScript config for build tools
│   ├── vite.config.ts             # Vite bundler configuration
│   ├── Dockerfile                 # Container image definition
│   └── TESTING.md                 # Test documentation
│
├── data-importer/                 # One-time database initialization scripts
│   ├── import-lion.sh             # Main import orchestrator (Bash)
│   └── src/
│       └── sql/                   # Numbered SQL phases (01-09)
│           ├── 01_edges.sql       # Create edges/vertices from LION data
│           ├── 02_travel_time.sql # Calculate travel times per mode
│           ├── 03_cost.sql        # Calculate routing costs from times
│           ├── 04_restrictions.sql # Create turn restriction tables
│           ├── 05_functions.sql   # Create pgRouting function wrappers
│           ├── 06_performance_indexes.sql # Create optimized indexes
│           ├── 07_vertex_accessibility.sql # Mark walkable/bikeable vertices
│           ├── 08_cached_geometries.sql # Cache geometries for performance
│           └── 09_ferry_connections.sql # Add ferry routing edges
│
├── docker/
│   └── dev/
│       ├── api.Dockerfile        # API container image
│       ├── client.Dockerfile     # Client container image
│       └── .env                  # Environment variables (db creds, hosts)
│
├── docker-compose.yml            # Service orchestration config
├── .env                          # Root .env (minimal, most in docker/dev/.env)
├── Dockerfile                    # Root Dockerfile (deprecated, use docker/dev/)
├── CLAUDE.md                     # Project instructions for Claude
├── readme.md                     # Project overview
└── docs/                         # Additional documentation
    ├── PERFORMANCE_BASELINE.md
    ├── PERFORMANCE_OPTIMIZATION_PLAN.md
    ├── IMPLEMENTATION_COMPLETE.md
    ├── UX_ENHANCEMENTS_SUMMARY.md
    ├── TRAFFIC_DATA_ANALYSIS.md
    └── ...
```

## Directory Purposes

**`api/`:**
- Purpose: FastAPI backend service for routing and address search
- Contains: Route handlers, services, utilities, tests, database access layer
- Key files: `main.py` (app creation), `dependencies.py` (DI), `routes/*.py` (endpoints), `services/*.py` (business logic)

**`api/routes/`:**
- Purpose: HTTP endpoint handlers with parameter validation
- Contains: APIRouter definitions, Pydantic request/response models
- Key files: `routing.py` (GET /api/route), `search.py` (GET /api/search), `health.py` (GET /api/health)

**`api/services/`:**
- Purpose: Business logic isolated from HTTP concerns
- Contains: RoutingService (route calculation + caching), SearchService (Geosupport integration)
- Key files: `routing.py` (mode-specific routing, traffic handling), `search.py` (address autocomplete with retry)

**`api/utils/`:**
- Purpose: Infrastructure and utility functions
- Contains: Coordinate parsing, WKB geometry conversion, LRU cache, retry decorator, timezone clock
- Key files: `geo.py` (coordinate validation), `cache.py` (route caching), `retry.py` (backoff logic), `clock.py` (traffic timing)

**`api/models/`:**
- Purpose: Data validation and serialization schemas
- Contains: Pydantic BaseModel definitions
- Key files: `schemas.py` (TravelMode enum, Properties, Feature, RouteResponse models)

**`api/config/`:**
- Purpose: Centralized configuration and dependency injection
- Contains: Pydantic Settings class, singleton instance factories
- Key files: `settings.py` (env vars), `dependencies.py` (service/db instance creation)

**`api/tests/`:**
- Purpose: pytest unit and integration test suite
- Contains: Tests for services, routes, utilities
- Key files: `test_services.py` (RoutingService, SearchService), `test_routes.py` (endpoint tests), `conftest.py` (fixtures)

**`api/middleware/`:**
- Purpose: Request/response middleware
- Contains: Request logging, CORS handling (in main.py)
- Key files: `logging.py` (RequestLoggingMiddleware)

**`client/src/`:**
- Purpose: React frontend with TypeScript
- Contains: Components, hooks, contexts, utilities, types

**`client/src/contexts/`:**
- Purpose: React Context providers for global state
- Contains: RoutingContext (routing state), MessageContext (toasts), MapInstanceContext (map ref)
- Key files: `RoutingContext.tsx` (address, mode, traffic, ferry settings), `MessageContext.tsx` (notifications), `MapInstanceContext.tsx` (map reference)

**`client/src/components/controls/`:**
- Purpose: Routing control input components
- Contains: Form inputs for addresses, mode, traffic, ferry, time
- Key files: `Search.tsx` (address autocomplete), `TravelModeSelect.tsx` (drive/bike/walk), `TrafficToggle.tsx`, `TimeSelector.tsx` (hour/day picker), `RouteList.tsx` (turn-by-turn)

**`client/src/components/shared/`:**
- Purpose: Reusable UI components
- Contains: ErrorBoundary fallback, spinners, modals, icons, notifications
- Key files: `ErrorFallback.tsx`, `LoadingSpinner.tsx`, `Message.tsx`, `TurnIcon.tsx`

**`client/src/components/layouts/`:**
- Purpose: Responsive layout wrappers
- Contains: AdaptiveLayout (sidebar + map, responsive)
- Key files: `AdaptiveLayout.tsx` (mobile/tablet/desktop responsive)

**`client/src/hooks/`:**
- Purpose: Custom React hooks for side effects and logic reuse
- Contains: Data fetching, state sync, map interactions, responsive detection, localStorage
- Key files: `useRouteFetch.ts` (fetch route API), `useRouteStateSync.ts` (URL ↔ context sync), `useGeoJsonLayer.ts` (render on map), `useDebouncedFetch.ts` (search debounce)

**`client/src/types/`:**
- Purpose: TypeScript interfaces and type definitions
- Contains: GeoJSON types, Route, Address, Component props
- Key files: `interfaces.ts` (all TypeScript types)

**`data-importer/`:**
- Purpose: One-time database initialization (not part of runtime)
- Contains: Bash orchestrator, SQL phases
- Key files: `import-lion.sh` (main entry), `src/sql/*.sql` (9 phases)

**`docker/dev/`:**
- Purpose: Development Docker configuration
- Contains: Dockerfiles for API and client, environment variables
- Key files: `api.Dockerfile`, `client.Dockerfile`, `.env`

**`docs/`:**
- Purpose: Project documentation (not code, not architecture)
- Contains: Implementation notes, performance analysis, UX enhancements, traffic data analysis

## Key File Locations

**Entry Points:**
- `api/main.py`: FastAPI app creation, middleware setup, router registration
- `client/src/main.tsx`: React root mount, theme provider, context providers
- `docker-compose.yml`: Service orchestration (db, api, client startup)

**Configuration:**
- `api/config/settings.py`: Environment variables, logging config, database URI
- `api/dependencies.py`: Singleton instance factories (db engine, services, Geosupport)
- `docker/dev/.env`: Environment variables for containers (db creds, hosts)

**Core Logic:**
- `api/services/routing.py`: Route calculation, mode-specific logic, caching
- `api/services/search.py`: Address autocomplete with Geosupport
- `client/src/contexts/RoutingContext.tsx`: Global routing state management
- `client/src/hooks/useRouteFetch.ts`: API integration for route fetching

**Testing:**
- `api/tests/`: pytest test files
- `client/src/testUtils/`: Vitest fixtures and helpers
- `api/conftest.py`: pytest configuration and fixtures
- `api/pytest.ini`: pytest settings

## Naming Conventions

**Files:**

**Python:**
- Lowercase with underscores: `routing.py`, `geo_utils.py`, `test_services.py`
- Test files: `test_*.py` or `*_test.py`

**TypeScript/React:**
- PascalCase for components: `Search.tsx`, `RouteList.tsx`, `ErrorFallback.tsx`
- camelCase for hooks: `useRouteFetch.ts`, `useResponsive.ts`
- camelCase for utilities: `coordinates.ts`, `theme.ts`
- lowercase for non-component TypeScript: `interfaces.ts`, `constants.ts`

**Directories:**

**Backend:**
- Lowercase plural for collections: `routes/`, `services/`, `utils/`, `models/`, `tests/`, `middleware/`
- Category-specific: `config/` for settings, `sql/` for SQL files

**Frontend:**
- Lowercase plural collections: `components/`, `contexts/`, `hooks/`, `types/`, `utils/`
- Feature subdirectories: `controls/` (routing inputs), `shared/` (reusable), `layouts/` (page structure), `mobile/` (mobile-specific)

## Where to Add New Code

**New Routing Feature (e.g., toll avoidance):**
- Primary code: `api/services/routing.py` → add method like `get_driving_route_no_tolls()`
- API endpoint: `api/routes/routing.py` → add query parameter, conditional logic to select service method
- Frontend control: `client/src/components/controls/` → new toggle component (e.g., `TollToggle.tsx`)
- State: `client/src/contexts/RoutingContext.tsx` → add state variable `avoidTolls` with localStorage persistence
- Tests: `api/tests/test_services.py` → test new service method; `client/src/` → test new component/hook

**New Mode (e.g., transit/public transit):**
- Database: `data-importer/src/sql/05_functions.sql` → create `gettransitroute()` SQL function
- Service: `api/services/routing.py` → add `get_transit_route()` method
- Schema: `api/models/schemas.py` → add `TRANSIT = "transit"` to TravelMode enum
- Endpoint: `api/routes/routing.py` → add conditional branch in route handler
- Frontend selector: `client/src/components/controls/TravelModeSelect.tsx` → add TRANSIT option
- Context: `client/src/contexts/RoutingContext.tsx` → mode state already supports any TravelMode string

**New Component (e.g., RouteDetails modal):**
- Location: Determine by purpose:
  - Input control: `client/src/components/controls/RouteDetailsModal.tsx`
  - Shared UI: `client/src/components/shared/RouteDetailsModal.tsx`
  - Page layout: `client/src/components/layouts/RouteDetailsPanel.tsx`
- Type definitions: Add interfaces to `client/src/types/interfaces.ts` if new data structure
- Integration: Import in parent component (e.g., Sidebar.tsx) and pass props

**New Utility Function (e.g., formatDistance):**
- Location: `client/src/utils/` if frontend, `api/utils/` if backend
- Naming: camelCase function name: `formatDistance(meters: number): string`
- Tests: `api/tests/test_utils.py` (backend) or alongside component using it (frontend)

**New Custom Hook (e.g., useRouteDistance):**
- Location: `client/src/hooks/useRouteDistance.ts`
- Pattern: Export default function `export default function useRouteDistance() { ... }`
- Tests: Co-locate test file `client/src/hooks/useRouteDistance.test.ts` or in testUtils

**New Database Schema Change (e.g., add pollution_factor column):**
- Not recommended for runtime code (only use in one-time import)
- If necessary: Add SQL migration script to `data-importer/src/sql/` with next version number (e.g., `10_pollution_factor.sql`)
- Document in `data-importer/README.md`

## Special Directories

**`api/gde/`:**
- Purpose: Geosupport binary and supporting files
- Generated: No (committed to git, large ~400MB due to Geosupport data)
- Committed: Yes, required for `python-geosupport` library to work
- Note: Pre-installed by `api/entrypoint.sh` in container

**`client/dist/`:**
- Purpose: Built production React bundle
- Generated: Yes (`npm run build` outputs here)
- Committed: No (.gitignored)

**`api/.pytest_cache/`:**
- Purpose: pytest caching directory
- Generated: Yes (auto-created by pytest)
- Committed: No (.gitignored)

**`data-importer/data/`:**
- Purpose: Source LION shapefiles and traffic data (not code)
- Generated: No (pre-downloaded)
- Committed: No (.gitignored, large files ~GB)

**`.planning/codebase/`:**
- Purpose: Generated GSD codebase analysis documents
- Generated: Yes (by /gsd:map-codebase command)
- Committed: Yes

---

*Structure analysis: 2026-02-12*
