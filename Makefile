.PHONY: help build up down test test-api test-client lint lint-api lint-client \
       format format-api format-client import db logs clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

build: ## Build all Docker services
	docker compose build

up: ## Start all services in background
	docker compose up -d

down: ## Stop all services
	docker compose down

test: test-api test-client ## Run all tests

test-api: ## Run API tests (pytest)
	docker compose exec api pytest

test-client: ## Run client tests (vitest)
	docker compose exec client npm test

lint: lint-api lint-client ## Run all linters

lint-api: ## Lint API code (flake8)
	docker compose exec api make lint

lint-client: ## Lint client code (eslint)
	docker compose exec client npm run lint:check

format: format-api format-client ## Format all code

format-api: ## Format API code (black + isort)
	docker compose exec api make format

format-client: ## Format client code (prettier)
	docker compose exec client npm run format

import: ## Import LION street data (first run, ~10-30 min)
	docker compose exec api sh /data-imports/import-lion.sh 25d

db: ## Open database shell (psql)
	docker compose exec db psql -U postgres -d routing

logs: ## Tail service logs
	docker compose logs -f

clean: ## Stop services and destroy all data
	docker compose down -v
