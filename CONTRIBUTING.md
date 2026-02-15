# Contributing to NYC Open Routing

Contributions are welcome. NYC Open Routing is a proof-of-concept project, so the scope is intentionally focused on NYC routing with pgRouting and LION data. Bug fixes, performance improvements, and well-scoped feature additions are all appreciated.

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 23+ (for client development outside Docker)
- Python 3.11+ (for API development outside Docker)

### Getting Started

Follow the [Quick Start](README.md#quick-start) in the README to get the project running. Once the services are up:

**Client development** (hot reload outside Docker):

```bash
cd client
npm install
npm run dev
```

The Vite dev server runs on port 3000 and proxies API requests to the `api` container.

**API container access:**

```bash
docker compose exec api bash
```

**Database access:**

```bash
docker compose exec db psql -U postgres -d routing
```

## Code Style

### Python

- Formatter: black (line length 100)
- Import sorting: isort (black profile)
- Linter: flake8

```bash
docker compose exec api make format    # auto-format with black + isort
docker compose exec api make lint      # lint with flake8
```

### TypeScript / React

- Formatter: prettier (no semicolons, no parens on single arrow params)
- Linter: eslint

```bash
cd client
npm run format      # auto-format with prettier
npm run lint:check  # lint with eslint
npm run lint:fix    # auto-fix lint issues
```

## Testing

### Python

```bash
docker compose exec api pytest                 # run all tests
docker compose exec api pytest --cov=api       # run with coverage
docker compose exec api pytest api/tests/test_smoke.py --noconftest -v  # integration tests (requires running db + imported data)
```

### Frontend

```bash
cd client
npm test    # run vitest
```

## Pull Request Process

1. Fork the repo and create a feature branch from `master`
2. Follow the code style guidelines above
3. Add tests for new functionality where applicable
4. Ensure all existing tests pass
5. Open a PR with a clear description of changes
