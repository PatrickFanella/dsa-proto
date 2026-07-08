# App Ideas

Status: future reference only.

Multiple apps can be built on the same AT Protocol data layer. Each app can use different trust filters, UX, and workflows while consuming shared signed records.

## Electoral guide

Purpose: help voters find DSA endorsements, candidate recommendations, ballot measure positions, and source-linked guides.

Uses:

- `org.dsa.endorsement.candidate`
- `org.dsa.guide.electoral`
- `org.dsa.source.citation`
- Chapter profiles
- Verification records

Features:

- Search by jurisdiction
- Election-specific guides
- Candidate pages
- Source links and archive links
- Confidence labels
- Correction history
- Chapter-by-chapter endorsement comparison

Privacy note: do not store raw voter addresses. If location lookup is ever added, design it with explicit privacy review and minimal retention.

## Chapter directory

Purpose: provide a public directory of chapters, organizing areas, websites, public contacts, and official social identities.

Uses:

- `org.dsa.profile.chapter`
- `org.dsa.affiliation.chapter`
- `org.dsa.verification.assertion`

Features:

- Map or list of chapters
- Jurisdiction search
- Official handle display
- Active/inactive/archive status
- Public contact links
- Related committees and working groups

## Event calendar

Purpose: aggregate public chapter, caucus, committee, and campaign events.

Uses:

- `org.dsa.event.meeting`
- `org.dsa.event.canvass`
- Chapter profiles
- Committee profiles
- Verification records

Features:

- Public meeting calendar
- Canvass and campaign events
- Training events
- Rally listings
- Filters by chapter, caucus, topic, and region
- ICS export
- Registration links

Safety note: avoid publishing sensitive staging locations or high-risk logistics. Use registration links when details should be gated.

## Caucus reader

Purpose: make caucus statements, publications, endorsements, and public debates discoverable without requiring one centralized publishing platform.

Uses:

- `org.dsa.profile.caucus`
- `org.dsa.statement.public`
- `org.dsa.source.citation`
- Verification records

Features:

- Caucus profiles
- Statement feeds
- Topic filters
- Official/independent/self-declared labels
- Historical archives
- Cross-caucus comparison on issues

## Research archive

Purpose: preserve public political records for researchers, journalists, members, and organizers.

Uses:

- Statements
- Endorsements
- Guides
- Citations
- Verification and dispute records

Features:

- Full-text search
- Source snapshots
- Timeline views
- Record authority/status
- Change history
- Exportable datasets

## Moderation and dispute dashboard

Purpose: help maintainers review disputed records, impersonation claims, revoked verifications, and source quality issues.

Uses:

- Verification records
- Dispute records
- Source citations
- Identity graph

Features:

- Queue of disputed records
- Trust label editing through signed records
- Revocation workflow
- Impersonation review
- Audit log
- App-specific moderation policies

## Developer portal

Purpose: help chapters, caucuses, and independent developers build apps on the shared data layer.

Features:

- Lexicon docs
- API docs
- Example queries
- SDK examples
- Test fixtures
- Trust label guide
- Data safety rules
- App registration, if needed

## Chapter publishing console

Purpose: give nontechnical chapter officers and committee members a UI for publishing valid records.

Uses:

- Chapter profiles
- Events
- Endorsements
- Guides
- Statements
- Citations

Features:

- Form-based publishing
- Draft review
- Source validation prompts
- Correction workflow
- Role-based access through private systems
- Publish-to-ATProto bridge

## Member public profile app

Purpose: allow members to opt into public affiliations, skills, interests, and public organizing profiles.

Uses:

- Public member profile records
- `org.dsa.affiliation.member`
- Verification records where policy allows

Features:

- Public profile page
- Self-declared affiliations
- Optional chapter/caucus verification
- Skills and interests
- Links to posts, statements, and public projects

Safety note: member participation must be opt-in. Do not expose private membership data.

## App architecture pattern

Each app can choose one of three data access patterns:

1. Direct AT Protocol sync for maximum independence.
2. Shared DSA API for fast development.
3. Hybrid mode: use the API for common queries and direct ATProto for record verification or writes.

Recommended default for early apps:

```text
Use shared API for reads.
Use controlled publishing tools for writes.
Display AT URIs, sources, and trust labels.
Keep private organizing data outside the app unless explicitly designed for it.
```
