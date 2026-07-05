# Local Voting Protocol Profile

This document narrows `voting-protocol-requirements.md` into a concrete profile for the next implementation slice.

It is accepted only for a **local-only, non-production ballot-casting prototype**. It must not be used for binding DSA elections.

## Status

Non-production profile for Plan 3 Slice 3.

This profile is safe enough to guide local prototype code only if implementation keeps the caveats below visible in UI, API names, tests, and docs.

## Non-production caveats

- No binding DSA election may be run with this profile.
- No production-grade secret ballot or cryptographic unlinkability is claimed.
- No coercion-resistant receipt protocol is claimed.
- No real member roster should be committed to the repo or published to ATProto.
- If any real roster data is used locally later, it must be minimized, uncommitted, private, non-ATProto, and still non-production.
- Admin roles are collapsed for local development and are unsafe for production.
- Retention is local/dev-only; production retention remains unresolved.
- Disputes, recounts, and certification are not implemented in Slice 3.

## Scope

Slice 3 should implement only:

- one local election at a time
- one proposal/question per ballot flow
- one selected choice from existing public `org.dsa.vote.choice` records
- local synthetic/minimized eligibility fixture
- local fake voter login
- first accepted ballot final
- aggregate tally only after close

Out of scope:

- ranked-choice voting
- approval voting
- multi-seat elections
- write-ins
- abstain/spoiled ballot semantics
- amendments
- revoting/replacement ballots
- real production authentication
- real member eligibility integration
- certified public result records

## Ballot secrecy profile

Use a secret-ballot-oriented data model, not a production cryptographic secret-ballot claim.

Requirements:

- Never store `voter_id + proposal_id + choice_id` together.
- Never store `session_id + choice_id` together.
- Never store `ballot_issuance_id + choice_id` together.
- Separate eligibility/credential issuance from anonymous ballot submission.
- Ballot submission records may contain selected choice and anonymous ballot reference, but no voter identity, voter session, eligibility reason, IP address, or user agent.
- Eligibility/session/issuance records may contain voter identity or local voter reference, but no selected choice.
- Logs must omit selected choice whenever identity/session/issuance context is present.
- Avoid precise linkable timestamps where possible; use coarse timestamps or omit timestamps on cross-linkable events in the prototype.

Known limitation: timing linkage can still leak identity-to-choice in small local tests. This is one reason the profile is non-production.

## Eligibility snapshot profile

Use a local synthetic/minimized fixture as the default eligibility source.

Rules:

- Freeze eligibility when the local election opens.
- Corrections happen by replacing the local fixture before opening the election.
- No appeal workflow in Slice 3.
- No eligibility roster or eligibility proof in ATProto.
- No dues/payment/member-status detail in fixture examples.
- One active ballot credential per eligible local voter per proposal.

If a voter is not in the frozen fixture, the prototype rejects ballot issuance.

## Authentication/session profile

Use fake local auth only.

Requirements:

- local voter chooses or is assigned a synthetic voter key from the fixture
- short-lived browser/session token
- session expiry
- no support/admin impersonation path
- replay protection on submit
- atomic consume-on-submit for the ballot credential
- CSRF-style protection or same-origin local-only protections for state-changing actions
- failed auth/session events must not include ballot choice

This is not production authentication.

## Ballot credential and submission profile

Flow:

1. Local voter authenticates against synthetic eligibility fixture.
2. Service issues one active ballot credential for the proposal.
3. Voter selects one public choice.
4. Submit endpoint atomically consumes the active credential.
5. Service writes anonymous ballot submission with selected choice and anonymous ballot reference.
6. Service returns opaque receipt.

Atomicity requirement:

- two simultaneous submit attempts for the same credential must result in at most one accepted ballot.
- replaying the same credential after acceptance must fail.

## Receipt profile

Use a weak opaque receipt by design.

Receipt may prove:

- the prototype accepted a submission attempt

Receipt must not prove:

- selected choice
- voter identity
- eligibility reason
- inclusion in a final certified tally
- ordering among ballots

Receipt shape should be random/opaque and stored hashed if persisted.

Do not publish receipts to ATProto.

## Revote profile

Revoting is out of scope.

- first accepted ballot is final
- duplicate attempts are rejected
- replacement ballots are not supported
- UI must say this local prototype does not support revoting

Revoting requires a separate reviewed design because replacement can relink voters to anonymous ballots.

## Tally profile

Tally only after close.

Rules:

- no interim results while open
- no partial results
- no per-voter turnout
- no subgroup breakdowns
- aggregate counts only
- small-electorate warning remains visible
- no public `org.dsa.vote.result` records in Slice 3

Certification and result publication remain future work.

## Retention profile

Local prototype retention:

- eligibility fixture: local dev file or local DB only; never committed if it contains real data
- sessions: expire quickly
- ballot credentials: retain until local reset or close for duplicate prevention
- anonymous ballots: local DB only until reset
- receipts: local DB only until reset, preferably stored hashed
- audit/admin events: minimal local logs only, no selected choice beside identity/session

Production retention is unresolved and remains a blocker for production claims.

## Admin role profile

For Slice 3, one local operator may run all roles only because it is a dev prototype.

This is unsafe for production.

Future production design still requires separate roles:

- election admin
- eligibility admin
- system operator
- tally certifier
- dispute reviewer
- security auditor

## Required Slice 3 tests

Before the next slice is considered complete, tests should cover:

- eligible synthetic voter can receive one ballot credential
- ineligible synthetic voter cannot receive a credential
- accepted ballot writes anonymous ballot record without voter identity
- duplicate submit is rejected
- replayed credential is rejected
- race/double-submit accepts at most one ballot
- receipt does not include selected choice
- logs/API response do not expose selected choice beside voter/session identity
- no ballot, eligibility, receipt, or audit secret appears in ATProto/public endpoints
- tally endpoint, if added, refuses while election is open
- final tally is aggregate-only after close

## Slice 3 readiness outcome

This profile resolves the requirements checklist only for a local non-production prototype:

- ballot secrecy model: secret-ballot-oriented data separation, non-cryptographic
- voting method: single-choice only
- eligibility source: local synthetic/minimized fixture
- auth/session: fake local auth, short-lived session
- receipt: opaque accepted-submission receipt only
- revote: out of scope
- tally: aggregate only after close
- retention: local dev reset only; production unresolved
- admin roles: collapsed locally, unsafe for production
- threat checks: required tests listed above

Anything beyond this profile is blocked pending another security review.
