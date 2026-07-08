# dsa-proto

dsa-proto is a TypeScript Node + Vite React prototype for a public DSA civic data layer built on AT Protocol-shaped records.

## Built stack

- TypeScript Node backend
- Vite React frontend
- Postgres
- Docker Compose
- public Almaz read-only demo

The canonical fixture dataset lives at `backend/fixtures/records.json` with metadata, import/replay tooling, and health checks.

## Current UI

The web app is the DSA Civic Data Layer dashboard: hero, summary cards, searchable/filterable directory, selected entity profile with resolver context, org graph explorer, public activity feed, safety/readiness panel, and a developer workbench that only exposes local publisher tooling outside read-only mode.

## Read endpoints

`/health`, `/ready`, `/api/entities`, `/api/entities/:id`, `/api/org-chart`, `/api/records/resolve`, `/api/statements`, `/api/publications`, `/api/articles`, `/api/endorsements`, `/api/events`, `/api/activity`, `/api/registry/health`

## Demo posture

- Local backend may enable admin fixture ingest unless `DEMO_READ_ONLY=true` or `ENABLE_ADMIN_INGEST=false`
- Almaz uses fail-closed env and Caddy blocks `/api/admin*`
- Write gateway exists but stays disabled on Almaz (`ENABLE_WRITE_GATEWAY=false`, `ENABLE_WRITE_PUBLISH=false`, Caddy blocks `/api/write*`)

See [`docs/README.md`](docs/README.md) for the doc index and [`docs/dsa-atproto/README.md`](docs/dsa-atproto/README.md) for the current project docs.

## Open Pilot

This repository keeps the Open Pilot issue template and PR template. Bootstrap labels after creating the repository:

```bash
open-pilot labels bootstrap patrickfanella/dsa-proto
```

## License

GPL-3.0-only. See `LICENSE`.
