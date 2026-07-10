SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

ARGS ?=
FIXTURE_FILE ?= fixtures/records.json
CSV_FILE ?= ../docs/dsa-chapters.csv
CAUCUS_CSV_FILE ?= ../docs/dsa-caucuses.csv
ATPROTO_LIVE_INGESTION ?= false
PNPM_VERSION ?= 10.33.0
PNPM ?= pnpm

.PHONY: help toolchain deps lexicons lexicons-check verify verify-integration fmt lint test test-backend test-web build build-backend build-web dev-backend dev-web compose-config compose-up compose-db compose-down compose-logs compose-reset db-shell fixture-author fixture-replay chapters-import caucuses-import registry-health ingest-atproto foundation-publish open-pilot-check

help:
	@awk 'BEGIN {FS = ":.*##"; printf "Commands:\n"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

toolchain: ## Require the repository-pinned pnpm version
	@actual="$$($(PNPM) --version)"; test "$$actual" = "$(PNPM_VERSION)" || { echo "Expected pnpm $(PNPM_VERSION), found $$actual. Install/use the packageManager version from package.json." >&2; exit 1; }

deps: toolchain ## Install pinned workspace dependencies
	$(PNPM) install --frozen-lockfile

lexicons: ## Generate TypeScript bindings from canonical Lexicon JSON
	$(PNPM) --dir backend run lexicons
	$(PNPM) --dir packages/foundation-client run lexicons

lexicons-check: lexicons ## Verify generated bindings and backwards-compatible schema evolution
	@git diff --exit-code -- backend/src/lexicons
	@git diff --exit-code -- packages/foundation-client/src/lexicons
	$(PNPM) --dir backend run lexicons:compat

verify: deps lexicons-check fmt lint test build compose-config open-pilot-check ## Run all offline checks

verify-integration: verify ## Run the networked local PDS/Tap integration stack
	docker compose -f deploy/local/docker-compose.yml up --build --abort-on-container-exit integration
	sh deploy/local/restart-check.sh

fmt: ## Run TypeScript format/typecheck pass
	$(PNPM) -r --if-present run format

lint: ## Run ESLint across backend and web
	$(PNPM) -r run lint

test: ## Run all tests
	$(PNPM) -r run test

test-backend: ## Run backend tests only
	$(PNPM) --dir backend run test

test-web: ## Run web tests only
	$(PNPM) --dir web run test

build: ## Build backend and web
	$(PNPM) -r run build

build-backend: ## Build backend only
	$(PNPM) --dir backend run build

build-web: ## Build web only
	$(PNPM) --dir web run build

dev-backend: ## Run backend dev server against local Postgres
	$(PNPM) --dir backend run dev

dev-web: ## Run Vite dev server
	$(PNPM) --dir web run dev

compose-config: ## Validate Docker Compose config
	docker compose config --quiet
	docker compose -f deploy/local/docker-compose.yml config --quiet
	docker compose -f deploy/almaz-staging/docker-compose.yml config --no-interpolate --no-env-resolution --no-path-resolution --quiet

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
	$(PNPM) --dir backend run fixtures:author -- $(ARGS)

fixture-replay: compose-db ## Replay local fixture file(s) into Postgres; override FIXTURE_FILE=fixtures/records.json
	$(PNPM) --dir backend run fixtures:replay -- $(FIXTURE_FILE)

chapters-import: ## Import docs/dsa-chapters.csv into fixture storage; override CSV_FILE=../docs/dsa-chapters.csv
	$(PNPM) --dir backend exec tsx src/chapters-csv-import.ts $(CSV_FILE) --out $(FIXTURE_FILE)

caucuses-import: ## Import docs/dsa-caucuses.csv into fixture storage; override CAUCUS_CSV_FILE=../docs/dsa-caucuses.csv
	$(PNPM) --dir backend exec tsx src/caucuses-csv-import.ts $(CAUCUS_CSV_FILE) --out $(FIXTURE_FILE)

registry-health: ## Validate canonical fixture records for invalid or duplicate directory entries; override FIXTURE_FILE=fixtures/records.json
	$(PNPM) --dir backend run registry:health -- $(FIXTURE_FILE)

ingest-atproto: ## Run opt-in live ATProto ingestion; set ATPROTO_LIVE_INGESTION=true to connect
	ATPROTO_LIVE_INGESTION=$(ATPROTO_LIVE_INGESTION) $(PNPM) --dir backend run ingest:atproto

foundation-publish: ## Publish the canonical provisional migration through an OAuth-authorized registry PDS session
	$(PNPM) --dir backend run foundation:publish -- $(FIXTURE_FILE)

open-pilot-check: ## Verify Open Pilot issue template is preserved
	@test -f .gitea/ISSUE_TEMPLATE/open-pilot-task.yaml
	@grep -q 'Test Command' .gitea/ISSUE_TEMPLATE/open-pilot-task.yaml
