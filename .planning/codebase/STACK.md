# Technology Stack

**Analysis Date:** 2026-02-12

## Languages

**Primary:**
- Python 3.11 - Backend API server, data import scripts, routing algorithms
- TypeScript 5.3.3 - React frontend application
- SQL - pgRouting functions, database queries (PostgreSQL 17 dialect)

**Secondary:**
- HTML/CSS - React component templates

## Runtime

**Environment:**
- Node 23.10.0 - JavaScript runtime (client container)
- Python 3.11 - API and data processing (api container via GDAL base image)
- PostgreSQL 17 - Database with PostGIS and pgRouting extensions

**Package Manager:**
- npm - JavaScript/Node dependencies (client)
  - Lockfile: `client/package-lock.json` (present)
- pip - Python dependencies (api)
  - Lockfile: `api/requirements.txt` (explicit version pinning)

## Frameworks

**Core:**
- FastAPI 0.115.12 - REST API framework
- React 18.2.0 - Frontend UI library
- SQLAlchemy 2.0.40 - Python ORM for database access

**Frontend:**
- React Router (implicit via component structure, no file paths needed)
- Vite 5.0.11 - Build tool and dev server
- Material-UI (MUI) 7.0.1 - Component library for UI
- MapLibre GL 5.3.0 - Vector map rendering (used for street network visualization)

**Testing:**
- pytest 8.2.0 - Python test runner (`api/tests/`)
- pytest-asyncio 0.24.0 - Async test support
- pytest-cov 6.0.0 - Coverage reporting
- vitest 1.2.0 - JavaScript test runner (client)
- @testing-library/react 14.1.2 - React component testing

**Build/Dev:**
- TypeScript 5.3.3 - Type checking for frontend
- ESLint 8.56.0 - JavaScript linting
- Prettier 3.2.1 - Code formatter
- Black - Python formatter (via requirements)
- isort - Python import sorter (via requirements)
- flake8 - Python linter (via requirements)

## Key Dependencies

**Backend Core:**
- FastAPI 0.115.12 - Web framework
- psycopg 3.2.6 - PostgreSQL driver (v3, not v2)
- SQLAlchemy 2.0.40 - Database ORM
- uvicorn 0.34.0 - ASGI server

**Geospatial & NYC Data:**
- python-geosupport 1.1.0 - NYC address geocoding via DCP Geosupport API
- geosupport-suggest 0.1.0 - Address autocomplete wrapper for Geosupport
- Shapely 2.0.7 - Geometric operations (used for coordinate validation)
- numpy 2.2.4 - Numerical operations

**Infrastructure:**
- Pydantic 2.11.1 - Data validation and settings management
- pydantic-settings 2.7.0 - Environment configuration
- slowapi 0.1.9 - Rate limiting middleware (60 requests/minute default)
- gunicorn 19.9.0 - Production WSGI server
- httpx 0.28.1 - HTTP client (for external requests)

**Utilities:**
- pytz 2025.2 - Timezone handling (NY timezone context)
- tqdm 4.67.1 - Progress bars (data import scripts)
- logging (stdlib) - Structured logging throughout

**Frontend UI:**
- @mui/material 7.0.1 - Component library
- @mui/icons-material 7.0.1 - Icon library
- @emotion/react 11.14.0 - CSS-in-JS (MUI dependency)
- @emotion/styled 11.14.0 - Styled components (MUI dependency)
- tss-react 4.9.16 - TypeScript styles for React
- react-error-boundary 4.0.13 - Error handling wrapper
- autosuggest-highlight 3.3.4 - Text highlighting for search results

**Frontend Geospatial:**
- @turf/helpers 7.2.0 - GeoJSON manipulation utilities
- turf-extent 1.0.4 - Bounding box calculations

## Configuration

**Environment:**
- Configuration file: `docker/dev/.env` (not in root, never committed)
- Environment variables control: DB credentials, logging level, timeouts, search behavior
- Settings module: `api/config/settings.py` - Pydantic Settings with env var binding

**Build:**
- Frontend: `client/vite.config.ts` (Vite configuration)
- Frontend: `client/tsconfig.json` - TypeScript compiler options (target: ESNext)
- Backend: `api/pyproject.toml` - Python project metadata and tool configs
- Backend: `api/.flake8` - Linter configuration
- Backend: `api/Makefile` - Development commands

**Code Quality:**
- Frontend: `client/.eslintrc.json` - ESLint rules (extends react-app + prettier)
- Frontend: `client/.prettierrc.json` - Prettier formatter config
- Backend: `api/pyproject.toml` - Black, isort, pytest config
- CI/CD: `.github/workflows/ci.yml` - GitHub Actions workflow

## Platform Requirements

**Development:**
- Docker & Docker Compose - All services containerized
- Python 3.11 - API development
- Node 23+ - Client development
- PostgreSQL 17 with PostGIS - Database

**Container Specifications:**
- API: GDAL Ubuntu base image with Python 3.11 (`docker/dev/api.Dockerfile`)
- Client: Node 23.10.0-Alpine (`docker/dev/client.Dockerfile`)
- Database: `pgrouting/pgrouting:17-3.5-3.8` - PostgreSQL 17 with PostGIS 3.5 and pgRouting 3.8

**Production:**
- Docker containers deployed to... (not specified in CLAUDE.md)
- Database: PostgreSQL 17 with PostGIS and pgRouting

---

*Stack analysis: 2026-02-12*
