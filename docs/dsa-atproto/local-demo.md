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

## Local fixture author -> replay -> browse loop

This prototype also supports an opt-in local publishing loop that does not use a real PDS.

1. Author a deterministic record into fixture storage:

   ```bash
   pnpm --dir backend run fixtures:author -- --type chapter --name "West Side DSA" --shortName "WSDSA"
   pnpm --dir backend run fixtures:author -- --type verification --subjectUri at://did:plc:westside/org.dsa.profile.chapter/self --subjectDid did:plc:westside --issuerDid did:plc:nationaldsa --issuerHandle dsausa.org --assertion verified
   ```

2. Replay fixture file(s) into Postgres:

   ```bash
   pnpm --dir backend run fixtures:replay -- fixtures/records.json
   ```

3. Browse the UI or API as usual:

   - <http://localhost:5173>
   - <http://localhost:8080/api/entities>

This is local prototype fixture authoring and replay, not live ATProto publishing or a real PDS write path.

## Browser prototype publisher

The web UI also includes a local-only prototype publisher panel for quick chapter fixture creation.

1. Start the stack:

   ```bash
   docker compose up --build
   ```

2. Open <http://localhost:5173>.
3. Use the **Local prototype publisher** form to edit chapter fields.
4. Review the generated ATProto-shaped JSON preview.
5. Click **Publish local fixture**.
6. The browser posts to the local backend endpoint:

   ```http
   POST /api/admin/fixtures/ingest
   ```

7. The backend validates the record, ingests it through the same record-envelope replay path, refreshes the directory, and selects the new chapter for provenance review.

This browser flow is intentionally limited to safe chapter records for now. It is not authenticated, is not production admin tooling, and should remain local prototype-only until a real security model exists.

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
