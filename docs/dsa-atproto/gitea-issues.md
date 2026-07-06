# Proposed Gitea Issues

These issues are drafted for the Open Pilot task template. Each issue should be copied into Gitea as a separate issue when ready.

Do not add `agent:queued` until a human confirms scope and acceptance criteria.

## Issue 1: Add Postgres read model for mocked ATProto records

### Goal

Create the initial database schema for raw ATProto-shaped records and normalized directory entities.

### Context

Milestone 1 uses mocked ATProto records as the public record layer and Postgres as the indexed read model. The schema should support chapter, caucus, and opt-in member profile directory views.

### Acceptance Criteria

- Add a migration under `migrations/`.
- Create an `atproto_records` table for raw record envelopes.
- Create a `directory_entities` table for searchable normalized rows.
- Include useful indexes for entity type and text search/filtering.
- Keep schema generic enough to support future `org.dsa.*` record types.
- Do not model private member rosters, dues, votes, discipline, or private deliberation.

### Test Command

```bash
make verify
```

### Out Of Scope

- Backend ingestion code.
- Frontend UI changes.
- Real ATProto firehose integration.

## Issue 2: Add Zod validation for supported DSA ATProto record shapes

### Goal

Add TypeScript validation schemas for the mocked ATProto record envelope and the first supported DSA record types.

### Context

The prototype should ingest mocked records shaped like proposed Lexicons before writing normalized data to Postgres.

### Acceptance Criteria

- Add a schema module in `backend/src/`.
- Validate a generic record envelope with `uri`, `cid`, `did`, `handle`, `collection`, `indexedAt`, and `record`.
- Validate these payload types:
  - `org.dsa.profile.chapter`
  - `org.dsa.profile.caucus`
  - `org.dsa.affiliation.member`
- Add tests for valid and invalid records.
- Preserve flexibility for future optional fields.

### Test Command

```bash
pnpm --dir backend run test
```

### Out Of Scope

- Database writes.
- Frontend rendering.
- Formal complete Lexicon JSON definitions.

## Issue 3: Add mock ATProto seed records

### Goal

Add deterministic fixture data for chapters, caucuses/working groups, and opt-in member profile affiliations.

### Context

Milestone 1 needs sample public data that demonstrates DIDs, handles, record types, and AT URIs without relying on live ATProto infrastructure.

### Acceptance Criteria

- Add fixture data under `backend/src/fixtures/` or another documented location.
- Include at least:
  - 4 chapter records
  - 3 caucus or working group records
  - 4 opt-in member affiliation/profile examples
- Use realistic but clearly mock data.
- Include `trustLabel` values such as `official`, `verified-by-national`, `self-declared`, `unverified`, or `community-submitted`.
- Avoid private contact info, dues status, internal votes, private deliberation, casework, discipline, or high-risk logistics.
- Add tests that fixtures pass validation.

### Test Command

```bash
pnpm --dir backend run test
```

### Out Of Scope

- Real DSA data collection.
- Real verification claims.
- Firehose ingestion.

## Issue 4: Implement mocked record ingestion into Postgres

### Goal

Create backend code that validates mocked ATProto records and upserts raw and normalized records into Postgres.

### Context

The prototype's core architecture is ATProto-shaped records feeding a Postgres read model. This issue implements that boundary for local mocked records.

### Acceptance Criteria

- Add an ingestion service in `backend/src/`.
- Validate records before writing.
- Upsert raw envelopes into `atproto_records`.
- Upsert normalized rows into `directory_entities`.
- Preserve raw record JSON.
- Add tests for normalization behavior.
- Include a simple way to run ingestion locally, either through a script or development endpoint.

### Test Command

```bash
make verify
```

### Out Of Scope

- Live ATProto firehose/relay subscription.
- Authentication for admin workflows.
- Frontend display.

## Issue 5: Add REST API endpoints for directory records

### Goal

Expose normalized directory entities and raw record details through a simple REST API.

### Context

The frontend should not query Postgres directly. It should consume a small API that represents the indexed read model.

### Acceptance Criteria

- Add endpoints for:
  - `GET /api/entities`
  - `GET /api/entities/:id`
  - `GET /api/records/:encodedUri`
- Support simple query filters for entity type and search text.
- Return protocol metadata: DID, handle, collection, and record URI.
- Return clear 404 JSON for missing records.
- Add backend tests for endpoint behavior.

### Test Command

```bash
pnpm --dir backend run test
```

### Out Of Scope

- Complex pagination.
- GraphQL.
- Authenticated admin CRUD.

## Issue 6: Build the public directory UI

### Goal

Replace the placeholder web app with a simple directory/search microsite for DSA ATProto prototype records.

### Context

The first user-facing prototype should let DSA members browse chapters, caucuses/working groups, and opt-in member profile examples.

### Acceptance Criteria

- Add a landing/overview section that explains this is a prototype using mocked ATProto-shaped records.
- Fetch directory data from the backend API.
- Show entity cards for chapters, caucuses/working groups, and opt-in member examples.
- Add search and entity-type filtering.
- Show entity detail with DID, handle, collection, record URI, trust label, and raw record preview.
- Preserve a minimal responsive layout.
- Add or update frontend tests.

### Test Command

```bash
pnpm --dir web run test
```

### Out Of Scope

- Visual polish beyond clear usability.
- Authentication.
- Real ATProto login or publishing.

## Issue 7: Document local run and demo flow

### Goal

Update docs so another developer or reviewer can run and understand the prototype.

### Context

Success criteria include deployability later, but the immediate requirement is a working local Docker Compose prototype with a clear demo path.

### Acceptance Criteria

- Update `README.md` with local setup steps.
- Document how to run with `docker compose`.
- Document how seed/mock ingestion works.
- Add a short demo script: what to click, what to point out, and what the prototype proves.
- Keep safety boundary warnings visible.

### Test Command

```bash
make verify
```

### Out Of Scope

- Production deployment docs.
- Live ATProto setup docs.

## Issue 8: Spike real ATProto ingestion path

### Goal

Research and prototype the smallest real ATProto ingestion path that could feed the same validation and read-model boundary.

### Context

The requirements mention consuming firehose/relay data, but this should follow the mocked local prototype. This issue is a Phase 2 spike.

### Acceptance Criteria

- Identify current TypeScript libraries or APIs for ATProto relay/firehose consumption.
- Document setup requirements and risks.
- Prototype or pseudocode a transport adapter that emits the same internal record envelope used by mocked ingestion.
- Do not make live network ingestion required for local development.
- Update `technical-architecture.md` with findings.

### Test Command

```bash
make verify
```

### Out Of Scope

- Production firehose service.
- Long-running worker deployment.
- Moderation or verification service.
