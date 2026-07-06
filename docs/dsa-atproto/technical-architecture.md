# Technical Architecture

## Architecture summary

The current prototype implements a local workbench around ATProto-shaped public record envelopes. The intended foundation is identity, authority, verification, roles, curated fixture authority, and the organizational graph; app-specific civic records should sit on top of that base.

```text
CSV files / fixture JSON / browser publisher / optional live firehose
        ↓
RecordEnvelope validation + replay/reporting
        ↓
Postgres raw record store (`atproto_records`)
        ↓
Directory read model (`directory_entities`) + org-chart projection
        ↓
Node REST API
        ↓
Vite React local workbench
```

Fixture replay remains the default local path. The live ATProto adapter exists as an opt-in script and is disabled by default.

## Existing stack

- TypeScript workspace managed by pnpm
- Node backend in `backend/`
- Vite React frontend in `web/`
- Postgres via `docker-compose.yml`
- SQL migrations in `migrations/`
- `make verify` as the canonical check

## Record envelope model

All records pass through a shared `RecordEnvelope` shape:

```json
{
  "uri": "at://did:plc:nycdsa/org.dsa.profile.chapter/self",
  "cid": "bafy...fixture",
  "did": "did:plc:nycdsa",
  "handle": "nyc.dsausa.org",
  "collection": "org.dsa.profile.chapter",
  "indexedAt": "2026-07-01T00:00:00.000Z",
  "trustLabel": "self-declared",
  "record": {
    "$type": "org.dsa.profile.chapter"
  }
}
```

Supported payload collections:

- `org.dsa.profile.chapter`
- `org.dsa.profile.caucus`
- `org.dsa.affiliation.member`
- `org.dsa.verification.assertion`
- `org.dsa.profile.orgUnit`
- `org.dsa.relationship.governance`
- app-layer public statement, publication, endorsement, and event records used by the current prototype

Validation rejects mismatched envelope collection and record `$type` values.

## Ingestion paths

### Fixture replay

`replayFixtureRecords` validates an array of unknown records, ingests accepted records, and returns rejected-record reports by index and reason.

Fixture sources include:

- built-in backend seed arrays
- `backend/fixtures/records.json`
- browser `POST /api/admin/fixtures/ingest`
- generated fixture files from CLI authoring/import commands

### CSV imports

CSV imports generate deterministic fixture records, then fixture replay ingests them:

- `make chapters-import` reads `docs/dsa-chapters.csv` and generates `org.dsa.profile.chapter` envelopes.
- `make caucuses-import` reads `docs/dsa-caucuses.csv` and generates `org.dsa.profile.caucus` envelopes.
- `make fixture-replay` starts/checks local Postgres and replays `backend/fixtures/records.json`.

### Browser publisher

The local UI posts generated record envelopes to:

```http
POST /api/admin/fixtures/ingest
```

Supported browser-published records today:

- chapter fixture envelopes
- verification assertion envelopes

This endpoint is local prototype tooling. It is not safe production admin functionality.

### Live ATProto adapter

The opt-in live script uses `@atproto/sync` `Firehose` and maps create/update events into `RecordEnvelope` values.

```bash
ATPROTO_LIVE_INGESTION=true pnpm --dir backend run ingest:atproto
```

Live ingestion is not part of `make verify`, is not started by Compose, and defaults to disabled.

## Postgres model

### Raw records

`atproto_records` is the canonical local store for all accepted envelopes:

- `uri` primary key
- `cid`
- `did`
- `handle`
- `collection`
- `record jsonb`
- `indexed_at timestamptz`

It stores directory records, verification assertions, org units, and governance relationships.

### Directory read model

`directory_entities` is an indexed, denormalized read model for public cards:

- chapter records
- caucus records
- opt-in member-affiliation records

It includes normalized fields such as name, handle, DID, jurisdiction fields, status, search text, trust label, and verification metadata.

Verification assertion records are applied at read time and stored in raw records; they do not become directory cards.

Org-chart records also stay out of `directory_entities` and are projected separately through `/api/org-chart`.

## REST API

Current endpoints:

```http
GET /health
GET /api/entities?type=&q=&state=&jurisdictionType=&limit=
GET /api/entities/:id
GET /api/chapters
GET /api/org-chart?kind=&unit=
POST /api/admin/fixtures/ingest
```

`GET /api/entities` returns normalized directory entities with authority, verification, and trust metadata. Detail responses include the raw record payload.

`GET /api/org-chart` returns source-linked org units and governance relationships. Optional filters can narrow by unit kind or focus around a single unit AT URI.

## Frontend

The React app currently includes:

- directory search and filters
- large chapter-list browsing controls
- entity cards and authority/status detail panel
- verification/trust display
- local chapter publisher
- local verification assertion publisher
- DSA org-chart explorer grouped by unit kind

The UI should continue to state clearly that records are fixture, curated, imported, or local prototype data unless/until a production trust root, authority-chain validation, key custody, recovery, and revocation model exists.

## Trust and verification handling

Trust fields use the governance vocabulary. Local/demo status is caveat metadata, not a `mock-*` trust label.

Directory responses can expose:

- `trustLabel`
- `verificationStatus`
- `verifiedBy`
- `verificationReason`

`org.dsa.verification.assertion` records can mark a subject as verified, disputed, revoked, or self-declared. This is useful for modeling behavior, but production legitimacy also requires issuer authorization, delegation rules, key custody, recovery, rotation, revocation, and dispute handling.

## Authority/status gap

The next architectural gap is first-class authority/status metadata backed by the curated fixture set.

Current imports and org-chart records are fixture-authored; the record model now focuses on issuer, authority path, effective dates, supersession, revocation, and disputes without external source-chain records.

Recommended next architecture slice:

- Keep authority/status metadata explicit in imported records and authority record types.
- Surface issuer, authority path, fixture caveats, and supersession/revocation status in directory and org-chart details.
- Preserve authority/status metadata through fixture replay, CSV import, browser publishing, and future live ingestion.

## Deployment posture

Local correctness comes first. Before any public deployment:

- Keep secrets out of git.
- Use `.env.example` placeholders.
- Keep `docker compose` working.
- Disable or protect local admin/publisher endpoints.
- Keep live ingestion opt-in.
- Make fixture/prototype/curated caveats visible without weakening trust-label semantics.
- Do not expose private or sensitive organizing data.

## Verification

Run:

```bash
make verify
```

Use narrower checks only when they fully prove a targeted change.
