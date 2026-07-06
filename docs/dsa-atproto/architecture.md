# Architecture

## Design principle

Build the shared AT Protocol foundation layer first, not a single monolithic DSA application.

AT Protocol should provide public identity, authority, verification, signed records, common schemas, and synchronization. Apps should be separate views and workflows that consume the same underlying records.

```text
ATProto = identity, authority, and public-record layer
Indexer = normalization, graph, and trust layer
APIs = developer convenience layer
Apps = interchangeable user-facing views
Private systems = membership, permissions, and sensitive workflows
```

## Identity layer

AT Protocol identities can represent organizations, chapters, caucuses, committees, campaigns, publications, and individuals. For the base layer, identities and their authority relationships are more important than any single app built on top.

Example handles:

```text
@dsausa.org
@nyc.dsausa.org
@eastbay.dsausa.org
@labor.dsausa.org
@breadandroses.dsausa.org
@member.example.com
```

Each identity has:

- A DID
- A handle
- Signing keys
- A repository of records
- Optional verification relationships

Important distinctions:

```text
Handle = human-readable identity
DID = durable cryptographic identity
Record = signed public data with fixture-authored authority/status context
App = one interpretation of the data
```

## PDS strategy

A Personal Data Server stores user and organization repositories.

### Model A: DSA-hosted PDS

DSA runs PDS infrastructure for official entities.

Good for:

- National organization accounts
- Chapter accounts
- Committees
- Official publications
- Campaign accounts

Pros:

- Easier verification
- Better reliability
- Easier onboarding
- Institutionally controlled recovery paths

Cons:

- More operational responsibility
- Governance burden
- Centralization risk

### Model B: bring-your-own PDS

Members, independent caucuses, and community projects use any compatible PDS.

Good for:

- Individuals
- Unofficial groups
- Independent caucus media
- Broader ecosystem participation

Pros:

- More decentralized
- Less lock-in
- Lower infrastructure burden for DSA

Cons:

- Harder support
- Harder moderation
- More verification complexity

### Model C: hybrid

The recommended model is hybrid:

```text
Official DSA entities: DSA-hosted or chapter-hosted PDS
Members: any PDS
Caucuses: verified official PDS or independent PDS
Apps: consume from all, but label trust clearly
```

## Shared Lexicons

AT Protocol apps interoperate through Lexicons: schemas for record types.

DSA would define `org.dsa.*` record types for public organizational and civic data. These schemas let different apps read and write compatible records. The first stable schemas should describe identity, authority, verification, lifecycle state, and the organizational graph before app-specific records.

Examples:

```text
org.dsa.profile.chapter
org.dsa.profile.caucus
org.dsa.profile.committee
org.dsa.affiliation.member
org.dsa.affiliation.chapter
org.dsa.relationship.governance
org.dsa.verification.assertion
org.dsa.authority.delegation
org.dsa.authority.mandate
org.dsa.endorsement.candidate
org.dsa.event.meeting
org.dsa.event.canvass
org.dsa.statement.public
org.dsa.guide.electoral
```

## Organizational graph

The foundation layer should model explicit relationships before app workflows:

- Chapter belongs to national organization
- Member publicly affiliates with chapter
- Member publicly affiliates with caucus
- Committee belongs to chapter
- Campaign is supported by chapter
- Candidate appears in election
- Officer role is held under a public mandate or appointment
- Public record has fixture-authored authority/status context

This enables app queries like:

- Which chapters are active in this state?
- Which DID is the current official identity for this chapter?
- Which body can verify this committee or caucus?
- Which public roles or mandates are active?
- Which records were revoked, disputed, archived, or superseded?
- Which apps can safely consume this authority graph?

## Indexing layer

Most app developers should not need to implement raw AT Protocol synchronization. A shared indexer can listen to the firehose, validate DSA records, and expose normalized data.

```text
ATProto firehose
      ↓
DSA indexer
      ↓
Postgres / search index / graph cache
      ↓
Public APIs
      ↓
Apps
```

Indexer responsibilities:

- Subscribe to records with `org.dsa.*` types
- Validate Lexicons
- Resolve DIDs and handles
- Track creates, updates, and deletes
- Materialize graph relationships
- Apply trust and verification labels
- Expose query APIs
- Preserve public audit history where appropriate
- Mark disputed or revoked records without silently hiding history

## Trust and verification service

Publication does not equal legitimacy. Anyone can publish a claim. Apps need a separate trust layer.

Trust records should support labels such as:

```text
official
verified-by-national
verified-by-chapter
verified-by-caucus
self-declared
community-submitted
secondary-source
uncertain
disputed
revoked
archived
```

Examples:

- National verifies a chapter identity.
- Chapter verifies a committee identity.
- Chapter verifies that an endorsement record is official.
- Caucus verifies its officers or publication accounts.
- Member self-declares an affiliation.
- Chapter optionally confirms public membership status, if policy permits.

Apps can then choose which trust level they require.

## Public API layer

The public API makes app development easier without replacing AT Protocol as the underlying publication layer.

Example REST endpoints:

```http
GET /api/chapters
GET /api/org-chart
GET /api/records/:uri/authority
GET /api/records/:uri/disputes
GET /api/chapters/:id/roles
GET /api/chapters/:id/delegations
```

Example GraphQL query:

```graphql
chapter(handle: "nyc.dsausa.org") {
  name
  jurisdiction
  endorsements {
    candidate {
      name
      race
    }
  }
}
```

## Fixture source-of-truth boundary

For this prototype, the curated fixture set is the source of truth. The system does not model external source records, citation chains, or production authority-chain proof.

Records should expose enough fixture-authored authority/status context for demos: the DID/handle, public identity type, trust label, lifecycle state, and whether a record is disputed, revoked, archived, or superseded. External sources may inform fixture authorship, but they are not represented as protocol records.

## Privacy boundary

Draw a hard boundary between the public protocol layer and private organizing systems.

Public ATProto layer:

- Chapter profiles
- Public organizational unit profiles
- Public governance relationships
- Public role, mandate, charter, appointment, delegation, dispute, revocation, and archive records
- Public caucus identities
- Optional public member profiles

Private internal systems:

- Legal names when not public
- Addresses
- Dues/payment status
- Internal membership rosters
- Disciplinary records
- Sensitive organizing plans
- Voting systems, ballots, credentials, receipts, tallies, recount internals, and voter eligibility state
- Committee deliberation
- Personal contact information

Use an approval bridge for publishing:

```text
Private DSA systems
      ↓ approval workflow
Public ATProto records
      ↓ apps
```

## Recommended stack shape

1. Official PDS infrastructure for national, chapters, committees, and official campaigns.
2. Open participation for members and independent groups on external PDSs.
3. Shared `org.dsa.*` Lexicons.
4. DSA indexer for validation, graph building, search, and trust labels.
5. Developer API for REST and/or GraphQL consumers.
6. Multiple appviews for specific workflows.
7. Separate private systems for internal membership and organizing.
