# dsa-proto

dsa-proto is a prototype for exploring how Democratic Socialists of America chapters, caucuses, committees, campaigns, and publications could use AT Protocol as a shared public civic data layer.

The first project notes live in [`docs/dsa-atproto/`](docs/dsa-atproto/). This repository uses a TypeScript Node backend, Vite React TypeScript frontend, Postgres, Docker Compose, and Open Pilot conventions.

## Quick start

```bash
make verify
```

To run the local prototype UI, API, and Postgres stack:

```bash
docker compose up --build
```

Then open <http://localhost:5173>. See [`docs/dsa-atproto/local-demo.md`](docs/dsa-atproto/local-demo.md) for the clean-checkout setup, reseed/reset workflow, and reviewer demo script.

## Current planning docs

- [`docs/dsa-atproto/README.md`](docs/dsa-atproto/README.md) — concept overview
- [`docs/dsa-atproto/architecture.md`](docs/dsa-atproto/architecture.md) — infrastructure layers
- [`docs/dsa-atproto/lexicons.md`](docs/dsa-atproto/lexicons.md) — proposed record namespaces and schemas
- [`docs/dsa-atproto/governance.md`](docs/dsa-atproto/governance.md) — verification, disputes, schema evolution, and safety
- [`docs/dsa-atproto/app-ideas.md`](docs/dsa-atproto/app-ideas.md) — possible applications
- [`docs/dsa-atproto/requirements-interview.md`](docs/dsa-atproto/requirements-interview.md) — first milestone interview
- [`docs/dsa-atproto/answers.md`](docs/dsa-atproto/answers.md) — answered requirements interview
- [`docs/dsa-atproto/current-state.md`](docs/dsa-atproto/current-state.md) — current implementation baseline and next lanes
- [`docs/dsa-atproto/prototype-plan.md`](docs/dsa-atproto/prototype-plan.md) — first local prototype scope
- [`docs/dsa-atproto/local-demo.md`](docs/dsa-atproto/local-demo.md) — local run, reseed/reset, and reviewer demo flow
- [`docs/dsa-atproto/technical-architecture.md`](docs/dsa-atproto/technical-architecture.md) — implementation architecture
- [`docs/dsa-atproto/org-chart-alignment.md`](docs/dsa-atproto/org-chart-alignment.md) — public org chart mapping notes
- [`docs/dsa-atproto/atproto-ingestion-spike.md`](docs/dsa-atproto/atproto-ingestion-spike.md) — real ATProto ingestion adapter spike
- [`docs/dsa-atproto/roadmap.md`](docs/dsa-atproto/roadmap.md) — phased roadmap
- [`docs/dsa-atproto/gitea-issues.md`](docs/dsa-atproto/gitea-issues.md) — proposed implementation issues

## Open Pilot

This repository keeps the Open Pilot issue template and PR template. Bootstrap labels after creating the repository:

```bash
open-pilot labels bootstrap patrickfanella/dsa-proto
```

## License

GPL-3.0-only. See `LICENSE`.
