# Foundation Contracts and Invariants

This is the app-facing contract implemented by the current prototype. It describes how apps should consume the foundation layer without inventing their own identity, authority, lifecycle, or publication rules.

## Fixture contract

- `backend/fixtures/records.json` is the prototype source of truth.
- Fixture data is demo data, not official DSA verification.
- Public UIs must preserve fixture/demo caveats for authority-sensitive records.

## Identity contract

Built identity anchors:

- record URI
- DID
- handle
- collection/type
- display name
- lifecycle state
- identity-continuity records for rename, supersession, archive, and tombstone cases

Invariants:

- Handles and display names can change.
- Apps should link to record URIs and display current handles/names from the read API.
- Superseded, archived, revoked, and tombstoned identities should remain understandable through resolver context and continuity records.

## Authority contract

Built authority context comes from fixture records and `/api/records/resolve?uri=...`.

Resolver output includes the target record, known revisions, lifecycle state, trust label, supporting authority records, active disputes, active revocations, archive markers, status, and fixture caveats.

Invariants:

- Apps should not infer official authority from recency or popularity.
- Apps should display disputes, revocations, archive markers, and weak trust labels when they affect interpretation.
- Ordinary app writes cannot create foundation authority records.

## Lifecycle contract

Canonical lifecycle states:

- `active`
- `inactive`
- `superseded`
- `deprecated`
- `revoked`
- `disputed`
- `archived`
- `tombstoned`

Record-family workflow states such as `draft`, `published`, `withdrawn`, `cancelled`, `resolved`, or `scheduled` are not trust labels. Consumers should use explicit API/resolver context when mapping them to currentness.

## Organizational graph contract

The foundation layer owns the public organizational graph.

Built graph behavior:

- org units and governance relationships are stored as records;
- `/api/org-chart` exposes grouped units and relationships;
- registry health validates known-node references, allowed relationship pairs, and hierarchical cycles;
- non-hierarchical cross-affiliations are not treated as hierarchy cycles.

Apps should consume this graph instead of rebuilding chapter/caucus/committee relationships locally.

## Trust/status contract

Trust labels:

- `official`
- `verified-by-national`
- `verified-by-chapter`
- `verified-by-caucus`
- `self-declared`
- `community-submitted`
- `secondary-source`
- `uncertain`

Invariants:

- Trust labels describe confidence/authority.
- Lifecycle states describe currentness and interpretation.
- Apps cannot upgrade trust labels on their own.

## Publication boundary

Built guardrails reject disallowed record families and obvious unsafe private-data-shaped payload keys during fixture replay, registry health validation, and live-ingest paths.

The current shared public layer is for public organizational and civic records only. Private member data, internal workflow state, sensitive logistics, external proof-chain records, and election/ballot systems remain outside the prototype.

## Write contract

The current app-write surface is a fail-closed preview, not production write access.

- `ENABLE_WRITE_GATEWAY=false` by default.
- `ENABLE_WRITE_PUBLISH=false` by default.
- Almaz keeps both false and Caddy blocks `/api/write*`.
- App registry scopes control allowed collections, hosts, and trust-label ceilings.
- Idempotency and optimistic-concurrency headers are required for write attempts.
- Review-required apps create private pending-review operations rather than public records.
- The first scoped app-writable family is `org.dsa.event.public` only.

## Compatibility contract

- The read contract is frozen in `docs/reference/foundation-read-contract-v1.md`.
- Additive response fields are allowed.
- Required-field removals, enum repurposing, or route removals require docs and migration notes.
- Historical plan docs are not part of the contract.
