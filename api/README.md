# NYC Open Routing API

This is the backend API for the NYC Open Routing application, built with FastAPI.

## Project Structure

```
api/
├── config/             # Configuration settings
├── models/             # Pydantic models for validation
├── routes/             # API endpoint route definitions
├── services/           # Business logic services
├── tests/              # Unit and integration tests
├── utils/              # Utility functions
├── conftest.py         # Pytest configuration
├── main.py             # Main application entry point
└── requirements.txt    # Python dependencies
```

## Getting Started

### Prerequisites

- Python 3.10 or higher
- Docker and Docker Compose (for local development)
- NYC Geosupport (automatically downloaded by the Docker setup)

### Environment Variables

Copy the example environment file and modify as needed:

```bash
cp .env.example .env
```

Required environment variables:

- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DB` - Database name
- `POSTGRES_HOST` - Database hostname
- `POSTGRES_PORT` - Database port
- `DEFAULT_GEOSUPPORT` - Geosupport version to use (e.g., "25a")

### Running the API

Using Docker Compose:

```bash
docker-compose up api
```

### Development

Using the Makefile:

```bash
# Run all tests
make test

# Generate coverage report
make coverage

# Check code style
make lint

# Format code (black + isort)
make format

# Clean up cache and build artifacts
make clean
```

Alternatively, you can run commands directly:

```bash
# Inside the api container
pytest

# With coverage report
pytest --cov=api

# Format code with black
black api/

# Sort imports
isort api/

# Check code style
flake8 api/
```

## Continuous Integration

The CI pipeline automatically runs on every pull request and push to the main branch:

- **Linting**: Checks code style with flake8, black, and isort
- **Testing**: Runs all tests with pytest and generates coverage report
- **Docker**: Builds the API container and runs a smoke test

You can run the same checks locally before pushing:

```bash
# Run all CI checks locally
make lint && make test
```

## API Documentation

When the API is running, you can access:

- OpenAPI documentation: http://localhost:5001/api/docs
- ReDoc documentation: http://localhost:5001/api/redoc 