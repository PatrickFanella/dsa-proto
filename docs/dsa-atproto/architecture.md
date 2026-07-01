# Architecture

## Design principle

Build a shared AT Protocol data layer, not a single monolithic DSA application.

AT Protocol should provide public identity, signed records, common schemas, and synchronization. Apps should be separate views and workflows that consume the same underlying records.

```text
ATProto = write/publication layer
Indexer = normalization and trust layer
APIs = developer convenience layer
Apps = interchangeable user-facing views
Private systems = membership, permissions, voting, and sensitive workflows
```

## Identity layer

AT Protocol identities can represent organizations, chapters, caucuses, committees, campaigns, publications, and individuals.

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
Record = signed public data
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

DSA would define `org.dsa.*` record types for public organizational and civic data. These schemas let different apps read and write compatible records.

Examples:

```text
org.dsa.profile.chapter
org.dsa.profile.caucus
org.dsa.profile.committee
org.dsa.affiliation.member
org.dsa.affiliation.chapter
org.dsa.endorsement.candidate
org.dsa.event.meeting
org.dsa.event.canvass
org.dsa.statement.public
org.dsa.source.citation
org.dsa.guide.electoral
org.dsa.vote.recommendation
```

## Organizational graph

The system should model explicit relationships:

- Chapter belongs to national organization
- Member publicly affiliates with chapter
- Member publicly affiliates with caucus
- Committee belongs to chapter
- Campaign is supported by chapter
- Candidate appears in election
- Event is hosted by committee or chapter
- Statement is issued by caucus
- Guide is compiled by chapter
- Record cites public source

This enables app queries like:

- Which chapters are active in this state?
- What endorsements has this chapter made?
- Which caucuses have published statements about housing?
- What events are happening near me?
- Which voter guides cite official chapter sources?
- Which candidates are endorsed by multiple chapters?

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
Official
Verified by national
Verified by chapter
Verified by caucus
Self-declared
Community-submitted
Disputed
Revoked
Archived
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
GET /api/chapters/:id/endorsements
GET /api/elections/:id/guides
GET /api/candidates/:id/positions
GET /api/events?near=11215
GET /api/caucuses/:id/statements
GET /api/records/:uri/sources
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
    sources {
      url
      confidence
    }
  }
}
```

## Privacy boundary

Draw a hard boundary between the public protocol layer and private organizing systems.

Public ATProto layer:

- Chapter profiles
- Public events
- Public endorsements
- Public statements
- Public guides
- Public caucus pages
- Public source citations
- Optional public member profiles

Private internal systems:

- Legal names when not public
- Addresses
- Dues/payment status
- Internal membership rosters
- Disciplinary records
- Sensitive organizing plans
- Internal votes
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
