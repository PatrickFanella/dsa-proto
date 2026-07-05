# Plan 4: Production Voting and Auditability

## Purpose

Plan 4 turns the internal voting work from a local prototype into a production architecture track.

The goal is real internal DSA voting that is eligible-voter constrained, ballot-secret, auditable, recountable, and certifiable.

This plan does **not** declare the current prototype production-ready. It defines the path from prototype to production voting.

## Source docs

Plan 4 is split across two detailed architecture docs:

- [production-voting-architecture-plan.md](production-voting-architecture-plan.md): security, protocol, governance, public/private boundary, auditability, certification, recount, and rollout phases.
- [production-internal-voting-data-architecture.md](production-internal-voting-data-architecture.md): private data boundaries, schema concepts, constraints, append-only audit chains, retention, backup, and implementation slices.

## Production architecture target

```text
Authoritative member / eligibility source
        ↓
Private eligibility snapshot + voter auth/MFA
        ↓
Anonymous credential issuer
        ↓
Anonymous ballot box
        ↓
Frozen tally input set + certification workflow
        ↓
Certified aggregate result
        ↓
Public ATProto result summary after privacy review
```

ATProto remains the public publication layer. It is not the ballot box.

## Non-negotiable public/private boundary

Allowed public records:

- election notices
- proposal/resolution text
- public choices/options
- public status and caveats
- certified aggregate result summaries, after privacy review
- certification metadata

Never publish:

- voter rosters
- eligibility proofs
- auth/session tokens
- private ballots
- encrypted/raw ballot payloads before protocol review
- credential serials or receipt secrets
- raw audit logs
- admin action logs containing sensitive identity data
- recount/dispute evidence identifying voters
- per-voter turnout
- timestamps or metadata that can relink a voter to a ballot

## Required production properties

A production voting system must prove:

1. only eligible voters can vote
2. each eligible voter can cast at most one counted ballot per contest
3. voter identity cannot be linked to ballot choice by ordinary admins/operators
4. ballots cannot be silently dropped, replaced, or stuffed
5. accepted ballots produce a frozen tally input set
6. tally results are reproducible from the frozen input set
7. certification is role-separated and auditable
8. recount/dispute evidence can be inspected without public vote disclosure
9. public results match certified private evidence

## Implementation phases

### Phase 0: Governance and protocol gate

No production code.

Deliverables:

- election types in scope
- authoritative eligibility source
- eligibility freeze/correction/appeal rules
- auth/MFA policy
- voting method limits
- secret-ballot and receipt requirements
- certification, recount, dispute, and retention policies
- role matrix and dual-control matrix
- external security/voting-systems review plan

### Phase 1: Production architecture spike

Design and prove boundaries before building ballot casting.

Deliverables:

- candidate anonymous credential protocol
- credential issuer / ballot box trust boundary
- audit event taxonomy
- KMS/HSM and key ceremony requirements
- abuse-case tests or checklist acceptance criteria

### Phase 2: Private service foundation

Build non-ballot production foundations.

Deliverables:

- IdP integration and MFA enforcement
- admin RBAC and dual-control approvals
- private eligibility snapshot import/freeze
- append-only audit log
- public/private publication guardrails
- migration and readiness checks

No production ballot casting yet.

### Phase 3: Anonymous credential and ballot-box pilot

Run only a non-binding pilot with synthetic or consenting test electorate.

Deliverables:

- anonymous one-use credentials
- atomic credential consumption
- anonymous encrypted/opaque ballot storage
- non-choice-revealing receipts
- race/replay/duplicate tests
- no public result claims

### Phase 4: Tally, certification, and dispute pilot

Add closed-election controls.

Deliverables:

- frozen input set hash
- tally run records
- certifier approval workflow
- privacy review before aggregate publication
- dispute/recount evidence lockbox
- safe `org.dsa.vote.result` outbox path

### Phase 5: External review and limited binding pilot

Required before binding elections:

- independent voting-protocol review
- AppSec review and penetration test
- privacy review for membership and political-affiliation risks
- operations game day for outage, compromise, recount, and revocation
- accessibility review
- public voter instructions and incident communications plan

### Phase 6: Broader rollout

Only after a successful limited binding pilot:

- add election types incrementally
- add revoting/replacement only after separate review
- add ranked-choice/multi-seat elections only after separate tally/secrecy/recount design
- publish recurring audit summaries and post-election reports

## Next recommended slice

Do **Phase 0: Governance and protocol gate** as concrete issue-ready requirements.

That slice should produce:

- a signed-off scope for the first production election type
- an eligibility source contract
- an auth/MFA decision
- an anonymous credential protocol decision or evaluation shortlist
- role/permission matrix
- retention schedule
- audit event taxonomy
- external review checklist
