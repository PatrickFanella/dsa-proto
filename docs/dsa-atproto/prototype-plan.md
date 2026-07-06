# Prototype Plan

## Current purpose

`dsa-proto` is now a local civic data workbench for exploring how AT Protocol-shaped public records could support DSA-adjacent directories, authority/status labels, fixture publishing, and public governance structure browsing.

The original Milestone 1 was a small chapter/caucus/member directory. That core is complete, and the prototype has intentionally expanded into nearby experimental lanes:

- deterministic fixture ingestion
- chapter and caucus CSV imports
- local browser publishing for safe fixture records
- prototype verification/dispute assertions
- opt-in live ATProto ingestion script
- public org-chart unit and relationship explorer

The prototype still should not imply production readiness, real DSA verification, or a real PDS publishing path.

## Current local outcome

A local Docker Compose app where a user can:

1. Open a public prototype UI.
2. Browse chapter, caucus/working group, and opt-in member-affiliation records.
3. Search and filter records by type, state, chapter kind, and text.
4. View authority/status details: DID, handle, collection, record type, AT URI, trust label, verification status, and raw record JSON.
5. Import chapter and caucus fixture records from CSV files.
6. Author local chapter and verification assertion fixtures from the browser or CLI.
7. Replay fixture records into Postgres with accepted/rejected reporting.
8. Browse a public DSA org-chart alignment model built from `org.dsa.profile.orgUnit` and `org.dsa.relationship.governance` records.
9. Keep all local work deterministic and verifiable with `make verify`.

## Audience

Primary audience: DSA members and organizers evaluating whether a shared public civic data layer is understandable and useful.

Secondary audience: developers evaluating whether the transport-neutral record envelope architecture can later accept real ATProto records.

## Product shape

The prototype currently has three user-facing areas:

- Directory: searchable chapter/caucus/member-affiliation cards with authority/status detail.
- Local publisher: browser forms for chapter fixtures and mock verification/dispute assertions.
- Org chart explorer: source-linked public governance units and relationships from the DSA org chart.

This is more than a static microsite, but it is still a local prototype. Browser publishing is local-only and unauthenticated; it must not be treated as production admin tooling.

## Supported record envelopes

Directory records:

1. `org.dsa.profile.chapter`
2. `org.dsa.profile.caucus`
3. `org.dsa.affiliation.member`

Trust and governance records:

4. `org.dsa.verification.assertion`
5. `org.dsa.profile.orgUnit`
6. `org.dsa.relationship.governance`

Verification assertions and org-chart records are stored as public record envelopes, but they do not become ordinary directory cards.

## Source of truth model

The long-term model remains hybrid:

```text
ATProto-shaped public records = publication/source layer
Postgres = indexed read model for app queries
REST API = local app/developer convenience layer
React UI = public prototype workbench
```

Current local sources include:

- built-in deterministic seed arrays
- `backend/fixtures/records.json`
- `docs/dsa-chapters.csv`
- `docs/dsa-caucuses.csv`
- browser-published local fixture records
- optional live ATProto firehose events when explicitly enabled

## Deliberate simplifications

- Fixture replay remains the default local path.
- Live ATProto ingestion is opt-in and disabled by default.
- Browser publishing creates local fixture records, not real PDS records.
- Verification assertions are prototype records, not real DSA legitimacy decisions.
- The org-chart explorer models public chart structure, not full bylaws or internal governance practice.

## Verification and trust

The app distinguishes governance trust/verification states such as:

- `verified`
- `verified-by-national`
- `verified-by-chapter`
- `self-declared`
- `uncertain`
- `disputed`
- `revoked`
- `community-submitted`

These states model the intended governance vocabulary. Local fixtures still do not establish real official status, verified membership, or DSA endorsement until production authority-chain validation exists.

## Explicit safety boundary

Do not model or seed:

- internal votes
- private deliberation
- dues/payment status
- casework or disciplinary records
- high-risk organizing logistics
- private member rosters
- personal contact information not explicitly published for the demo

Opt-in member-affiliation examples should remain public self-declarations only. They should not imply verified membership or expose private contact data.

## Current success criteria

The prototype is healthy when:

- `make verify` passes.
- `docker compose up --build` starts Postgres, backend, and web.
- `make chapters-import`, `make caucuses-import`, and `make fixture-replay` work locally.
- The UI can browse imported chapters/caucuses and built-in member-affiliation examples.
- Entity detail pages show authority/status and verification metadata.
- The browser publisher can create local chapter fixtures and verification assertions.
- `/api/org-chart` and the UI org-chart explorer show source-linked governance units and relationships.
- Docs clearly distinguish local prototype behavior from production ATProto/PDS behavior.

## Current non-goals

- Real PDS login or record publishing.
- Live ingestion enabled by default.
- Production verification/labeling service.
- Authenticated production admin dashboard.
- Complete formal Lexicon JSON definitions.
- Modeling sensitive internal organizing data.
- Deploying a public demo with local admin endpoints exposed.
