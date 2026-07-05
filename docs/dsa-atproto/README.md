# DSA AT Protocol Infrastructure Concept

This document set sketches how the Democratic Socialists of America could use AT Protocol as a shared civic and organizational data layer for chapters, caucuses, committees, campaigns, public statements, endorsements, events, and source-linked political knowledge.

The core idea is not “DSA joins Bluesky.” It is that DSA could use AT Protocol as a federated public data substrate, with many applications built on top of shared signed records.

```text
People / Chapters / Caucuses publish signed records
                  ↓
        ATProto Personal Data Servers
                  ↓
        Relays / Firehose / Indexers
                  ↓
       Shared civic graph + search APIs
                  ↓
     Many apps: voter guides, event calendars,
     caucus directories, chapter sites, dashboards
```

## Why AT Protocol fits DSA

DSA is a national organization composed of local chapters, individual members, caucuses, working groups, committees, campaigns, and publications. That structure maps well to AT Protocol's strengths:

- Portable identities
- Signed public records
- Federation across semi-autonomous groups
- Human-readable handles backed by durable DIDs
- Custom schemas through Lexicons
- Public data that can be indexed by many apps
- A graph of relationships between people, chapters, caucuses, campaigns, candidates, events, and statements

## Best uses

AT Protocol is a good fit for public or semi-public organizational data:

- National, chapter, caucus, and committee identities
- Chapter directories
- Public event feeds
- Public endorsements
- Campaign guides
- Source-linked voter guides
- Public statements and resolutions
- Caucus publications
- Public member profiles, when explicitly opted into
- Developer APIs and app ecosystems built from shared records

## Poor uses

AT Protocol should not be used as the primary home for sensitive internal organizing data.

Keep the following off the public protocol layer unless a future privacy architecture and security review explicitly support them:

- Raw member rosters
- Home addresses
- Dues/payment status
- Internal disciplinary records
- Sensitive casework
- Private deliberations
- High-risk organizing logistics
- Internal votes
- Personal contact information that was not explicitly published

## Recommended model

Use a hybrid architecture:

1. Official DSA identities publish public records through DSA-controlled or chapter-controlled infrastructure.
2. Members and independent caucuses can participate from any compatible PDS.
3. Shared `org.dsa.*` Lexicons define common record types.
4. A DSA indexer consumes public records and builds normalized trusted views.
5. A verification service applies labels such as official, verified, self-declared, disputed, revoked, and archived.
6. Multiple apps consume the same data through direct ATProto sync, a shared API, or both.
7. Private organizing systems remain separate and only publish approved public records outward.

## Documents

- [architecture.md](architecture.md): system architecture and infrastructure layers
- [lexicons.md](lexicons.md): proposed record namespaces and example schemas
- [governance.md](governance.md): verification, disputes, schema evolution, and safety policy
- [app-ideas.md](app-ideas.md): applications that could be built on the shared data layer
- [answers.md](answers.md): answered requirements interview
- [current-state.md](current-state.md): current implementation baseline and recommended next lanes
- [prototype-plan.md](prototype-plan.md): first local prototype scope and success criteria
- [local-demo.md](local-demo.md): local run, reseed/reset, and reviewer demo flow
- [technical-architecture.md](technical-architecture.md): implementation architecture for the mocked-record prototype
- [org-chart-alignment.md](org-chart-alignment.md): public org-chart mapping notes and caveats
- [atproto-ingestion-spike.md](atproto-ingestion-spike.md): Phase 2 real ATProto ingestion adapter findings
- [roadmap.md](roadmap.md): phased path from local prototype to deployable demo
- [plan-2-public-civic-records.md](plan-2-public-civic-records.md): next-phase plan for public statements (slice 1 done), endorsements, events, and publications
- [plan-3-internal-voting.md](plan-3-internal-voting.md): internal voting architecture and safety boundary
- [private-voting-service-design.md](private-voting-service-design.md): private voting service boundary and data model
- [voting-protocol-requirements.md](voting-protocol-requirements.md): required protocol decisions before ballot-casting code
- [voting-local-protocol-profile.md](voting-local-protocol-profile.md): narrow local-only non-production voting profile for the next prototype slice
- [gitea-issues.md](gitea-issues.md): proposed issue breakdown for implementation
