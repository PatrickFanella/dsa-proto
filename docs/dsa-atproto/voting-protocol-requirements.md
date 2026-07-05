# Voting Protocol Requirements

This document is the implementation gate for Plan 3 Slice 3.

It is **not** ballot-casting code and it does not make `dsa-proto` production-ready for binding DSA elections. It defines the minimum protocol decisions that must be accepted before any private ballot-casting prototype begins.

## Status

Requirements draft.

Slice 3 remains blocked until every requirement below is either satisfied by a concrete design decision, explicitly deferred with a non-production limitation, or marked as a blocker.

## Hard gate for Slice 3

Do not implement ballot casting until these are decided:

1. ballot secrecy model
2. voting method scope
3. eligibility source and snapshot rules
4. authentication/session model
5. receipt semantics
6. revote/replacement behavior
7. tally visibility and certification rules
8. retention/deletion periods
9. admin role separation
10. threat-model acceptance checks

## Current recommended Slice 3 scope

The safest first implementation is a **local-only, non-production, single-choice secret-ballot prototype**.

Recommended constraints:

- one election
- one proposal/question
- one choice selected from published `org.dsa.vote.choice` records
- no ranked-choice, approval voting, write-ins, amendments, or multi-seat elections
- private eligibility snapshot loaded locally
- no ATProto publication of ballots, eligibility, receipts, audit logs, turnout-by-person, or interim results
- no binding DSA election claims

Anything beyond this scope should require another security review.

## Ballot secrecy model

Required decision: **secret ballot, pseudonymous ballot, or public vote**.

For real internal voting, the default requirement is secret ballot.

Secret ballot requirements:

- No durable table may directly link voter identity to selected choice.
- No indirect durable link through session ID, issuance ID, timestamp, receipt token, IP/user agent, or audit event may be sufficient to reconstruct identity-to-choice.
- Ballot content must be stored separately from eligibility/authentication state.
- Ballot submissions should use an anonymous or unlinkable ballot reference.
- Logs must not contain selected choice alongside identity/session data.

Explicitly forbidden shape:

```text
voter_id + election_id + proposal_id + choice_id
```

If the first prototype cannot satisfy this separation, it must be labeled **non-production and not secret-ballot safe**.

## Voting method scope

Required decision: which voting methods are supported by Slice 3.

Default for first prototype:

- single-choice ballot only
- one selected choice per proposal
- one active ballot per eligible voter per proposal

Out of scope until separately designed:

- ranked-choice voting
- approval voting
- multi-seat elections
- write-ins
- abstain/spoiled ballot semantics
- amendments
- multiple questions per election
- weighted votes
- delegate credential weighting

Payload design must not pretend to support these until their tally, secrecy, receipt, and recount rules are documented.

## Eligibility source and snapshot

Required decision: authoritative source for eligible voters.

The eligibility model must define:

- who is eligible
- who can create the eligibility snapshot
- when eligibility freezes
- how corrections are handled
- who can appeal an exclusion
- how one-voter-one-active-ballot is enforced
- what aggregate eligibility counts can be published, if any

Requirements:

- Eligibility snapshots are private.
- Raw voter rosters are never published to ATProto.
- Dues/payment/member-status details are never published to ATProto.
- Eligibility reason should not appear in receipts.
- Eligibility admin role must be separate from tally certification.

## Authentication and session model

Required decision: how a voter proves eligibility and receives a ballot opportunity.

Minimum browser-flow requirements:

- short-lived sessions
- session expiry
- replay protection
- race protection for double-submit attempts
- CSRF-style protection for state-changing actions
- no support/admin impersonation path for casting a ballot as a voter
- no logs that correlate voter identity with selected choice
- failed auth attempts logged without ballot content
- session tokens never stored in ATProto or public records

The first prototype may use a local fake auth adapter only if the UI and docs clearly say it is not production authentication.

## Receipt semantics

Required decision: what a voter receipt proves.

A receipt may prove:

- the service accepted a ballot submission attempt
- an inclusion artifact was recorded
- a ballot is included in the final tally set, if the chosen protocol supports that safely

A receipt must not prove:

- selected choice
- ranking or ordering
- membership status
- eligibility reason
- identity of other voters
- whether a specific voter voted a specific way

Avoid voter-held hashes or commitments that can be used as coercion evidence unless a reviewed voting protocol says they are safe.

Receipts must not be published to ATProto.

## Revotes and replacement ballots

Required decision: whether revoting is allowed.

If revoting is not supported:

- the first accepted ballot is final
- duplicate attempts are rejected or treated as non-counting attempts
- this limitation must be visible in UI copy

If revoting is supported:

- new ballot replaces the prior active ballot
- old ballot is excluded from tally
- replacement must not create an identity-to-choice trail
- issuance/consumption timing must not relink voter to ballot content
- audit logs must capture replacement events without selected choice

Revoting is high-risk and should not be included in Slice 3 unless the replacement protocol is explicit.

## Tally visibility and certification

Required decisions:

- when tally inputs freeze
- who may run a tally
- who may certify a tally
- what aggregate fields may be published
- when `org.dsa.vote.result` can be emitted later

Requirements:

- no interim results while voting is open unless governance explicitly allows it
- no partial results that can influence voter behavior
- no per-person turnout publication
- no public small-electorate aggregates without privacy review
- fixed input set after close/freeze
- certifier approval before public result summary
- dispute/revocation path for any published result record

## Retention and deletion

Required decision: retention periods by data class.

At minimum, define retention for:

- eligibility snapshots
- auth sessions
- ballot issuances
- ballot submissions
- receipt artifacts
- tally runs
- certifications
- audit events
- admin actions
- dispute evidence

Production claims are blocked while retention is `TBD`.

Prototype defaults should minimize data and keep retention visibly local/non-production.

## Admin roles and separation of duties

Required roles:

- election admin
- eligibility admin
- system operator
- tally certifier
- dispute reviewer
- security auditor

Separation requirements:

- no single role may alter eligibility, inspect ballots, run tally, and certify results
- eligibility admins cannot inspect ballot choices
- election admins cannot silently change proposal text or choices after notice/freeze
- system operators cannot certify results
- certifiers cannot alter eligibility
- dispute reviewers inspect only minimum necessary evidence

If a local prototype collapses roles into one operator, it must be labeled unsafe for production and binding elections.

## Threat-model acceptance checks

Before Slice 3 begins, the design must include pass/fail checks for:

- duplicate voting
- ineligible voting
- eligible voter unable to vote
- lost accepted ballot
- replayed ballot submission
- race between two submissions
- rollback of accepted ballot state
- admin eligibility tampering
- admin tally tampering
- receipt coercion
- identity-to-choice linkage via logs or timestamps
- premature or partial results
- small-election privacy leakage
- audit-log abuse
- dispute evidence overexposure

These checks should become tests or review checklist items when code exists.

## ATProto publication rules

Allowed public ATProto records:

- `org.dsa.vote.election`
- `org.dsa.vote.proposal`
- `org.dsa.vote.choice`
- future certified aggregate `org.dsa.vote.result`, only after certification/privacy review

Never publish:

- private ballots
- voter rosters
- eligibility proofs
- dues/payment/member-status details
- auth/session tokens
- ballot receipts
- receipt hashes/commitments that reveal or prove a choice
- raw audit logs
- admin action logs with sensitive identity data
- recount evidence identifying voters
- turnout-by-person
- raw dispute evidence

## Slice 3 readiness checklist

Slice 3 can start only when this checklist is complete:

- [ ] ballot secrecy model chosen
- [ ] voting method scope chosen
- [ ] eligibility source and freeze rules documented
- [ ] auth/session model documented
- [ ] receipt semantics documented
- [ ] revote behavior accepted or explicitly out of scope
- [ ] tally visibility and certification rules documented
- [ ] retention periods documented
- [ ] admin roles and permissions documented
- [ ] threat-model acceptance checks documented
- [ ] non-production constraints visible in UI/API/docs
- [ ] security review completed after updates
