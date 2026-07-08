# Implemented Record Families

The prototype uses AT Protocol-shaped records under an `org.dsa.*` namespace. These are TypeScript/Zod schemas in `backend/src/domain.ts`, not complete production Lexicon JSON files.

## Canonical vocabularies

| Concept | Current values |
| --- | --- |
| Trust labels | `official`, `verified-by-national`, `verified-by-chapter`, `verified-by-caucus`, `self-declared`, `community-submitted`, `secondary-source`, `uncertain` |
| Lifecycle states | `active`, `inactive`, `superseded`, `deprecated`, `revoked`, `disputed`, `archived`, `tombstoned` |
| Resolver status | `valid`, `expired`, `unresolved`, or a lifecycle state when that state controls interpretation |
| App/write operation status | `dry_run`, `pending_review`, `accepted`, `rejected`, `conflict` |

## Foundation families

Implemented foundation record families:

- `org.dsa.profile.chapter`
- `org.dsa.profile.caucus`
- `org.dsa.affiliation.member`
- `org.dsa.profile.orgUnit`
- `org.dsa.relationship.governance`
- `org.dsa.verification.assertion`
- `org.dsa.identity.continuity`
- `org.dsa.authority.delegation`
- `org.dsa.authority.mandate`
- `org.dsa.authority.charter`
- `org.dsa.authority.revocation`
- `org.dsa.authority.dispute`
- `org.dsa.record.archive`

These families support directory identity, public member-affiliation examples, organizational graph projection, verification/status display, resolver context, identity continuity, disputes, revocations, and archive markers.

## App-layer public families

Implemented app-layer public record families:

- `org.dsa.statement.public`
- `org.dsa.publication.profile`
- `org.dsa.publication.article`
- `org.dsa.endorsement.public`
- `org.dsa.event.public`

These records are readable through app-layer endpoints and the public activity feed. They are not ordinary directory cards.

## Write eligibility

Ordinary app-write preview is intentionally narrower than the read model.

- First scoped app-writable family: `org.dsa.event.public`.
- Foundation identity, authority, verification, org graph, archive, dispute, revocation, and member-affiliation families are closed to ordinary app writes.
- Statements, articles, and endorsements are currently read-only demo data.

## Removed / not implemented families

The current prototype does not implement election/ballot records, external proof-chain records, private member records, or production PDS account records.
