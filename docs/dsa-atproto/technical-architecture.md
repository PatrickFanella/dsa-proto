# Technical Architecture

## Architecture summary

The built system is a local/public civic data workbench: TypeScript Node backend, Vite React frontend, Postgres, Docker Compose, and a read-only public Almaz demo.

```text
backend/fixtures/records.json + import/replay tooling
        ↓
Postgres read model and raw record store
        ↓
REST API
        ↓
React dashboard
```

## Stack

- TypeScript workspace
- Node backend in `backend/`
- Vite React frontend in `web/`
- Postgres via Docker Compose
- `make verify` as the main validation entrypoint

## Fixture and record model

The canonical fixture dataset is `backend/fixtures/records.json` with metadata. It feeds the local read model and demo UI.

Supported record families include:

- foundation: chapter, caucus, opt-in public member affiliation, org unit, governance relationship, verification assertion, identity continuity, authority/delegation/dispute/revocation/archive context
- app layer: public statements, publication profiles/articles, endorsements, events

## API surface

Read endpoints currently built:

- `/api/entities`
- `/api/entities/:id`
- `/api/org-chart`
- `/api/records/resolve`
- `/api/statements`
- `/api/publications`
- `/api/articles`
- `/api/endorsements`
- `/api/events`
- `/api/activity`
- `/api/registry/health`
- `/health`
- `/ready`

Local admin ingest exists only as dev tooling at `POST /api/admin/fixtures/ingest` and is disabled on Almaz.

## Frontend

The current UI is the DSA Civic Data Layer dashboard with a searchable/filterable directory, selected entity resolver context, org graph explorer, public activity feed, safety/readiness panel, and a local publisher workbench visible only outside read-only mode.

## Deployment posture

- Local backend can allow admin fixture ingest unless `DEMO_READ_ONLY=true` or `ENABLE_ADMIN_INGEST=false`
- Almaz uses fail-closed env and Caddy blocks `/api/admin*`
- Write gateway exists but remains disabled on Almaz (`ENABLE_WRITE_GATEWAY=false`, `ENABLE_WRITE_PUBLISH=false`, Caddy blocks `/api/write*`)

## Verification

```bash
make verify
```

## Canonical companion docs

- `foundation-layer.md`
- `foundation-contracts.md`
- `lexicons.md`
- `governance.md`
- `local-demo.md`
- `production-demo-safety-guards.md`
