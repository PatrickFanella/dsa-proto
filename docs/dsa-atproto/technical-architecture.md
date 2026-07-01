# Technical Architecture

## Architecture summary

Milestone 1 should implement the hybrid model locally with mocked ATProto records.

```text
Mock ATProto seed records
        ↓
Ingestion + validation layer
        ↓
Postgres indexed read model
        ↓
Node REST API
        ↓
Vite React directory/microsite
```

This preserves the long-term shape from `architecture.md` while avoiding live PDS, relay, or firehose dependencies in the first build.

## Existing stack

Use the current repository stack:

- TypeScript workspace managed by pnpm
- Node backend in `backend/`
- Vite React frontend in `web/`
- Postgres via `docker-compose.yml`
- SQL migrations in `migrations/`
- `make verify` as the canonical check

## Data flow

### 1. Mock records

Store mock records as JSON fixtures in the repository, for example:

```text
backend/src/fixtures/mock-records.json
```

Each fixture should include ATProto metadata plus a Lexicon-shaped payload:

```json
{
  "uri": "at://did:plc:nycdsa/org.dsa.profile.chapter/self",
  "cid": "bafy...mock",
  "did": "did:plc:nycdsa",
  "handle": "nyc.dsausa.org",
  "collection": "org.dsa.profile.chapter",
  "indexedAt": "2026-07-01T00:00:00Z",
  "record": {
    "$type": "org.dsa.profile.chapter",
    "name": "New York City DSA",
    "shortName": "NYC-DSA",
    "jurisdiction": {
      "type": "city",
      "name": "New York City",
      "state": "NY",
      "country": "US"
    },
    "website": "https://socialists.nyc/",
    "status": "active"
  }
}
```

### 2. Validation

Use Zod schemas to validate the mocked record envelope and the supported `$type` payloads.

Minimum supported payload schemas:

- `org.dsa.profile.chapter`
- `org.dsa.profile.caucus`
- `org.dsa.affiliation.member`

Validation should reject unknown required shapes while allowing future extension fields where appropriate.

### 3. Ingestion

The ingestion layer should:

- Accept an array of mocked records.
- Validate each record.
- Upsert the raw record envelope.
- Upsert a normalized entity row for directory queries.
- Preserve original record JSON for debug/developer inspection.

This boundary should be named generically enough to later accept real ATProto records.

### 4. Postgres read model

Start with a compact schema:

```sql
atproto_records
- uri primary key
- cid
- did
- handle
- collection
- record jsonb
- indexed_at timestamptz

directory_entities
- id primary key
- record_uri references atproto_records(uri)
- entity_type
- name
- short_name
- handle
- did
- jurisdiction_name
- jurisdiction_region
- website
- description
- trust_label
- status
- search_text
- updated_at timestamptz
```

The `directory_entities` table is intentionally denormalized. It is an indexed app view, not the canonical public record.

### 5. REST API

Recommended first endpoints:

```http
GET /health
GET /api/entities?type=&q=&region=
GET /api/entities/:id
GET /api/records/:encodedUri
POST /api/admin/ingest/mock-records
```

Response shape for entity list items:

```json
{
  "id": "...",
  "type": "chapter",
  "name": "New York City DSA",
  "shortName": "NYC-DSA",
  "handle": "nyc.dsausa.org",
  "did": "did:plc:nycdsa",
  "jurisdiction": "New York City, NY",
  "trustLabel": "mock-official",
  "status": "active"
}
```

Detail responses should include:

- normalized entity fields
- source record URI
- DID and handle
- collection / `$type`
- raw record JSON

### 6. Frontend

The frontend should remain simple:

- Fetch entities from the REST API.
- Provide search/filter controls.
- Render entity cards.
- Render detail views or expanded panels.
- Show protocol metadata clearly.
- Label prototype data as mocked/experimental.

Avoid complex state management until the app has real interaction needs.

## Trust and verification handling

Milestone 1 does not implement real verification.

Use a placeholder field in seed data and normalized views:

```text
trustLabel: mock-official | self-declared | unverified | experimental
```

The UI should display this as prototype metadata, not as a real legitimacy claim.

## Firehose/relay future path

Phase 2 can replace or supplement fixture ingestion with a real subscriber:

```text
ATProto relay/firehose
        ↓
record filter for org.dsa.* collections
        ↓
same validation layer
        ↓
same Postgres upsert/read model
```

Milestone 1 should keep this path open by isolating ingestion from transport.

## Deployment posture

The prototype should be deployable later, but local correctness comes first.

For now:

- Keep secrets out of git.
- Use `.env.example` placeholders.
- Keep `docker compose` working.
- Avoid external service dependencies.
- Do not expose admin ingestion endpoints in a production deployment without auth.

## Verification

Every implementation issue should include a deterministic test command. Default:

```bash
make verify
```

Smaller issue-level checks can use package-specific tests only when they fully prove the change.
