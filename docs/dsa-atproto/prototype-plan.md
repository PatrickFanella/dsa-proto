# Prototype Plan

## Purpose

Build a working local prototype that demonstrates how AT Protocol-shaped public records can become a DSA-facing chapter and organization directory.

The prototype should be useful to DSA members first. It should make the idea concrete without pretending to solve production trust, governance, moderation, or firehose indexing yet.

## Milestone 1 outcome

A local Docker Compose app where a user can:

1. Open a public microsite/directory UI.
2. Browse chapter, caucus/working group, and opt-in member profile records.
3. Search or filter those records.
4. View the ATProto identity mapping behind a record: DID, handle, record type, and mock AT URI.
5. See records served through a simple REST API backed by Postgres.
6. Re-seed the database from mocked ATProto-shaped records.

## Audience

Primary audience: DSA members evaluating whether this shared public data layer is understandable and useful.

Secondary audience: developers evaluating whether the architecture can later grow into real ATProto ingestion.

## Product shape

Milestone 1 should feel like a small public microsite with directory/search behavior, not an admin-heavy internal tool.

Recommended first screens:

- Home/overview page explaining the prototype.
- Directory page listing public entities.
- Entity detail page showing human-readable information plus protocol metadata.
- Developer/debug panel or section showing the source mocked record.

## Data types for the first pass

Prioritize these records:

1. `org.dsa.profile.chapter`
2. `org.dsa.profile.caucus`
3. `org.dsa.affiliation.member`

Events, endorsements, statements, publications, and source-linked voter guides are important, but should wait until the core identity/profile loop works.

## Source of truth model

The long-term model is hybrid:

```text
ATProto records = public write/publication layer
Postgres = indexed read model for app queries
REST API = local app/developer convenience layer
React UI = public directory/microsite
```

Milestone 1 should simulate the ATProto layer with versioned seed files containing mocked records that match the proposed Lexicon shapes.

## Deliberate simplification

Treat real firehose/relay consumption as Phase 2.

For Milestone 1, build an ingestion boundary that accepts mocked records so the code shape can later support real records without committing to live network integration early.

## Verification and trust

Identity verification is deferred for now.

Milestone 1 may include a simple display field such as `trustLabel` or `verificationStatus`, but it must not imply a real DSA verification process exists.

Use labels like:

- `mock-official`
- `self-declared`
- `unverified`
- `experimental`

The UI should make clear that the data is sample prototype data.

## Explicit safety boundary

Do not model or seed:

- Internal votes
- Private deliberation
- Dues/payment status
- Casework or disciplinary records
- High-risk organizing logistics
- Private member rosters
- Personal contact information not explicitly published

Opt-in member profiles should be public profile examples only. They should not imply verified membership or expose private contact data.

## Backend priorities

Milestone 1 backend work should prioritize:

1. Postgres schema and seed data.
2. Mock ATProto record ingestion.
3. Lexicon-shaped validation with Zod.
4. REST endpoints for list/detail/search.
5. Light admin CRUD only if needed to demonstrate writing records locally.

Recommended API endpoints:

```http
GET /health
GET /api/entities
GET /api/entities/:id
GET /api/chapters
GET /api/caucuses
GET /api/members
POST /api/admin/ingest/mock-records
```

The admin endpoint can remain development-only and should not require real auth in Milestone 1 if it is not exposed beyond local development.

## Success criteria

The milestone works when:

- `docker compose up` starts Postgres, backend, and web.
- Seed data can be loaded into Postgres deterministically.
- The UI shows a browsable chapter directory from structured records.
- Entity detail pages show DID/handle/record type/AT URI mapping.
- The REST API returns normalized records from Postgres.
- The README explains how to run and demo the prototype.
- `make verify` passes.

## Non-goals for Milestone 1

- Real PDS login or publishing.
- Live ATProto firehose consumption.
- Production verification/labeling service.
- Authentication and authorization.
- Complete formal Lexicon JSON definitions.
- A complete admin dashboard.
- Modeling sensitive internal organizing data.
