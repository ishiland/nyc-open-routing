# Coding Conventions

**Analysis Date:** 2026-02-12

## Naming Patterns

**Files:**
- Python: `snake_case` (e.g., `routing.py`, `parse_coordinates`, `test_services.py`)
- TypeScript/React: `PascalCase` for components (e.g., `Search.tsx`, `RoutingContext.tsx`), `camelCase` for utilities and hooks (e.g., `useRouteFetch.ts`, `formats.ts`)
- Test files: `{name}.test.ts` or `{name}.test.tsx` for unit tests, `test_{name}.py` for Python tests
- Configuration files in project root: lowercase with dots (e.g., `.prettierrc.json`, `.eslintrc.json`)

**Functions:**
- Python: `snake_case` for all functions, methods (e.g., `parse_coordinates()`, `get_driving_route()`, `dump_geo()`)
- TypeScript: `camelCase` for functions and hooks (e.g., `formatDistance()`, `useRouteFetch`, `transformSearchResult()`)
- React components: `PascalCase` for named exports (e.g., `SearchComponent`, `RoutingContextProvider`)
- Private/helper functions in TypeScript: `camelCase` with leading underscore optional (e.g., `transformSearchResult()` is a private const within Search.tsx)

**Variables:**
- Python: `snake_case` (e.g., `orig_lon`, `cache_key_suffix`, `mock_db_engine`)
- TypeScript: `camelCase` (e.g., `startAddress`, `endAddressInput`, `isFetching`)
- React Context state: `camelCase` (e.g., `useTraffic`, `trafficHour`, `setRoute`)
- Constants: `UPPER_SNAKE_CASE` in Python, `UPPER_SNAKE_CASE` in TypeScript (e.g., `SEARCH_MIN_LENGTH`, `SEARCH_BLUR_DELAY_MS`)

**Types:**
- TypeScript interfaces: `PascalCase` with "Type" suffix in contexts (e.g., `RoutingContextType`, `SearchProps`, `IMapFeature`)
- Python Pydantic models: `PascalCase` (e.g., `Properties`, `Feature`, `RouteResponse`)
- Python Enums: `PascalCase` (e.g., `TravelMode` with values like `DRIVE`, `BIKE`, `WALK`)
- TypeScript union types: camelCase literals (e.g., `"drive" | "bike" | "walk"`)

## Code Style

**Formatting:**
- Python: **black** (line length 100)
  - Run: `docker compose exec api make format`
  - Configuration in `api/pyproject.toml`: `[tool.black]` with `line-length = 100`, `target-version = ['py310']`
- TypeScript/React: **prettier** (no semicolons, no parens on single arrow params)
  - Run: `npm run format` from `client/` directory
  - Configuration in `client/.prettierrc.json`: `"semi": false`, `"arrowParens": "avoid"`

**Linting:**
- Python: **flake8** (line length 100, extends with black profile)
  - Run: `docker compose exec api make lint`
  - Configuration in `api/.flake8`: `max-line-length = 100`, `extend-ignore = E203, W503, E402`
  - Per-file ignores: `__init__.py` ignores `F401` (unused imports allowed for re-export)
- TypeScript/React: **eslint** with react-app, prettier, and jsx-a11y plugins
  - Run: `npm run lint:check` or `npm run lint:fix` from `client/` directory
  - Configuration in `client/.eslintrc.json` extends `["react-app", "react-app/jest", "prettier"]`
  - Key rules: require import statements grouped (absolute-first), newline after imports, destructuring assignment encouraged

**Build target:**
- TypeScript build target: **ESNext** (no transpilation)
  - Set in `client/vite.config.ts`: `esbuild.target: "esnext"` (required for MapLibre v5 compatibility)

## Import Organization

**Order (Python):**
1. Standard library imports (`logging`, `typing`, `datetime`)
2. Third-party imports (`sqlalchemy`, `fastapi`, `pydantic`)
3. Application imports (relative to `api/`: `from models.schemas import`, `from services.routing import`, `from utils.geo import`)

**Example from `api/services/routing.py`:**
```python
import logging
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy import text
from sqlalchemy.engine import Engine
from fastapi import HTTPException

from utils.geo import parse_coordinates, dump_geo
from utils.clock import Clock
from utils.cache import get_route_cache
from models.schemas import Feature, Properties, RouteResponse
from exceptions import InvalidCoordinatesError, RouteNotFoundError, DatabaseError
```

**Order (TypeScript/React):**
1. React and core imports (`import React`, `import { useState }`)
2. Material-UI imports (grouped by type: `@mui/material`, `@mui/icons-material`)
3. Third-party libraries (`maplibre-gl`, `@turf/helpers`)
4. Application imports: types first, then contexts, then hooks, then utilities/helpers, then components

**Example from `client/src/components/controls/Search.tsx`:**
```typescript
import React, { useState, FC, useRef, useEffect, useContext } from "react"
import TextField from "@mui/material/TextField"
import Box from "@mui/material/Box"
import { MyLocation } from "@mui/icons-material"
import {
  IMapFeature,
  SearchResponse,
  GeosupportFeature,
  SearchProps,
} from "../../types/interfaces"
import useDebouncedFetch from "../../hooks/useDebouncedFetch"
import { RoutingContext } from "../../contexts/RoutingContext"
import SuggestionDropdown from "./SuggestionDropdown"
import { commonStyles } from "../../utils/themeUtils"
```

**Path Aliases:**
- TypeScript uses relative imports only (no path aliases configured)
- Python uses simple relative imports from `api/` root (e.g., `from models.schemas import`, not `from api.models.schemas import`)

**Barrel Files:**
- Python: Not used (imports directly from modules)
- TypeScript: Not used (imports directly from component/hook files)

## Error Handling

**Python Patterns:**
- Custom domain exceptions in `api/exceptions.py` for service-layer errors:
  - `RoutingError` (base)
  - `InvalidCoordinatesError` (coordinate validation failures)
  - `RouteNotFoundError` (no route found)
  - `DatabaseError` (DB operations fail)
  - `CacheError` (cache operations fail)
- Convert service exceptions to HTTPException in routes with appropriate status codes
- Example from `api/services/routing.py`:
  ```python
  try:
      orig_lon, orig_lat = parse_coordinates(orig)
      dest_lon, dest_lat = parse_coordinates(dest)
  except ValueError as e:
      raise HTTPException(status_code=400, detail=str(e))
  ```
- Database errors caught at service layer and wrapped:
  ```python
  try:
      result = conn.execute(sql, {...})
  except Exception:
      raise HTTPException(status_code=500, detail="Error processing route request")
  ```

**TypeScript/React Patterns:**
- Try-catch blocks in async hooks (e.g., `useRouteFetch`) with error propagation via context
- Error display via `MessageContext` with severity levels ("error", "warning", "info")
- Example from `client/src/hooks/useRouteFetch.ts`:
  ```typescript
  const fetchRouteCallback = useCallback(async () => {
    setIsFetching(true)
    try {
      if (!startAddress || !endAddress) {
        displayMessage("Please select start and end addresses.", "warning")
        return
      }
      // ... fetch logic
    } catch (err) {
      displayMessage("Failed to fetch route", "error")
    } finally {
      setIsFetching(false)
    }
  }, [...])
  ```
- Error boundaries for component-level errors (configured in `App.tsx`)

## Logging

**Framework:** Python uses standard `logging` module; TypeScript uses custom `debug` utility module

**Python Patterns:**
- Module-level logger: `logger = logging.getLogger(__name__)`
- Log at appropriate levels: `info` for operational events, `error` for failures
- Example from `api/services/routing.py`:
  ```python
  logger.info(f"Using current time for traffic: hour={hour}, day_of_week={day_of_week}")
  logger.info(f"Cache hit for driving route from {orig} to {dest} ({cache_key_suffix})")
  logger.error(f"Database check failed: {e}")
  ```
- Include context: coordinates, mode, cache status, timing parameters

**TypeScript Patterns:**
- Custom `debug` utility (`client/src/utils/debug.ts`) wraps console methods
- Used sparingly for development: `debug.error("Invalid feature data", feature)`, `debug.info(...)`
- No console.log in production code

## Comments

**When to Comment:**
- Document **why** not what (code should be self-documenting)
- Complex logic: turn restrictions, traffic factor calculations, time conversions
- Non-obvious domain knowledge: coordinate systems (lon,lat order), weekday conversions (Python 0-6 vs SQL 1-7)
- Configuration/constants: explain meaning of magic numbers

**Example from `api/models/schemas.py`:**
```python
# Traffic factor explanation:
# 1.0 = No traffic impact (free flow/default) or no data available
# 1.2 = Light traffic (20% slowdown)
# 1.5 = Medium traffic (50% slowdown)
# 2.0 = Heavy traffic (doubles travel time)
# 3.0 = Very heavy traffic (triples travel time)
```

**Example from `api/services/routing.py`:**
```python
# Convert Python weekday (0=Mon, 6=Sun) to SQL weekday (1=Mon, 7=Sun)
day_of_week = self.clock.day_of_week + 1
```

**JSDoc/TSDoc:**
- Python: Use docstrings for public methods and classes
  - Triple-quoted docstring with Args, Returns, Raises sections
  - Example from `api/utils/geo.py`:
    ```python
    def parse_coordinates(coord_string: str) -> tuple[float, float]:
        """
        Parse a coordinate string in the format "longitude,latitude".

        Validates that coordinates are within NYC bounds:
        - Latitude: 40.4 to 40.95 (covers all 5 boroughs)
        - Longitude: -74.3 to -73.7 (covers all 5 boroughs)

        Args:
            coord_string: String in format "longitude,latitude"

        Returns:
            Tuple of (longitude, latitude) as floats

        Raises:
            ValueError: If the format is invalid or coordinates are out of bounds
        """
    ```
- TypeScript: No TSDoc observed; inline type annotations are used instead
  - Type interfaces document themselves through properties and optional markers

## Function Design

**Size:**
- Python: Service methods range 30-50 lines (e.g., `get_driving_route()` is 60+ lines due to routing logic)
- TypeScript: Custom hooks range 50-100 lines (e.g., `useRouteFetch` is ~60 lines)
- Both: Smaller, focused functions preferred; extract complex branches into helpers

**Parameters:**
- Python: Use named parameters for clarity, especially in services with multiple configurations
  - Example: `get_driving_route(orig: str, dest: str, use_traffic: bool = True, hour: Optional[int] = None, day_of_week: Optional[int] = None)`
  - Dependency injection for services: `__init__(self, db_engine: Engine, sql_queries: Dict[str, str], clock: Clock)`
- TypeScript: Use object parameters for many args (destructuring)
  - Example from `useRouteFetch`:
    ```typescript
    interface UseRouteFetchArgs {
      startAddress: IMapFeature | null
      endAddress: IMapFeature | null
      mode: TravelMode
      // ... more fields
    }
    const useRouteFetch = ({ startAddress, endAddress, mode, ... }: UseRouteFetchArgs) => {}
    ```

**Return Values:**
- Python: Explicit return type hints (e.g., `-> RouteResponse`, `-> tuple[float, float]`)
- TypeScript: Type inference preferred when obvious; explicit types for complex returns
  - Example: `const fetchRouteCallback = useCallback(async () => { ... }, [...])`
- Both: Use structured types (Pydantic models, interfaces) for complex returns, not dicts/objects

## Module Design

**Exports:**
- Python: Module-level functions and classes exported implicitly; no `__all__` observed
- TypeScript: Named exports preferred, but default exports used for components
  - Example: `export const useRouteFetch = (...) => {}` for hooks
  - Example: `export default SearchComponent` for React components

**File Structure:**
- `api/` → `services/`, `routes/`, `models/`, `utils/`, `middleware/`, `config/`, `dependencies.py`
- `client/src/` → `components/`, `contexts/`, `hooks/`, `utils/`, `types/`, `testUtils/`

---

*Convention analysis: 2026-02-12*
