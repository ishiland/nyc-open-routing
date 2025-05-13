.PHONY: help lint format test coverage clean

# Default target
help:
	@echo "Available commands:"
	@echo "  make lint      - Run linting checks (flake8)"
	@echo "  make format    - Run code formatters (black, isort)"
	@echo "  make test      - Run tests"
	@echo "  make coverage  - Run tests with coverage report"
	@echo "  make clean     - Remove build artifacts and caches"

# Linting
lint:
	flake8 .

# Formatting
format:
	black .
	isort .

# Testing
test:
	pytest

# Coverage
coverage:
	pytest --cov=api --cov-report=html --cov-report=term

# Clean up
clean:
	rm -rf .pytest_cache .coverage htmlcov
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete 