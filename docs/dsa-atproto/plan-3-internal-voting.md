# Plan 3: Internal Voting System

## Purpose

Plan 3 explores how `dsa-proto` could support **real internal DSA voting** while preserving the core safety boundary of this project.

This is a major boundary change. Earlier plans treated internal votes as out of scope. Real voting involves member eligibility, identity, ballot secrecy, coercion resistance, auditability, recounts, disputes, retention, and insider abuse risks.

The public ATProto layer can help with public governance artifacts, but it must not become the ballot box.

## Core architectural decision

Use a hybrid model:

```text
Public ATProto layer
- election notices
- proposals/resolutions
- public choices/options
- certified final result summaries
- public certification records

Private voting service
- voter eligibility
- authentication/session handling
- ballot casting
- ballot secrecy
- receipts that do not reveal vote choice
- tallying
- audits/recounts/disputes
- admin controls and logs
```

ATProto remains a public record substrate. The private voting service is the system of record for ballots and eligibility.

## Non-negotiable safety boundary

Never publish these to ATProto:

- private ballots
- voter rosters
- eligibility proofs
- dues/payment or membership-status details
- voter authentication tokens
- identity-linking tokens
- ballot receipts that reveal vote choice
- raw audit logs
- recount artifacts that identify voters
- admin action logs containing sensitive identity data
- turnout-by-person records
- private deliberation or disciplinary material

Final public result summaries may be published only after certification and privacy review.

## Security/privacy design gate

No implementation should begin until a voting design gate is documented and accepted.

The design gate must define:

- election governance requirements
- eligible electorate rules
- quorum and notice rules
- ballot secrecy requirements
- voting protocol choice
- identity/auth assumptions
- admin role model
- threat model
- audit and recount process
- dispute process
- retention and deletion policy
- accessibility requirements
- public/private data classification
- what is allowed to publish to ATProto
- what is forbidden to publish to ATProto

## Threat model summary

Primary risks:

- duplicate voting
- ineligible voting
- eligible voters being unable to vote
- ballot-choice disclosure
- coercion through receipts or screenshots
- admin tampering with eligibility or tally state
- insider abuse of audit logs
- small-election privacy leakage
- premature/partial results changing behavior
- public publication of sensitive internal conflicts
- replay, race, or rollback bugs in ballot casting
- weak dispute/recount evidence handling

Receipts must prove inclusion or successful submission without proving the selected choice.

Eligibility and ballot content should be separated as much as possible. If the first prototype cannot fully separate them, the limitation must be explicit and the system must remain non-production.

## Data classification

### Public

Allowed in ATProto/public API:

- election title and description
- proposal/resolution text
- public choices/options
- election open/close timestamps
- public eligibility description, not roster
- certified aggregate results
- certification metadata
- public challenge/dispute status, without private evidence

### Private

Private service only:

- eligible voter list
- member identity and authentication evidence
- ballot submission state
- ballot contents
- ballot inclusion proofs
- audit events
- admin actions
- raw recount materials

### Sensitive aggregate

Publish only with privacy review:

- turnout totals for small electorates
- breakdowns by chapter/caucus/region
- close or controversial vote metadata
- timestamps that could identify voters

## Proposed public record families

These records are candidates for the ATProto/public layer.

### `org.dsa.vote.election`

Public election notice and metadata.

Fields:

- `title`
- `summary`
- `bodyMarkdown`
- `sponsorEntityUri`
- `sponsorEntityName`
- `opensAt`
- `closesAt`
- `status: draft | scheduled | open | closed | certified | archived`
- `eligibilityDescription`
- `votingSystemUrl`
- `relatedEntityUris`

### `org.dsa.vote.proposal`

Proposal, resolution, or question being voted on.

Fields:

- `electionUri`
- `title`
- `summary`
- `bodyMarkdown`
- `sponsorEntityUri`
- `status: draft | active | withdrawn | archived`
- `relatedEntityUris`

### `org.dsa.vote.choice`

Public choices/options for a proposal.

Fields:

- `proposalUri`
- `label`
- `description`
- `sortOrder`

### `org.dsa.vote.result`

Certified aggregate result summary.

Fields:

- `electionUri`
- `proposalUri`
- `totals`
- `eligibleVoterCount` if safe to publish
- `ballotsCounted` if safe to publish
- `certifiedByEntityUri`
- `certifiedByName`
- `certifiedAt`
- `status: certified | disputed | revoked | archived`
- `caveat`

## Private service concepts

These should not be implemented as public ATProto records.

Private tables or equivalents:

- `elections`
- `proposals`
- `choices`
- `eligible_voters`
- `voter_auth_sessions`
- `ballot_submissions`
- `ballot_receipts`
- `tally_runs`
- `certifications`
- `audit_events`
- `admin_actions`
- `disputes`

The private schema should be designed after the security/privacy design gate.

## Plan 3 slices

### Slice 0: Voting threat model and requirements

Status: initial architecture boundary documented; a deeper implementation-grade threat model is still required before private voting code.

Deliverables:

- threat model
- data classification table
- public/private boundary
- eligibility model assumptions
- ballot secrecy requirements
- admin role model
- audit/recount/dispute flow
- first non-production constraints

No code.

### Slice 1: Public election/proposal registry

Status: implemented in the local prototype.

Implement public ATProto-shaped records for election notices, proposals, and choices.

No ballots.

Acceptance criteria:

- schemas for `org.dsa.vote.election`, `org.dsa.vote.proposal`, and `org.dsa.vote.choice`
- seed records
- read API
- UI section
- clear copy that voting itself happens in a private system

Implemented as public registry metadata only; ballots, eligibility, and voting results remain out of scope.

### Slice 2: Private voting service prototype design

Design private service boundaries and schema.

No public ballot records.

Acceptance criteria:

- private data model
- auth/eligibility flow
- receipt semantics
- privacy limitations
- audit/recount model

### Slice 3: Non-production ballot casting prototype

Implement a local-only, non-production ballot flow after the design gate.

Acceptance criteria:

- authenticated voter simulation
- eligibility checks
- one ballot per eligible voter
- receipt that does not reveal choice
- no ballot contents in ATProto records

### Slice 4: Tally and certification

Compute aggregate results and publish certified summaries to public records.

Acceptance criteria:

- tally closed election
- certification workflow
- `org.dsa.vote.result` public record
- privacy checks before publishing aggregates

### Slice 5: Admin, recount, and dispute tooling

Add operational controls after the core privacy model is proven.

Acceptance criteria:

- admin role separation
- audit event review
- recount process
- dispute status handling
- retention/deletion behavior

## Open questions

- What exact DSA bodies or election types should the first real model support?
- What membership system is authoritative for eligibility?
- What auth system is acceptable for voters?
- Are votes secret, public, or mixed by election type?
- What are quorum and notice requirements?
- Who can certify results?
- Who can initiate recounts or disputes?
- What aggregate breakdowns are safe to publish?
- What retention period is required for ballots, receipts, and audit evidence?

## Near-term recommendation

Do **Slice 0** before any voting implementation.

The current prototype can safely add public election/proposal registry records later, but real ballot casting should wait until the private voting architecture and threat model are explicit.
