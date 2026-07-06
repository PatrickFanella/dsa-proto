# Foundation Layer

This project should first prove the official organizational infrastructure base: identity, authority, verification, roles, and the public organizational graph.

The foundation layer is not a general-purpose DSA app, not a voting system, not an external source archive, and not a publication platform. Those can be built later as applications that consume or publish approved records through this base.

## Source of truth

For this prototype, the maintained fixture set is the source of truth. We are not trying to prove an external source chain, citation graph, or production authority-chain validator inside the prototype.

The current question is: can a DSA-shaped public record layer describe identities, roles, verification states, and organizational relationships clearly enough for multiple tools to consume? The fixture set answers that question directly. External sources may inform fixture authorship, but they are not modeled as records and should not appear as foundation-layer requirements.

For the app-facing contract this base layer must provide, see [foundation-contracts.md](foundation-contracts.md).

## Base-layer purpose

The base layer answers foundational organizing questions:

- Which public DSA, chapter, caucus, committee, commission, working group, publication, or campaign identity is this?
- Which durable DID controls that identity?
- Which handle currently represents it?
- Which authority recognized, chartered, delegated to, appointed, revoked, archived, or disputed it?
- Which public roles or mandates does it hold?
- Which public records supersede, amend, or revoke earlier records?

## In scope first

Prioritize these record families before app-specific civic content:

- official national identity
- chapter identities
- caucus and member-formation identities
- committee, commission, working-group, staff-role, and publication identities
- governance relationships between organizational units
- public affiliation assertions, with opt-in and minimization
- verification assertions
- delegated authority, mandate, charter, appointment, revocation, dispute, and archive records

## Publication matrix

| Data class | Examples | ATProto foundation stance | Notes |
| --- | --- | --- | --- |
| Public organizational identity | National, chapter, caucus, committee, publication, campaign, or working-group profiles | In scope | Canonical foundation records. |
| Public organizational relationships | Chapter-to-national relationships, committee relationships, public mandates, public delegations, public archive/revocation/dispute states | In scope | Modeled as fixture-authored public records. |
| Public verification and trust state | `official`, `verified-by-national`, `verified-by-chapter`, `verified-by-caucus`, `self-declared`, `community-submitted`, `secondary-source`, `uncertain` | In scope | Trust labels describe how consuming apps should treat the record. |
| Optional public member affiliation | Opt-in public profile/role/interest statements | Allowed with minimization | Never use as proof of dues status or private membership. |
| Public civic records | Statements, publications, endorsements, public events, resource pointers | App-layer examples | Useful demos, but they should not drive foundation design. |
| Private member data | Legal names when not public, addresses, contact details, dues/payment status, private rosters | Out of scope | Do not publish into the shared public record layer. |
| Sensitive internal operations | Casework, disciplinary/grievance material, private deliberation, high-risk logistics | Out of scope | Requires separate private systems and governance. |
| Voting systems | Ballots, credentials, receipts, tallies, recounts, eligibility, voter rosters, vote metadata | Removed/out of scope | Voting is no longer part of this prototype. |
| External source records | External citation records, source-of-truth chains, authority-chain proof records | Removed/out of scope | The fixture set is the prototype source of truth. |

## Out of the base layer

Keep these out of the foundation layer:

- voting records, ballot casting, private eligibility checks, credentials, receipts, tallies, recounts, and voter rosters
- private member rosters, dues/payment status, home addresses, private contact details, casework, disciplinary records, grievance records, and sensitive logistics
- external source records, external citation graphs, and authority-chain proof records
- app-specific workflows such as publication editing, event management, endorsement intake, resource libraries, or campaign dashboards

Apps may publish approved public records outward, but their private state remains outside the shared AT Protocol base.

## Trust labels

Use canonical labels from the governance docs rather than prototype-only `mock-*` terms:

```text
official
verified-by-national
verified-by-chapter
verified-by-caucus
self-declared
community-submitted
secondary-source
uncertain
```

Disputed, revoked, and archived are lifecycle or authority-resolution states, not trust labels.

Local demo status should be shown as environment or fixture caveat metadata, not as a trust label.

## App-layer examples

Publications, endorsements, events, resource libraries, convention workspaces, and campaign dashboards are app-layer examples. They remain useful, but they should not drive the architecture until the identity and authority foundation is strong.

## Completion milestones

1. Canonical foundation lexicons and status matrix exist.
2. Fixture records include authority, dispute, revocation, and archive records.
3. Raw storage preserves immutable record revisions and current projections.
4. Resolver API explains fixture authority, disputes, lifecycle state, and caveats.
5. UI shows authority/status from the resolver before app-layer sections.
6. Tests cover validation, resolver semantics, and safety boundaries.

The detailed app-facing invariants for identity, authority, lifecycle, graph shape, verification/status, publication boundaries, corrections, and compatibility live in [foundation-contracts.md](foundation-contracts.md).

For the not-yet-implemented authority-chain validation and custody specifics, see [authority-chain-validation.md](authority-chain-validation.md).

## Implemented foundation tracer bullet

The foundation tracer bullet is complete when a reader can select a chapter, caucus, org unit, or public record and see:

- the current record envelope;
- immutable revisions known to the local indexer;
- authority records that support the claim;
- active dispute, revocation, and archive records;
- explicit caveats that fixtures are the prototype source of truth.
