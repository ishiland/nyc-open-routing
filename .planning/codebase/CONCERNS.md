# Codebase Concerns

**Analysis Date:** 2026-02-12

## Tech Debt

### Single-Worker Cache Limitation (CRITICAL FOR PRODUCTION)

**Issue**: In-memory route cache is not shared across worker processes
- **Files**: `api/utils/cache.py` (lines 18-52), `api/dependencies.py` (line 198)
- **Impact**: With 4+ workers, cache hit rate drops by 75%. Each worker maintains isolated cache, wasting memory and database queries
- **Current State**: Cache is per-worker with TTL=300s, max_size=1000 routes
- **Documented**: Yes, in `api/utils/cache.py` lines 22-29 explicit warning
- **Fix Approach**:
  - Replace in-memory dict with Redis client (lines 92-120 of cache.py)
  - Add Redis service to docker-compose.yml
  - Modify `RouteCache.get()` and `RouteCache.set()` to use async Redis calls
  - Timeline: 6 hours (documented in PERFORMANCE_OPTIMIZATION_PLAN.md Phase 3.1)

### Performance Optimization Phases Not Fully Implemented

**Issue**: PERFORMANCE_OPTIMIZATION_PLAN.md has 4-phase optimization plan with mixed completion status
- **Files**: `docs/PERFORMANCE_OPTIMIZATION_PLAN.md`
- **Status**:
  - ✅ Phase 1 (Critical bugs): COMPLETE - Traffic day-of-week, search async/blocking, traffic index fixed
  - ⚠️ Phase 2 (Database): PARTIAL - Connection pool increased (5→20), vertex accessibility NOT done
  - ❌ Phase 3 (Caching): NOT STARTED - Redis cache missing, prepared statements not implemented
  - ❌ Phase 4 (Cleanup): NOT STARTED - No code consolidation, duplicate turn calculations remain
- **Impact**: Baseline 200-300ms simple routes, 7-10s traffic routes, 5-10 req/sec capacity
- **Fix Approach**: Follow Phase 2-4 of PERFORMANCE_OPTIMIZATION_PLAN.md sequentially

### Redundant Traffic Lookups in SQL Functions

**Issue**: Traffic factor calculated 4× per route segment (redundant subqueries)
- **Files**: `data-importer/src/sql/05_functions.sql` (lines ~702-793 traffic functions)
- **Impact**: 400+ subqueries per 100-edge route to `avg_traffic_by_segment` table
- **Status**: Partially addressed with composite index, still unoptimized
- **Fix Approach**: Implement temporary table approach (Phase 1.5 in PERFORMANCE_OPTIMIZATION_PLAN.md) or materialize costs table (Phase 3.3)

### Database Connection Pool Under-Provisioned for Concurrent Load

**Issue**: Connection pool sized for dev but inadequate for production load
- **Files**: `api/dependencies.py` (lines 37-40)
- **Current Config**: pool_size=20, max_overflow=30 (total: 50 connections)
- **Database Limit**: PostgreSQL configured for 100 total connections
- **Risk**: High concurrent load will exhaust pool at 50+ req/sec, causing timeout errors
- **Fix Approach**: Consider connection pooling (PgBouncer) for multi-worker deployments

## Known Bugs

### Staten Island Bike/Walk Routing Disconnected from Rest of NYC

**Issue**: Bike and walk routes from/to Staten Island return empty (0 features)
- **Files**: `docs/STATEN_ISLAND_CONNECTIVITY_ISSUE.md`, `data-importer/src/sql/09_ferry_connections.sql`
- **Root Cause**: LION 25a data gap - "Staten Island Ferry Route" mislabeled, connects Brooklyn to Manhattan instead
- **Status**: ✅ FIXED via manual ferry terminal connections (09_ferry_connections.sql)
  - Ferry crossing added: 40-minute travel time (25-min ferry + 15-min wait average)
  - Before fix: Component 1 (Staten Island) isolated with 12,863 nodes
  - After fix: All components merged, bike/walk routes work end-to-end
- **Workaround Status**: Temporary fix - depends on LION data quality
- **Notes**: Drive mode unaffected (uses Verrazzano, Goethals, Bayonne bridges)

### Turn Instruction Sorting Error (FIXED)

**Issue**: First turn instruction was replaced with "Continue..." instead of "Start"
- **Files**: `data-importer/src/sql/05_functions.sql` (all routing functions)
- **Cause**: `MIN(turn_instruction)` sorted lexicographically instead of preserving sequence
- **Status**: ✅ FIXED - Changed to `(array_agg(turn_instruction ORDER BY seq))[1]`
- **Applied To**: getdrivingroute, getdrivingroute_with_traffic, getbikingroute, getwalkingroute

### Traffic Day-of-Week Off-by-One (FIXED)

**Issue**: Traffic routing never worked due to calendar mismatch
- **Files**: `api/services/routing.py` (lines 50-52)
- **Cause**: Python weekday (0=Mon, 6=Sun) not converted to SQL weekday (1=Mon, 7=Sun)
- **Status**: ✅ FIXED - Added `+ 1` to day_of_week conversion
- **Impact**: Before: all traffic_factor=1.0 (no traffic data applied). After: traffic factors applied correctly

## Security Considerations

### Database Credentials in Environment Variables

**Issue**: Database credentials passed via env vars in docker-compose
- **Files**: `docker-compose.yml`, `docker/dev/.env`
- **Risk**: Credentials in compose file or committed .env (if not properly .gitignored)
- **Current State**: `.env` file exists but not checked for secrets (reading forbidden by safety rules)
- **Mitigation In Place**: Credentials use weak defaults (postgres/admin) for dev-only setup
- **Recommendation**:
  - Use secrets management for production (AWS Secrets Manager, HashiCorp Vault, K8s secrets)
  - Never commit .env files (ensure .gitignore is correct)
  - Rotate credentials for any exposed development environment

### Geosupport API Key Exposure Risk

**Issue**: Geosupport client initialized in `api/dependencies.py` without explicit key management
- **Files**: `api/dependencies.py` (lines 48-49), `api/services/search.py`
- **Risk**: Geosupport may require API keys/license - if so, not being passed securely
- **Current State**: Initialized with no parameters (`Geosupport()`)
- **Assumption**: Running in NYC (local machine with Geosupport installed) or containerized with license
- **Recommendation**:
  - Verify Geosupport licensing requirements
  - If cloud-based API, use environment variable for key (not in code)
  - Add authentication error handling

### API Rate Limiting May Be Insufficient

**Issue**: Rate limit set to 60 requests/minute globally
- **Files**: `api/main.py` (line 20)
- **Current**: `Limiter(key_func=get_remote_address, default_limits=["60/minute"])`
- **Risk**: 60/min = 1 req/sec - inadequate for production multi-user app
- **Fix Approach**:
  - Differentiate by endpoint (search: stricter, routing: looser)
  - Consider by-IP-per-endpoint rate limits
  - Add API key support for authenticated higher-tier limits

## Performance Bottlenecks

### Traffic Routing 15-20× Slower Than Non-Traffic Routes

**Issue**: Traffic-aware routes take 7-10 seconds vs 200-300ms for simple routes
- **Files**: `api/services/routing.py` (line 79), `data-importer/src/sql/05_functions.sql` (traffic function)
- **Causes**:
  1. 4× redundant traffic lookups per segment (400+ queries for 100-edge route)
  2. No prepared statements - query planning on every request
  3. In-memory cache not shared across workers
  4. `avg_traffic_by_segment` table scanned repeatedly (now improved with composite index)
- **Optimization Path**:
  - Phase 1.5: Temporary table for traffic costs (3-5× speedup to ~1.5-2s per route)
  - Phase 3.3: Materialize traffic costs table (10-15× speedup to ~400-600ms per route)
  - Phase 3.2: Prepared statements (additional 10-30% speedup)

### Node Snapping Via Correlated Subqueries

**Issue**: Finding nearest bikeable/walkable/driveable node uses correlated subqueries
- **Files**: `data-importer/src/sql/05_functions.sql` (lines 15-68, node snapping functions)
- **Current**: `getnearestdrivenode()` uses `EXISTS` subquery to check edge connectivity
- **Impact**: 50-70% slower than cached approach (called 2× per route for origin+destination)
- **Fix Approach**: Pre-compute vertex accessibility flags (Phase 2.2 of PERFORMANCE_OPTIMIZATION_PLAN.md)
  - Add columns: has_driveable, has_bikeable, has_walkable to edges_vertices_pgr
  - Use partial GiST indexes instead of correlated subqueries
  - Results in 50%+ speedup for node snapping

### Geometry Transformation on Every Request

**Issue**: ST_Transform (SRID 2263 → 4326) executed per edge in every route response
- **Files**: `data-importer/src/sql/05_functions.sql` (lines ~820-828)
- **Impact**: Significant CPU cost on high-concurrency workloads
- **Fix Approach**: Cache transformed geometries (Phase 2.3)
  - Add geom_4326 column to edges table
  - Pre-compute during import
  - Trade disk space (~10-15% increase) for CPU savings on every query

## Fragile Areas

### SQL Function Volatility Declarations Could Cause Cache Bugs

**Issue**: Incorrect IMMUTABLE/STABLE declarations could cause stale cached data
- **Files**: `data-importer/src/sql/05_functions.sql` (node snapping function declarations)
- **Risk**: Functions read database tables but may be marked IMMUTABLE
- **Current State**: Functions appear to be VOLATILE (conservative/safe)
- **Danger**: If changed to IMMUTABLE, PostgreSQL caches results indefinitely
- **Mitigation**:
  - Keep node snapping functions as STABLE (output constant within transaction, changes between transactions)
  - Document that these must not be IMMUTABLE
  - Add comments in code: "Reads live edges_vertices_pgr table - must be STABLE, not IMMUTABLE"

### pgr_trsp Context Isolation Requires Careful SQL Construction

**Issue**: pgRouting's pgr_trsp() function cannot see CTEs defined outside its query string
- **Files**: `data-importer/src/sql/05_functions.sql` (all routing functions using pgr_trsp)
- **Fragility**: Temp tables must be created before pgr_trsp call and dropped after
- **Current Implementation**: Already handles this correctly with temp table approach
- **Risk**: Future refactoring could break if not understanding this constraint
- **Mitigation**:
  - Document in comments (already present in PERFORMANCE_OPTIMIZATION_PLAN.md)
  - Use consistent temp table naming pattern (e.g., temp_*_edges)
  - Always use DROP TABLE IF EXISTS at function start and end

### Ferry Terminal Connections Are Data-Driven Workaround

**Issue**: Manual ferry connections in `09_ferry_connections.sql` are temporary fix, not permanent
- **Files**: `data-importer/src/sql/09_ferry_connections.sql`, `data-importer/src/create_network.py`
- **Status**: Staten Island ferry cross-borough routing works but depends on manual coordinates
- **Risks**:
  - If LION data fixes in 25b or 26a, manual fix must be removed/updated
  - If coordinates change slightly, routes may break
  - Only addresses Staten Island Ferry, not other missing ferries
- **Mitigation**:
  - Document this as workaround in CLAUDE.md
  - Add validation that ferry coordinates are within expected bounds
  - Monitor LION releases for fixes

### Retry Logic in Search Service Uses Blocking time.sleep

**Issue**: Retry backoff uses `time.sleep()` which blocks async event loop
- **Files**: `api/utils/retry.py`, `api/services/search.py` (line 91-94)
- **Status**: ✅ FIXED - Search now uses `anyio.to_thread.run_sync()` to offload to thread pool (line 45-47)
- **Note**: But if retry logic is used elsewhere without thread offload, same problem could recur

## Scaling Limits

### Single-Worker Architecture Bottleneck

**Issue**: Current deployment uses single FastAPI worker
- **Current Setup**: `uvicorn api.main:app` (no `--workers` flag)
- **Capacity**: Limited to ~10-15 req/sec (single core utilization)
- **Scaling Path**:
  - Use gunicorn/uvicorn with multiple workers: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker`
  - Replace in-memory cache with Redis (Phase 3.1) to share cache across workers
  - Monitor CPU usage and scale worker count accordingly

### Database Connection Pool Exhaustion at Concurrent Load

**Issue**: 50-connection pool (current) exhausts before supporting horizontal scaling
- **Files**: `api/dependencies.py` (lines 37-40)
- **Current**: pool_size=20, max_overflow=30 = 50 total
- **Database Limit**: 100 total PostgreSQL connections
- **Scaling Path**:
  - Add connection pooling middleware (PgBouncer) to multiplexing mode
  - Each worker can share connections more efficiently
  - Allows 10+ workers without hitting database limit

### Memory Usage Grows Unbounded with Cache

**Issue**: Cache has max_size=1000 but stores entire route GeoJSON features (potentially large)
- **Files**: `api/utils/cache.py` (lines 34-51)
- **Impact**: 1000 routes × average 50 segments × geometry data = 10-50MB+ per worker
- **With 4 workers**: 40-200MB just for caching
- **Scaling Path**:
  - Implement Redis with LRU eviction policy (automatic size limit)
  - Monitor cache memory usage in production
  - Consider pagination for large routes (Phase 4.4)

## Dependencies at Risk

### Python-Geosupport Package Maintenance Unknown

**Issue**: External dependency on NYC-specific geosupport library
- **Package**: `python-geosupport`, `geosupport-suggest`
- **Risk**:
  - Maintained by NYC Department of City Planning (may have inconsistent updates)
  - No clear version pinning strategy visible in requirements
  - Installation depends on Geosupport Linux binaries being available
- **Current Mitigation**: Installed in Docker container at startup (api/entrypoint.sh)
- **Recommendation**:
  - Pin versions in requirements.txt
  - Document installation prerequisites
  - Have fallback address geocoding service (Google Maps, Mapbox) if Geosupport unavailable

### MapLibre GL v5 Requires ESNext Build Target

**Issue**: Frontend build requires ESNext (no transpilation)
- **Files**: `client/vite.config.ts`, `client/tsconfig.json`
- **Impact**: Client won't work on older browsers (IE11, old mobile)
- **Rationale**: MapLibre v5 dropped support for ES5 transpilation
- **Recommendation**: Document browser support requirements clearly (modern browsers only)

### SQLAlchemy Version Compatibility

**Issue**: SQLAlchemy 2.0+ API used but unclear if pinned in requirements
- **Files**: `api/services/routing.py` (uses `text()`, `._mapping`)
- **Impact**: Updating SQLAlchemy could break if API changes
- **Recommendation**:
  - Pin SQLAlchemy version in requirements.txt
  - Test major version upgrades before applying

## Missing Critical Features

### No Request Validation for Coordinate Bounds

**Issue**: Coordinates accepted without geographic bounds checking
- **Files**: `api/utils/geo.py` (parse_coordinates function)
- **Risk**: Routes calculated for coordinates outside NYC (e.g., 0,0) will fail silently or return empty
- **Current Behavior**: Fails with "No route found" 404
- **Fix Approach**:
  - Add bounds validation: NYC is approximately 40.5-40.93°N, -74.3--73.7°W
  - Return 400 error with clear message: "Coordinates must be within NYC bounds"
  - Location: `api/utils/geo.py` around parse_coordinates function

### No Health Check Endpoint for Database Connectivity

**Issue**: `/api/health` endpoint doesn't verify database connectivity
- **Files**: `api/routes/health.py`
- **Impact**: Load balancers can't detect database failures, continue routing to unhealthy instances
- **Fix Approach**:
  - Add database connectivity test (simple SELECT 1)
  - Return 503 Service Unavailable if DB unavailable
  - Use for Kubernetes readiness/liveness probes

### No Error Recovery from Traffic Data Unavailability

**Issue**: If traffic data missing, graceful fallback works but not optimally
- **Files**: `api/services/routing.py` (lines 105-113, 125-130)
- **Current**: Warns about missing traffic data, but routes already calculated
- **Better Approach**:
  - Pre-check if traffic data available before querying function
  - Route directly to non-traffic function if data unavailable
  - Saves ~30% of query time when traffic data missing

### No Analytics/Telemetry Logging

**Issue**: No structured logging for route requests, cache hits, or performance metrics
- **Files**: `api/services/routing.py`, `api/main.py`
- **Impact**: Cannot track:
  - Which routes are popular
  - Cache hit rate in production
  - Performance degradation over time
  - Error rates by endpoint
- **Fix Approach**: Implement structured logging (Phase 4.3 in PERFORMANCE_OPTIMIZATION_PLAN.md)

## Test Coverage Gaps

### No Unit Tests for Cache Invalidation Logic

**Issue**: Cache invalidation method only supports exact matching, not patterns
- **Files**: `api/utils/cache.py` (lines 162-193, invalidate method)
- **Gap**: invalidate() method doesn't properly filter by orig/dest/mode - implementation is incomplete
- **Risk**: Cache could contain stale data if partial invalidation attempted
- **Test Needed**:
  - Test invalidate(orig="...", dest="...") filters correctly
  - Test invalidate(mode="drive-traffic") removes only traffic routes
  - Currently only full clear() is reliable

### Missing Integration Tests for Concurrent Traffic Requests

**Issue**: No tests verify traffic routing under concurrent load
- **Files**: `api/tests/test_smoke.py`
- **Gap**: Smoke tests run sequentially, don't test race conditions
- **Risk**:
  - Cache collisions in multi-worker setup
  - Temp table conflicts with concurrent requests
  - Connection pool exhaustion not tested
- **Test Needed**:
  - Load test with 50+ concurrent requests
  - Verify all routes return valid results
  - Verify no connection timeouts

### No Tests for Ferry Mode Toggle (avoid_ferries Parameter)

**Issue**: `avoid_ferries` parameter tested minimally
- **Files**: `api/tests/test_smoke.py`, `api/routes/routing.py`
- **Gap**: No test verifies that ferry routes are excluded when avoid_ferries=true
- **Risk**: Bike/walk routes might incorrectly include ferries despite flag
- **Test Needed**:
  - Route from Staten Island with avoid_ferries=false (should include ferry)
  - Same route with avoid_ferries=true (should fail - no land route available)
  - Verify ferry segments (featuretyp='F') excluded in second case

### No Tests for Error Handling Path

**Issue**: Database errors, timeout, invalid coordinates tested minimally
- **Files**: `api/tests/test_services.py`, `api/tests/test_routes.py`
- **Gap**: No tests mock database connection failures
- **Risk**: Error responses may not match documented API contract
- **Test Needed**:
  - Mock database connection failure → verify 500 response
  - Mock invalid coordinates → verify 400 response with detail message
  - Mock timeout → verify 504 response

---

*Concerns audit: 2026-02-12*
