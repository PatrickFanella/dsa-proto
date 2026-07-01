# Local Demo and Reseed Workflow

This demo shows the current Milestone 1 prototype: mocked ATProto-shaped public records are validated, loaded into a local Postgres read model, exposed through a REST API, and displayed in the directory UI.

The data is intentionally mocked. It is not real DSA verification, membership verification, or an official roster.

## Prerequisites

- Docker and Docker Compose
- pnpm 10.x if running verification outside Docker

## Start from a clean checkout

From the repository root:

```bash
pnpm install --frozen-lockfile
make verify
docker compose up --build
```

Then open:

- Web UI: <http://localhost:5173>
- API health check: <http://localhost:8080/health>
- Directory API: <http://localhost:8080/api/entities>

The Compose stack starts:

- Postgres on `localhost:5432`
- Backend API on `localhost:8080`
- Web UI on `localhost:5173`

## How mocked records are seeded

On backend startup, `bootstrapRepository` connects to Postgres, ensures the prototype tables exist, and ingests the deterministic mocked records from the backend seed arrays:

- `org.dsa.profile.chapter`
- `org.dsa.profile.caucus`
- `org.dsa.affiliation.member`

The backend upserts both:

- raw ATProto-shaped envelopes into `atproto_records`
- normalized searchable directory rows into `directory_entities`

If Postgres is unavailable, the backend falls back to an in-memory repository so local tests and development can still run.

## Reseed or reset the demo data

For the normal local demo, restarting the backend is enough to re-run deterministic upserts:

```bash
docker compose restart api
```

To reset the database volume completely and rebuild from seed data:

```bash
docker compose down -v
docker compose up --build
```

Use the destructive reset only when you intentionally want to discard local Postgres data.

## Demo script

1. Open <http://localhost:5173>.
2. Point out the prototype banner: the directory is built from mocked public records, not live ATProto or verified DSA data.
3. Browse the directory cards:
   - chapters
   - caucuses / working groups
   - opt-in member-affiliation examples
4. Use the search box to find records by name, handle, DID, jurisdiction, focus area, or affiliated organization.
5. Use the type filter to switch between all records, chapters, caucuses, and member affiliations.
6. Click a card and review the protocol provenance panel:
   - entity type
   - DID
   - handle
   - collection / record type
   - mock AT URI
   - trust label
   - raw record JSON
7. For member-affiliation examples, call out that they are public prototype self-declarations. They do not imply verified membership.
8. Open <http://localhost:8080/api/entities> to show the normalized API response that powers the UI.
9. Optionally try query filters:

   ```text
   http://localhost:8080/api/entities?type=chapter
   http://localhost:8080/api/entities?type=member-affiliation&q=alex
   http://localhost:8080/api/entities?q=climate
   ```

## What the prototype proves

- ATProto-shaped public records can be normalized into a simple civic directory.
- The app can preserve protocol provenance alongside user-readable fields.
- Search and type filters work over a Postgres-backed read model.
- The mocked ingestion boundary can later be replaced by real ATProto transport without changing the UI concept.

## Safety boundary

Do not model or seed private organizing data in this prototype.

The seed data and future demo data must exclude:

- private member rosters
- dues or payment status
- internal votes
- casework
- disciplinary records
- private deliberation
- high-risk organizing logistics
- personal contact information that was not explicitly published for the demo

Trust labels such as `mock-official`, `self-declared`, `unverified`, and `experimental` are prototype labels only. They are not real DSA verification decisions.
