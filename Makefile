SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

ARGS ?=
FIXTURE_FILE ?= fixtures/records.json
CSV_FILE ?= ../docs/dsa-chapters.csv
CAUCUS_CSV_FILE ?= ../docs/dsa-caucuses.csv
ATPROTO_LIVE_INGESTION ?= false

.PHONY: help deps verify fmt lint test test-backend test-web build build-backend build-web dev-backend dev-web compose-config compose-up compose-db compose-down compose-logs compose-reset db-shell fixture-author fixture-replay chapters-import caucuses-import ingest-atproto open-pilot-check

help:
	@awk 'BEGIN {FS = ":.*##"; printf "Commands:\n"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

deps: ## Install pinned workspace dependencies
	pnpm install --frozen-lockfile

verify: deps fmt lint test build compose-config open-pilot-check ## Run all checks

fmt: ## Run TypeScript format/typecheck pass
	pnpm run format

lint: ## Run ESLint across backend and web
	pnpm run lint

test: ## Run all tests
	pnpm run test

test-backend: ## Run backend tests only
	pnpm --dir backend run test

test-web: ## Run web tests only
	pnpm --dir web run test

build: ## Build backend and web
	pnpm run build

build-backend: ## Build backend only
	pnpm --dir backend run build

build-web: ## Build web only
	pnpm --dir web run build

dev-backend: ## Run backend dev server against local Postgres
	pnpm --dir backend run dev

dev-web: ## Run Vite dev server
	pnpm --dir web run dev

compose-config: ## Validate Docker Compose config
	docker compose config --quiet

compose-up: ## Start Postgres, API, and web with Docker Compose
	docker compose up --build

compose-db: ## Start local Postgres and wait until it is ready
	docker compose up -d postgres
	@for i in {1..30}; do docker compose exec -T postgres pg_isready -U $${POSTGRES_USER:-dsa_proto} -d $${POSTGRES_DB:-dsa_proto} >/dev/null 2>&1 && exit 0; sleep 1; done; echo "Postgres did not become ready" >&2; exit 1

compose-down: ## Stop Docker Compose services
	docker compose down

compose-logs: ## Follow Docker Compose logs
	docker compose logs -f

compose-reset: ## Destroy local Compose data volume and rebuild from seed records
	docker compose down -v
	docker compose up --build

db-shell: ## Open psql in the Compose Postgres service
	docker compose exec postgres psql -U $${POSTGRES_USER:-dsa_proto} -d $${POSTGRES_DB:-dsa_proto}

fixture-author: ## Append a local fixture record; pass ARGS='--type chapter --name "West Side DSA"'
	pnpm --dir backend run fixtures:author -- $(ARGS)

fixture-replay: compose-db ## Replay local fixture file(s) into Postgres; override FIXTURE_FILE=fixtures/records.json
	pnpm --dir backend run fixtures:replay -- $(FIXTURE_FILE)

chapters-import: ## Import docs/dsa-chapters.csv into fixture storage; override CSV_FILE=../docs/dsa-chapters.csv
	pnpm --dir backend exec tsx src/chapters-csv-import.ts $(CSV_FILE) --out $(FIXTURE_FILE)

caucuses-import: ## Import docs/dsa-caucuses.csv into fixture storage; override CAUCUS_CSV_FILE=../docs/dsa-caucuses.csv
	pnpm --dir backend exec tsx src/caucuses-csv-import.ts $(CAUCUS_CSV_FILE) --out $(FIXTURE_FILE)

ingest-atproto: ## Run opt-in live ATProto ingestion; set ATPROTO_LIVE_INGESTION=true to connect
	ATPROTO_LIVE_INGESTION=$(ATPROTO_LIVE_INGESTION) pnpm --dir backend run ingest:atproto

open-pilot-check: ## Verify Open Pilot issue template is preserved
	@test -f .gitea/ISSUE_TEMPLATE/open-pilot-task.yaml
	@grep -q 'Test Command' .gitea/ISSUE_TEMPLATE/open-pilot-task.yaml
