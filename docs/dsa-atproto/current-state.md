# Current State

Last regrouped after commit `18ebf9c Add DSA org chart explorer`.

## Summary

`dsa-proto` is a local TypeScript/Postgres/React prototype that models public DSA-adjacent records as ATProto-shaped envelopes, indexes them into a read model, and displays them in a directory and org-chart explorer.

It is not a production ATProto service, not an official DSA registry, and not a real PDS publishing workflow.

## Implemented capabilities

### Directory records

Supported directory card types:

- `org.dsa.profile.chapter`
- `org.dsa.profile.caucus`
- `org.dsa.affiliation.member`

The directory supports:

- text search
- type filter
- state filter for chapters
- chapter-kind filter for chapters / organizing committees
- detail/provenance panel
- verification status display
- raw record JSON preview
- registry health dashboard panel backed by the canonical fixture file

### Public civic records

Implemented Plan 2 civic record type:

- `org.dsa.statement.public`
- `org.dsa.publication.profile`
- `org.dsa.publication.article`
- `org.dsa.endorsement.public`

Statements are stored as raw ATProto-shaped records, served through `/api/statements`, and rendered in the UI. Publication profiles/articles are served through `/api/publications` and `/api/articles`. Public endorsements are served through `/api/endorsements`. None of these become ordinary directory cards.

Selected entity detail panels also show related public statements, related publication articles, and related public endorsements when the linked URIs point back to the entity.

### Ingestion and fixture workflows

Implemented ingestion paths:

- deterministic built-in seed records
- `backend/fixtures/records.json`
- `make chapters-import`
- `make caucuses-import`
- `make registry-health`
- `GET /api/registry/health`
- `make fixture-replay`
- browser `POST /api/admin/fixtures/ingest`
- opt-in `pnpm --dir backend run ingest:atproto`

The default local path is fixture replay. Live ATProto ingestion is disabled unless explicitly enabled.

### Trust and verification

Supported trust/verification record:

- `org.dsa.verification.assertion`

Verification assertion records can mark a subject as:

- `mock-verified`
- `self-declared`
- `unverified`
- `disputed`
- `revoked`
- `experimental`

These labels are prototype metadata only.

### Org chart explorer

Supported org-chart records:

- `org.dsa.profile.orgUnit`
- `org.dsa.relationship.governance`

The org-chart explorer supports:

- `/api/org-chart`
- `/api/org-chart?kind=<kind>`
- `/api/org-chart?unit=<at-uri>`
- grouped unit display
- unit-focused incoming/outgoing relationships
- source link to the June 2020 public DSA organization chart

Org-chart records are stored in `atproto_records`, but they do not become ordinary directory cards.

### Browser local publisher

The web UI includes local-only publisher forms for:

- chapter fixture records
- verification assertion records

These forms post to `POST /api/admin/fixtures/ingest`. They are unauthenticated local prototype tools and must not be exposed as production admin functionality.

## Data sources in the repo

- `docs/dsa-chapters.csv`: public chapter list used by `make chapters-import`.
- `docs/dsa-caucuses.csv`: neutral curated caucus fixture list used by `make caucuses-import`.
- `backend/fixtures/records.json`: generated fixture storage replayed into Postgres.
- `make registry-health`: offline validation for canonical fixture records and duplicate registry identifiers.
- `GET /api/registry/health`: backend summary endpoint for the same canonical fixture file.
- Built-in seed arrays in backend domain code.
- DSA organization chart source documented in `org-chart-alignment.md`.

There are also local scratch docs that may remain untracked while being evaluated:

- `docs/caucus-article.md`
- `docs/caucus-article-extraction.md`
- `docs/caucus-shape.md`

## Current architecture

```text
CSV / fixture JSON / browser publisher / optional live firehose
          ↓
RecordEnvelope validation
          ↓
raw atproto_records
          ↓
directory_entities read model + org-chart raw-record projection
          ↓
REST API
          ↓
React local workbench
```

## Safety boundary

The prototype should continue to exclude:

- private member rosters
- dues/payment status
- internal votes
- casework
- disciplinary records
- private deliberation
- high-risk organizing logistics
- personal contact information not explicitly published for the demo

## Recommended next lanes

1. **Source/provenance model**: make sources and caveats first-class for imported records and derived org-chart/caucus data.
2. **Demo stabilization**: clean reset flows, screenshots, README flow, and safe defaults.
3. **Expanded civic records**: public statements, publications/articles, and endorsements slices implemented; events remain planned.
4. **Safe deploy path**: public demo with local admin/publisher functionality disabled or protected.
