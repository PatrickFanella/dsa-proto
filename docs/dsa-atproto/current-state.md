# Current State

`dsa-proto` is a TypeScript Node + Postgres + Vite React prototype for a public DSA civic data layer. It uses AT Protocol-shaped record envelopes, but it is not a live PDS, not an official DSA registry, and not a production authority system.

The public Almaz demo is read-only at <https://demo.dsaslate.us>.

## Built components

- **Backend:** TypeScript Node API, Postgres persistence, in-memory fallback for local/test use.
- **Frontend:** Vite React “DSA Civic Data Layer” dashboard.
- **Dataset:** canonical fixture file at `backend/fixtures/records.json` with metadata.
- **Operations:** Docker Compose for local/demo deployment; `make verify` for validation.

## Current data model

Foundation record families currently represented in fixtures and code:

- `org.dsa.profile.chapter`
- `org.dsa.profile.caucus`
- `org.dsa.affiliation.member` for opt-in public affiliation examples
- `org.dsa.profile.orgUnit`
- `org.dsa.relationship.governance`
- `org.dsa.verification.assertion`
- `org.dsa.identity.continuity`
- `org.dsa.authority.delegation`
- `org.dsa.authority.mandate`
- `org.dsa.authority.charter`
- `org.dsa.authority.revocation`
- `org.dsa.authority.dispute`
- `org.dsa.record.archive`

App-layer public record families currently represented:

- `org.dsa.statement.public`
- `org.dsa.publication.profile`
- `org.dsa.publication.article`
- `org.dsa.endorsement.public`
- `org.dsa.event.public`

## Current API surface

Read endpoints:

- `GET /health`
- `GET /ready`
- `GET /api/entities`
- `GET /api/entities/:id`
- `GET /api/org-chart`
- `GET /api/records/resolve?uri=...`
- `GET /api/statements`
- `GET /api/publications`
- `GET /api/articles`
- `GET /api/endorsements`
- `GET /api/events`
- `GET /api/activity`
- `GET /api/registry/health`

Local/development mutation tooling:

- `POST /api/admin/fixtures/ingest` validates and ingests fixture envelopes when local admin ingest is enabled. It is disabled on Almaz.

Fail-closed app-write preview:

- `POST /api/write/records`
- `GET /api/write/operations/:operationId`

The write gateway is disabled by default and disabled on Almaz. When enabled in non-demo environments, it uses app registry scope checks, idempotency, optimistic-concurrency headers, private write-operation audit records, and pending-review behavior.

## Current UI

The web app is a read-oriented dashboard:

- hero and read-only demo posture;
- operational summary cards;
- searchable/filterable directory;
- selected entity profile with trust label and resolver context;
- known revisions, authority records, disputes, revocations, and archive markers;
- organization graph explorer;
- public activity feed for statements, articles, endorsements, and events;
- safety/readiness panel;
- developer publisher workbench only outside read-only demo mode.

## Fixture source of truth

For this prototype, the maintained fixture dataset is the source of truth. It is curated test/demo data, not production validation from DSA or from a live ATProto network.

Fixture workflows:

- `make chapters-import`
- `make caucuses-import`
- `make registry-health`
- `make fixture-replay`
- `pnpm --dir backend run fixtures:author -- ...`
- `pnpm --dir backend run fixtures:replay -- fixtures/records.json`

## Explicit non-goals

The built prototype does not implement:

- production authority-chain validation or key custody;
- live PDS publishing;
- authenticated production app writes;
- private member databases or internal workflow systems;
- external citation/proof-chain records;
- election/ballot systems.
