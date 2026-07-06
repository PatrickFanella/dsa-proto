# Current State

Last regrouped after removing voting and external source-chain records from the prototype scope.

## Summary

`dsa-proto` is a local TypeScript/Postgres/React prototype for an official DSA-shaped AT Protocol infrastructure base. Its first priority is public identity, authority, verification, roles, and the organizational graph.

It is not a production ATProto service, not an official DSA registry, and not a real PDS publishing workflow. The maintained fixture set is the prototype source of truth. The public demo deployment is live on Almaz at <https://demo.dsaslate.us>, but it remains a demo with explicit safety gates, not production.

See `foundation-layer.md` for the intended foundation boundary and publication matrix.

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
- authority/status panel
- verification status display
- raw record JSON preview
- registry health dashboard panel backed by the canonical fixture file

### Public civic records

These records demonstrate apps that can sit on top of the base layer. They should not drive the architecture until the identity and authority foundation is strong.
These sections remain useful regression coverage, but foundation work should not add new app-layer scope until the resolver and authority graph are complete.

Implemented Plan 2 civic record types:

- `org.dsa.statement.public`
- `org.dsa.publication.profile`
- `org.dsa.publication.article`
- `org.dsa.endorsement.public`
- `org.dsa.event.public`

Statements are stored as raw ATProto-shaped records, served through `/api/statements`, and rendered in the UI. Publication profiles/articles are served through `/api/publications` and `/api/articles`. Public endorsements are served through `/api/endorsements`. Public events are served through `/api/events`. None of these become ordinary directory cards.

The unified civic activity feed is served through `/api/activity` and powers the top-level civic activity section plus the merged related civic activity timeline on selected entities. The feed normalizes statements, articles, endorsements, and events into one ordered list.

Selected entity detail panels also show related public statements, related publication articles, related public endorsements, related public events, and the merged civic activity timeline when the linked URIs point back to the entity.

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

The default local path is fixture replay. The fixture set is the source of truth for the prototype.

### Trust and verification

Supported trust/verification record:

- `org.dsa.verification.assertion`

Verification assertion records can mark a subject as:

- `verified`
- `self-declared`
- `unverified`
- `disputed`
- `revoked`
- `community-submitted`

These labels use the governance vocabulary. Local/demo fixture status should be shown as caveat metadata, not as `mock-*` trust labels.

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

## Fixture source of truth

- `docs/dsa-chapters.csv`: chapter fixture input used by `make chapters-import`.
- `docs/dsa-caucuses.csv`: caucus fixture input used by `make caucuses-import`.
- `backend/fixtures/records.json`: generated fixture storage replayed into Postgres.
- `make registry-health`: offline validation for canonical fixture records and duplicate registry identifiers.
- `GET /api/registry/health`: backend summary endpoint for the same canonical fixture file.
- Built-in seed arrays in backend domain code.
- Built-in seed arrays in backend domain code.

These are authored fixtures. The prototype no longer models external source records or source-of-truth chains.

There are also local scratch docs that may remain untracked while being evaluated:

- `docs/caucus-article.md`
- `docs/caucus-article-extraction.md`
- `docs/caucus-shape.md`

## Current architecture

```text
CSV / fixture JSON / browser publisher
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
- voting records, ballots, eligibility proofs, auth/session tokens, and vote receipts
- casework
- disciplinary records
- private deliberation
- high-risk organizing logistics
- personal contact information not explicitly published for the demo

## Recommended next lanes

1. **Foundation layer**: stabilize identity, authority, verification, roles, and the org graph before expanding app-specific slices.
2. **Demo stabilization**: clean reset flows, screenshots, README flow, and safe defaults.
3. **Fixture authoring model**: keep the curated fixture set coherent, minimal, and explicit about public/private boundaries.
4. **Safe deploy path**: public demo with local admin/publisher functionality disabled or protected.

## Foundation completion checklist

- [x] Canonical foundation lexicons and status matrix exist.
- [x] Fixture records include authority, dispute, revocation, and archive records.
- [x] Raw storage preserves immutable record revisions and current projections.
- [x] Resolver API explains record authority, disputes, lifecycle state, and caveats.
- [x] UI shows authority/status summaries from the resolver before app-layer sections for selected directory entities.
- [x] Tests cover validation, resolver semantics, and safety boundaries.
- [ ] Full UI drill-down for org units and public records is still pending.

Status note: the checklist above is a historical progress record, not a live audit log. Treat checked items as implementation milestones that were completed during this phase, while unchecked items remain future work.

## Foundation tracer bullet

The implemented foundation tracer bullet now covers backend storage, fixture records, resolver semantics, and a compact UI panel for selected directory entities. A reader can select a chapter or caucus and see resolver status, revision counts, authority records, dispute counts, and the caveat that fixtures are the prototype source of truth. Full drill-down for org units and app-layer public records remains a follow-up before calling the UI explorer complete.
