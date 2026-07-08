# Local Demo

This document describes the current local demo workflow for the built TypeScript/Postgres/Vite prototype.

The data is curated fixture data. It is not real DSA verification, membership verification, or an official roster.

## Prerequisites

- Docker and Docker Compose
- pnpm 10.x when running checks outside Docker

## Start locally

From the repository root:

```bash
pnpm install --frozen-lockfile
make verify
docker compose up --build
```

Open:

- Web UI: <http://localhost:5173>
- API health: <http://localhost:8080/health>
- API readiness: <http://localhost:8080/ready>
- Directory API: <http://localhost:8080/api/entities>
- Registry health API: <http://localhost:8080/api/registry/health>

The Compose stack starts Postgres, the backend API, and the web UI.

## Fixture dataset

The canonical dataset is `backend/fixtures/records.json`. Backend startup loads that file for the local/demo read model when Postgres is available. Tests and local fallback can use built-in records when needed.

Useful fixture commands:

```bash
make chapters-import
make caucuses-import
make registry-health
make fixture-replay
```

Author local fixture examples:

```bash
pnpm --dir backend run fixtures:author -- --type chapter --name "West Side DSA" --shortName "WSDSA"
pnpm --dir backend run fixtures:author -- --type verification --subjectUri at://did:plc:westside/org.dsa.profile.chapter/self --subjectDid did:plc:westside --issuerDid did:plc:nationaldsa --issuerHandle dsausa.org --assertion verified
pnpm --dir backend run fixtures:replay -- fixtures/records.json
```

## Current UI walkthrough

1. Open <http://localhost:5173>.
2. Confirm the page presents the **DSA Civic Data Layer** dashboard and read-only/demo posture.
3. Review the summary cards for entities, foundation graph records, app-layer records, and write posture.
4. Search/filter the directory by text, entity type, state, and chapter kind.
5. Select an entity and review:
   - DID, handle, collection, record URI, status, and trust label;
   - resolver status and fixture caveat;
   - known revisions;
   - supporting authority records;
   - dispute, revocation, and archive markers when present.
6. Use the Organization Graph Explorer for org units and governance relationships.
7. Use the Public Activity Feed for statements, publication articles, endorsements, and events.
8. In read-only demo mode, confirm publishing is unavailable.

## Local admin fixture ingest

When local admin ingest is enabled, the developer workbench can post fixture envelopes to:

```http
POST /api/admin/fixtures/ingest
```

This is local development tooling. It is unauthenticated fixture ingest, not production admin functionality and not an app write API. The Almaz demo disables it with environment flags and Caddy route blocking.

## Write gateway preview

The app-write gateway exists for controlled staging/dev experiments:

```http
POST /api/write/records
GET /api/write/operations/:operationId
```

It is disabled by default and disabled on Almaz. When enabled outside demo mode, it validates app token, app scope, idempotency, optimistic-concurrency headers, schema, publication boundary, and subject/host constraints. The current registry app is review-required, so successful non-dry-run submissions become private `pending_review` operations rather than public records.

## Reset local data

Restart API to reload deterministic local data:

```bash
docker compose restart api
```

Destroy and rebuild the Postgres volume only when you intentionally want a clean local database:

```bash
docker compose down -v
docker compose up --build
```

## Safety boundary

Do not seed private organizing data. The fixture set should remain public, minimal, and safe to display in unrelated app views.
