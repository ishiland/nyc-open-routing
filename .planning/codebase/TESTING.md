# Testing Patterns

**Analysis Date:** 2026-02-12

## Test Framework

**Python:**
- Runner: **pytest** (configured in `api/pytest.ini`)
- Assertion Library: pytest built-in assertions (`assert` statements)
- Async Support: `@pytest.mark.asyncio` decorator for async test functions
- Configuration: `api/pytest.ini` defines testpaths, markers, coverage settings

**TypeScript/React:**
- Runner: **vitest** (configured in `client/vite.config.ts` under `test` section)
- Assertion Library: **vitest** (`expect()`) with **@testing-library** matchers extended via `setupTests.ts`
- React Testing: **@testing-library/react** for component testing
- User Interaction: **@testing-library/user-event** for simulating user actions
- Globals: `globals: true` in vite config enables `describe`, `it`, `expect` without imports

**Run Commands:**

Python (from project root):
```bash
docker compose exec api pytest                             # Run all tests
docker compose exec api pytest api/tests/test_services.py  # Single test file
docker compose exec api pytest --cov=api                   # Coverage report
docker compose exec api pytest api/tests/test_smoke.py --noconftest -v  # Integration tests (needs running db + imported data)
docker compose exec api make lint                          # flake8 linting
docker compose exec api make format                        # black + isort formatting
```

TypeScript (from `client/` directory):
```bash
npm test              # Run all tests (vitest run)
npm run lint:check    # eslint
npm run lint:fix      # eslint --fix
npm run format        # prettier
npm run type-check    # tsc --noEmit
```

## Test File Organization

**Location:**
- Python: `api/tests/` directory (separate from source)
- TypeScript: Co-located with source files (e.g., `Search.tsx` with `Search.test.tsx`)

**Naming:**
- Python: `test_{feature}.py` (e.g., `test_services.py`, `test_utils.py`, `test_routes.py`)
- TypeScript: `{component}.test.tsx` or `{function}.test.ts` (e.g., `Search.test.tsx`, `formats.test.ts`)

**Structure:**
```
api/tests/
├── conftest.py              # Global fixtures
├── test_services.py         # Service layer unit tests
├── test_routes.py           # Route endpoint tests
├── test_utils.py            # Utility function tests
├── test_health.py           # Health check endpoint tests
├── test_cache.py            # Cache logic tests
├── test_smoke.py            # Integration tests (marked with @pytest.mark.integration)
└── __init__.py

client/src/
├── App.test.tsx
├── components/
│   ├── controls/
│   │   ├── Search.tsx
│   │   └── Search.test.tsx
│   └── ...
└── utils/
    ├── formats.ts
    └── formats.test.ts
```

## Test Structure

**Python Test Organization:**

Suite organization using classes and docstrings:
```python
# From api/tests/test_utils.py
class TestParseCoordinates:
    """Test suite for parse_coordinates function."""

    def test_parse_coordinates_valid(self):
        """Test parsing valid coordinates."""
        lon, lat = parse_coordinates("-73.9857,40.7484")
        assert lon == -73.9857
        assert lat == 40.7484

    def test_parse_coordinates_invalid_format_missing_comma(self):
        """Test parsing with missing comma."""
        with pytest.raises(ValueError, match="Invalid coordinate format"):
            parse_coordinates("-73.9857 40.7484")
```

Patterns:
- Classes group related tests (one test class per function/feature)
- Test methods follow `test_{condition}_{expected_outcome}` naming
- Docstrings describe test purpose
- Use `with pytest.raises(ExceptionType, match="pattern")` for exception testing
- Setup/teardown: Fixtures via conftest.py (see below)

**TypeScript Test Organization:**

Suite organization using `describe()` blocks:
```typescript
// From client/src/utils/formats.test.ts
describe("formatDistance", () => {
  it("should format distances in feet when less than 1000 feet", () => {
    expect(formatDistance(500)).toBe("500 ft")
    expect(formatDistance(0)).toBe("0 ft")
  })

  it("should format distances in miles when greater than 1000 feet", () => {
    expect(formatDistance(5280)).toBe("1.0 mi")
  })
})
```

Patterns:
- `describe()` groups tests by function or component
- `it()` defines individual test cases (can also use `test()`)
- Test descriptions start with "should"
- Multiple assertions per test are acceptable
- Use `beforeEach()` for setup (cleanup handled by setupTests.ts)

**React Component Testing:**

Example from `client/src/components/controls/Search.test.tsx`:
```typescript
const mockContextValue: RoutingContextType = {
  startAddress: null,
  // ... all context properties with default/mock values
}

const renderSearch = (type: "Start" | "End", contextOverrides = {}) => {
  const contextValue = { ...mockContextValue, ...contextOverrides }
  return render(
    <RoutingContext.Provider value={contextValue}>
      <Search type={type} />
    </RoutingContext.Provider>,
  )
}

describe("Search Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementation for useDebouncedFetch
    ;(useDebouncedFetch as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      setQuery: vi.fn(),
    })
  })

  it("renders with placeholder text", () => {
    renderSearch("Start")
    expect(screen.getByPlaceholderText("Enter NYC address")).toBeInTheDocument()
  })
})
```

Patterns:
- Create mock context values before tests
- Use helper render functions to reduce boilerplate
- Mock dependent hooks/services in `beforeEach()`
- Use `screen.getBy*()` queries (not `container` queries)
- Verify presence with `@testing-library/jest-dom` matchers

## Mocking

**Framework:**
- Python: **unittest.mock** (MagicMock, patch, spec)
- TypeScript: **vitest** (vi.mock, vi.fn, vi.clearAllMocks)

**Python Mocking Patterns:**

Fixture-based mocking in `api/conftest.py`:
```python
@pytest.fixture
def mock_db_engine():
    """Mock SQLAlchemy engine."""
    engine = MagicMock()
    return engine

@pytest.fixture
def mock_routing_service(mock_db_engine, mock_sql_queries, mock_clock):
    """Return a mocked RoutingService."""
    return RoutingService(mock_db_engine, mock_sql_queries, mock_clock)
```

Decorator-based mocking in test functions:
```python
# From api/tests/test_services.py
def test_routing_service_success(mock_routing_service, mock_db_engine):
    """Test successful route retrieval."""
    conn = MagicMock()
    result = MagicMock()
    rows = [
        MagicMock(_mapping={
            "seq": 1,
            "street": "BROADWAY",
            "distance": 100.5,
            "travel_time": 30.0,
            "geom": "..."
        })
    ]
    result.fetchall.return_value = rows
    conn.execute.return_value = result
    mock_db_engine.connect.return_value.__enter__.return_value = conn

    # Patch external function
    with patch('api.utils.geo.dump_geo') as mock_dump_geo:
        mock_dump_geo.return_value = {
            "type": "LineString",
            "coordinates": [[-73.9857, 40.7484], [-73.9855, 40.7480]]
        }

        response = mock_routing_service.get_driving_route("-73.9857,40.7484", "-73.9950,40.7352")
        assert len(response.features) == 1
```

Patterns:
- Fixtures provide reusable mock objects (fixtures auto-injected into test parameters)
- `MagicMock()` creates mock objects with auto-recording of calls/returns
- `patch()` replaces functions/classes within a context
- Setup mock return values chain-wise for nested calls: `mock_db_engine.connect.return_value.__enter__.return_value`
- Use `spec=ClassName` to constrain mock to class interface: `clock = MagicMock(spec=Clock)`

**TypeScript Mocking Patterns:**

Module-level mocking (hooks):
```typescript
// From client/src/components/controls/Search.test.tsx
vi.mock("../../hooks/useDebouncedFetch", () => ({
  default: vi.fn(),
}))

// In test:
beforeEach(() => {
  vi.clearAllMocks()
  ;(useDebouncedFetch as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    data: null,
    loading: false,
    error: null,
    setQuery: vi.fn(),
  })
})
```

Function mocking:
```typescript
const mockContextValue: RoutingContextType = {
  startAddress: null,
  setAddress: vi.fn(),
  setAddressInput: vi.fn(),
  // ... other mocked functions
}
```

Patterns:
- `vi.mock()` replaces module at top of test file
- `vi.fn()` creates a spy function that records calls
- `mockReturnValue()` sets return value for next call
- Type assertions needed for vitest mocks: `as unknown as ReturnType<typeof vi.fn>`
- `vi.clearAllMocks()` in `beforeEach()` resets state between tests

**What to Mock:**
- External services: Database connections, HTTP clients, file systems
- Dependencies: Utilities, services injected into components
- Third-party libraries: Geosupport, MapLibre GL (for unit tests)

**What NOT to Mock:**
- Pure functions: `formatDistance()`, `parse_coordinates()` — test the actual logic
- Data transformation helpers: `transformSearchResult()` — verify output shape
- Type constructors: Pydantic models, TypeScript interfaces — test with real instances

## Fixtures and Factories

**Test Data (Python):**

Central fixtures in `api/conftest.py`:
```python
@pytest.fixture
def mock_clock():
    """Mock Clock class."""
    clock = MagicMock(spec=Clock)
    clock.hour = 12
    clock.day_of_week = 1
    clock.now.return_value = datetime(2023, 1, 1, 12, 0, 0)
    return clock
```

Inline mock data in tests (when specific to one test):
```python
# From api/tests/test_services.py
mock_suggestions = [
    {
        "House Number - Display Format": "260",
        "First Street Name Normalized": "BROADWAY",
        "First Borough Name": "MANHATTAN",
        "Latitude": "40.7129",
        "Longitude": "-73.9997"
    }
]
```

**Test Data (TypeScript):**

Mock context values at test file level:
```typescript
const mockContextValue: RoutingContextType = {
  startAddress: null,
  endAddress: null,
  mode: "drive",
  route: null,
  selectedStreet: null,
  useTraffic: true,
  avoidFerries: false,
  trafficHour: null,
  trafficDayOfWeek: null,
  // ... all required properties
}
```

Render helpers that build test components:
```typescript
const renderSearch = (type: "Start" | "End", contextOverrides = {}) => {
  const contextValue = { ...mockContextValue, ...contextOverrides }
  return render(
    <RoutingContext.Provider value={contextValue}>
      <Search type={type} />
    </RoutingContext.Provider>,
  )
}
```

**Location:**
- Python: Fixtures live in `api/conftest.py` (global scope) or inline in test files (fixture-specific data)
- TypeScript: Mock data defined at top of test file; helpers extracted as const functions

## Coverage

**Requirements:** Not enforced (no minimum threshold in CI)

**View Coverage:**

Python:
```bash
docker compose exec api pytest --cov=api                   # Terminal report
docker compose exec api pytest --cov=api --cov-report=html # HTML report in htmlcov/
```

TypeScript:
```bash
npm test -- --coverage                                      # Generate coverage (configured in vite.config.ts)
```

Coverage configuration in `api/pytest.ini`:
```ini
[coverage:run]
source = api
omit =
    */tests/*
    */migrations/*
    */conftest.py
    api/app.py
    api/__init__.py

[coverage:report]
exclude_lines =
    pragma: no cover
    def __repr__
    raise NotImplementedError
    raise ImportError
    except ImportError
    DEBUG
    if TYPE_CHECKING:
```

## Test Types

**Unit Tests:**
- Scope: Individual functions/methods (e.g., `parse_coordinates()`, `formatDistance()`)
- Approach: Mock external dependencies (DB, HTTP, file system)
- Location: `api/tests/test_utils.py`, `client/src/utils/formats.test.ts`
- Example: Test coordinate parsing with valid/invalid inputs, boundary conditions

**Integration Tests:**
- Scope: Service layer + database (full routing pipeline)
- Approach: Use real database with test data (requires `docker compose` running and imported LION data)
- Marked with: `@pytest.mark.integration` decorator
- Location: `api/tests/test_smoke.py`
- Run: `docker compose exec api pytest api/tests/test_smoke.py --noconftest -v`
- Example: Test full route request → database query → response transformation

**End-to-End Tests:**
- Status: Not currently implemented (no Playwright/Cypress config observed)
- Playwright MCP directory exists (`.playwright-mcp/`) but is empty

## Common Patterns

**Async Testing (Python):**

Using `@pytest.mark.asyncio`:
```python
# From api/tests/test_services.py
@pytest.mark.asyncio
async def test_search_service_geosupport_error():
    """Test SearchService with Geosupport error."""
    from geosupport.error import GeosupportError

    mock_suggest = MagicMock()
    mock_suggest.suggestions.side_effect = GeosupportError("Address not recognized")

    service = SearchService(mock_suggest)

    with pytest.raises(HTTPException) as excinfo:
        await service.search_address("Invalid Address XYZ123")
    assert excinfo.value.status_code == 400
```

**Error Testing (Python):**

Using `pytest.raises()` context manager:
```python
# From api/tests/test_utils.py
def test_parse_coordinates_invalid_format_missing_comma(self):
    """Test parsing with missing comma."""
    with pytest.raises(ValueError, match="Invalid coordinate format"):
        parse_coordinates("-73.9857 40.7484")
```

Match parameter uses regex pattern matching.

**Error Testing (TypeScript):**

Using try-catch or component error boundaries:
```typescript
// Component integration test (would verify error message displayed)
it("should display error message on failed route fetch", () => {
  // Mock useDebouncedFetch to simulate error
  const mockError = new Error("Network error")
  ;(useDebouncedFetch as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    data: null,
    loading: false,
    error: mockError,
    setQuery: vi.fn(),
  })

  renderSearch("Start")
  // Would need to verify error display logic
})
```

**Setup and Teardown:**

Python:
```python
@pytest.fixture
def mock_db_engine():
    """Mock SQLAlchemy engine."""
    engine = MagicMock()  # Setup
    yield engine         # Test runs here
    # Cleanup (auto-handled by garbage collection for mocks)
```

TypeScript (automatic):
```typescript
// From client/src/setupTests.ts
afterEach(() => {
  cleanup()        # React component cleanup
  resetMocks()     # Clear all mocks
})
```

## Test Markers (Python)

Defined in `api/pytest.ini`:
```ini
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks tests as integration test
    unit: marks tests as unit test
```

Usage:
```python
@pytest.mark.slow
def test_large_route_graph():
    """This test takes a long time."""
    pass

@pytest.mark.integration
def test_full_routing_pipeline():
    """Requires database and imported data."""
    pass

# Run selectively:
# pytest -m "not slow"          # Skip slow tests
# pytest -m integration         # Run only integration tests
```

---

*Testing analysis: 2026-02-12*
