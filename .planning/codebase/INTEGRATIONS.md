# External Integrations

**Analysis Date:** 2026-02-12

## APIs & External Services

**NYC Geosupport (Address Geocoding):**
- NYC Department of City Planning's Geosupport API - NYC address geocoding and validation
  - SDK/Client: `python-geosupport` 1.1.0 + `geosupport-suggest` 0.1.0
  - Auto-installed at container startup via `api/entrypoint.sh`
  - Singleton instances in `api/dependencies.py`: `_geosupport` and `_geosupport_suggest`
  - Used by: `api/services/search.py` for address autocomplete (`/api/search` endpoint)
  - Timeout: 5 seconds (configurable via `GEOSUPPORT_TIMEOUT` env var)
  - Retry logic: 3 attempts with exponential backoff (configurable in `api/config/settings.py`)
  - Error handling: Maps Geosupport errors to user-friendly messages

**NYC Open Data (Traffic Volumes):**
- NYC DOT Traffic Volume Data - Static traffic counts by street segment
  - Source: `https://data.cityofnewyork.us/api/views/7ym2-wayt/rows.csv`
  - Download method: `urllib.request` in `scripts/import_traffic.py`
  - Size: ~100MB CSV (optional import, takes several minutes)
  - Segment ID matching: ~3,462 of 177,562 edges (~1.9%) have traffic data
  - Fallback: Spatial matching (ST_DWithin + street name) if < 100 segment matches
  - Used by: `/api/route?use_traffic=true` for driving routes when `--download-traffic` flag used during LION import
  - Import script: `scripts/import_traffic.py` or via `docker compose exec api sh /data-imports/import-lion.sh 25a --download-traffic`

**NYC Planning Labs (Map Tiles):**
- NYC Planning Labs Style API - Basemap tiles and vector layer styling
  - URL: `https://layers-api.planninglabs.nyc/v1/base/style.json`
  - Used by: `client/src/hooks/useMapInit.ts` for initial map style in MapLibre GL
  - Frontend only, no authentication required

## Data Storage

**Databases:**
- PostgreSQL 17 with PostGIS 3.5 and pgRouting 3.8
  - Container: `pgrouting/pgrouting:17-3.5-3.8`
  - Internal port: 5432 (exposed as 5433 for dev)
  - Connection: `api/config/settings.py` builds DSN from env vars
  - Client: SQLAlchemy ORM via `psycopg` v3 driver
  - URI format: `postgresql+psycopg://{user}:{password}@{host}:{port}/{database}`
  - Credentials stored in: `docker/dev/.env` (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_HOST)

**Graph Database (pgRouting):**
- Tables: `edges`, `edges_vertices_pgr`, `restrictions`, `traffic_volumes` (optional), `lion` (raw import)
- Core functions in `data-importer/src/sql/05_functions.sql`:
  - Node snapping: `getnearestdrivenode()`, `getnearestbikenode()`, `getnearestwalknode()`
  - Routing: `getdrivingroute()`, `getdrivingroute_with_traffic()`, `getbikingroute()`, `getwalkingroute()`
  - Turn restrictions: `restrictions_for_driving`, `restrictions_for_biking`, `restrictions_for_walking`

**File Storage:**
- Local filesystem only (no cloud storage)
- LION street network data imported to database during setup
- Traffic data (if imported) stored as CSV initially, then to database

**Caching:**
- Search cache: In-memory (configurable via `SEARCH_CACHE_TTL=3600` and `SEARCH_CACHE_MAX_SIZE=100`)
- Database connection pooling: SQLAlchemy pool_size=20, max_overflow=30, pool_recycle=1800 seconds
- No external cache service (Redis/Memcached)

## Authentication & Identity

**Auth Provider:**
- None - Application is unauthenticated (public, no login required)
- No JWT, OAuth, or session management
- CORS configured in `api/main.py` for localhost origins only (dev environment)

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or similar integration

**Logs:**
- Console logging via Python `logging` module
- Configuration: `api/config/settings.py` defines logging format and handlers
- Request logging middleware: `api/middleware/logging.py`
- Log level: Configurable via `LOG_LEVEL` env var (default: INFO)
- No external log aggregation (Cloudwatch, Splunk, ELK)

**Monitoring:**
- Not detected in codebase - No APM or metrics collection

## CI/CD & Deployment

**Hosting:**
- Docker Compose (local development only)
- No production deployment documented
- Services run via: `docker compose up -d`

**CI Pipeline:**
- GitHub Actions: `.github/workflows/ci.yml`
- Triggers: On push to main, on pull requests
- Jobs:
  1. **Client CI** (runs-on: ubuntu-latest)
     - Node setup, npm ci, type check, lint, tests, build
  2. **API CI** (runs-on: ubuntu-latest)
     - Python 3.11 setup, flake8 lint, black format check, isort check, pytest with coverage
     - Coverage upload to Codecov (fail_ci_if_error: false)
  3. **Docker Build** (runs-on: ubuntu-latest, needs api)
     - Build API Docker image, smoke test container on port 5000

## Environment Configuration

**Required env vars:**
- POSTGRES_USER - Database user (default: postgres)
- POSTGRES_PASSWORD - Database password (default: postgres)
- POSTGRES_DB - Database name (default: routing)
- POSTGRES_HOST - Database hostname (default: db)
- POSTGRES_PORT - Database port (default: 5432)
- LOG_LEVEL - Logging verbosity (default: INFO)

**Optional env vars:**
- GEOSUPPORT_TIMEOUT - Timeout for Geosupport calls in seconds (default: 5)
- SEARCH_CACHE_TTL - Search result cache TTL in seconds (default: 3600)
- SEARCH_CACHE_MAX_SIZE - Max search result cache entries (default: 100)
- SEARCH_MAX_RETRIES - Max retry attempts for search (default: 3)
- SEARCH_RETRY_BACKOFF_BASE - Initial backoff delay in seconds (default: 1.0)

**Secrets location:**
- Development: `docker/dev/.env` (Docker environment file)
- Never committed to git (`.env` in `.gitignore`)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## External Data Sources

**LION Street Network:**
- Source: NYC Department of Planning
- Import method: `data-importer/import-lion.sh 25a` (district 25a = Manhattan)
- Size: Full dataset processed into edges, vertices, turn restrictions
- Schema: `api/services/routing.py` + SQL functions handle mode-specific routing

**Rate Limiting:**
- Configured via `slowapi` middleware
- Default limit: 60 requests per minute per IP address
- Configured in `api/main.py`: `Limiter(key_func=get_remote_address, default_limits=["60/minute"])`

---

*Integration audit: 2026-02-12*
