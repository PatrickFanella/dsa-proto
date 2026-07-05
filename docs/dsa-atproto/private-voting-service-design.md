# Private Voting Service Design

This document is Plan 3 Slice 2: a private-service design for future internal DSA voting.

It is **not an implementation plan for production voting**. It defines the boundary and data model that must exist before any ballot-casting prototype is attempted.

## Status

Design-only.

No private voting backend, private tables, ballots, eligibility checks, authentication, tallying, or certification workflow have been implemented in `dsa-proto`.

## Architectural boundary

```text
Public ATProto/read API layer
- election notices
- proposal text
- public choice labels
- certified final result summaries, later

Private voting service
- eligibility
- authentication
- ballot submission
- anonymous ballot content
- inclusion receipts
- tally runs
- audits, recounts, disputes
- admin actions
```

The public layer can say **what is being voted on**. The private service controls **who can vote, how ballots are cast, how choices remain secret, and how results are certified**.

## Non-production constraint

Until governance, legal/privacy, protocol, auth, audit, retention, and operational controls are reviewed, any implementation must be labeled non-production.

No UI copy, API name, or docs text should imply that this prototype can run real binding DSA elections.

## Required separation: eligibility vs ballot content

The private design must not create a durable table that directly links voter identity to selected choice.

Avoid this shape:

```text
voter_id + election_id + proposal_id + choice_id
```

That shape is easy to build and unsafe for secret ballots.

Instead, the model should separate:

- eligibility/authentication state: who may vote and whether they have been issued a ballot opportunity
- ballot content: the submitted selection, stored without direct voter identity
- inclusion/receipt state: proof that a ballot submission was accepted, without revealing selected choice

The exact cryptographic protocol is not chosen yet. That is a blocker for production readiness.

## Private concept table

| Concept | Purpose | Contains identity? | Contains ballot choice? | ATProto/public allowed? | Retention | Access roles | Abuse risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `elections` | Private operational state for a voting process | Maybe sponsor/admin references | No | Public mirror allowed only as `org.dsa.vote.election` metadata | Long enough for audit and governance requirements | election admins, certifiers | election config tampering |
| `proposals` | Private copy of proposal/question state | No, except sponsor references | No | Public mirror allowed as `org.dsa.vote.proposal` | Same as election | election admins, certifiers | changing proposal text after notice |
| `choices` | Private copy of eligible options | No | No | Public mirror allowed as `org.dsa.vote.choice` | Same as election | election admins, certifiers | changing options/order after notice |
| `eligible_voters` | Defines who may vote | Yes | No | Never | Shortest period compatible with audit/dispute | eligibility admins only; certifiers may see aggregate counts | voter suppression, unauthorized additions, roster exposure |
| `voter_auth_sessions` | Tracks authenticated voting sessions | Yes or pseudonymous session token | No | Never | Very short; expire aggressively | system operators, limited support | session hijack, identity leakage |
| `ballot_issuances` | Records that an eligible voter received a ballot opportunity | Yes or pseudonymous credential reference | No | Never | Until dispute window closes, then minimize | eligibility admins, auditors under controls | linking issuance timing to ballot timing |
| `ballot_submissions` | Stores accepted anonymous/opaque ballots | No direct voter identity | Yes, ideally encrypted/opaque or unlinkable | Never | Until legal/governance retention expires | tally service, certifiers under protocol | vote disclosure, ballot stuffing, deletion |
| `ballot_receipts` | Lets voter verify accepted inclusion | Pseudonymous receipt ID only | No | Never as raw receipt | Until dispute window closes, then minimize | voter, dispute reviewers under controls | coercion if receipt proves choice |
| `tally_runs` | Records aggregate computation runs | No voter identity | Aggregate only | Only certified aggregate result may be public | Retain with election record | tally certifiers, auditors | premature results, manipulated tally |
| `certifications` | Certifier approval of final aggregate result | Certifier identity | Aggregate only | Public summary allowed as `org.dsa.vote.result`, later | Long-term | certifiers, governance admins | false certification, coercion |
| `audit_events` | Tamper-evident service/security events | Often yes | No ballot choices if possible | Never raw | Retain per policy, then minimize | security reviewers, system operators | insider surveillance, political targeting |
| `admin_actions` | Tracks privileged changes | Admin identity | No ballot choices | Never raw | Retain per policy, then minimize | security reviewers, certifiers | insider abuse, after-the-fact manipulation |
| `disputes` | Tracks challenges, recounts, evidence state | Possibly yes | Avoid raw ballots unless protocol requires | Public status only, no private evidence | Retain through dispute and appeal window | dispute reviewers, certifiers | doxxing, selective evidence disclosure |

Retention periods must be finalized with governance/legal requirements before implementation.

## Role model

No single role should be able to alter eligibility, inspect ballots, run tally, and certify results.

Minimum roles:

- **Election admin**: configures elections, proposals, choices, and public notice metadata.
- **Eligibility admin**: manages eligible voter snapshots; cannot inspect ballot choices.
- **System operator**: runs infrastructure; cannot alter election meaning or certify results.
- **Tally certifier**: authorizes tally runs and certifies final aggregates; cannot alter eligibility.
- **Dispute reviewer**: reviews disputes/recount evidence with privacy controls.
- **Security auditor**: reviews tamper-evident logs and admin actions.

Prototype shortcuts must be explicitly labeled when they collapse roles.

## Receipt semantics

A receipt may prove:

- the voter submitted a ballot attempt
- the service accepted an inclusion artifact
- the ballot is included in a tally set, if the final protocol supports this safely

A receipt must not prove:

- selected choice
- ballot ranking
- voter membership status
- eligibility reason
- identity of other voters

Avoid voter-held hashes or commitments that can be used as coercion evidence unless a reviewed protocol says they are safe.

## Tally and results constraints

Tallying must prevent premature or partial results from influencing voting.

Required controls:

- no interim results while polls are open unless governance explicitly allows it
- no per-person turnout publication
- small-electorate privacy review before aggregate publication
- fixed tally inputs after close/freeze
- certifier approval before any public result record
- ability to revoke/dispute a published result summary without exposing raw ballots

## Recount and dispute flow

Minimum flow:

1. Election closes.
2. Inputs are frozen.
3. Initial tally run is recorded privately.
4. Certifiers review aggregate and audit checks.
5. Certified public result summary may be published.
6. If challenged, a dispute record is opened privately.
7. Relevant evidence is locked and access-limited.
8. Dispute reviewers inspect only the minimum necessary evidence.
9. Outcome is certified, amended, revoked, or archived.
10. Public layer may show only status and final aggregate/caveat.

Do not publish raw dispute evidence to ATProto.

## Privacy limitations to document before prototype code

The first private voting prototype must disclose whether it supports:

- secret ballots
- public votes
- pseudonymous ballots
- ranked choice or only single choice
- voter-verifiable inclusion
- tally verification
- recounts
- revoting / ballot replacement
- accessibility accommodations
- offline/manual fallback

If any of these are not supported, the system must remain non-production.

## Suggested private data model, non-final

This is a conceptual model, not a migration.

```text
private_elections
- id
- public_election_uri
- status
- opens_at
- closes_at
- frozen_at
- certified_at

private_proposals
- id
- election_id
- public_proposal_uri
- status

private_choices
- id
- proposal_id
- public_choice_uri
- sort_order

eligible_voters
- id
- election_id
- voter_subject_ref
- eligibility_source_ref
- status

voter_auth_sessions
- id
- election_id
- voter_ref
- expires_at
- used_at

ballot_issuances
- id
- election_id
- voter_ref_or_credential_ref
- issued_at
- consumed_at

ballot_submissions
- id
- election_id
- proposal_id
- anonymous_ballot_ref
- encrypted_or_opaque_choice_payload
- accepted_at

ballot_receipts
- id
- election_id
- receipt_token_hash
- inclusion_ref
- issued_at

tally_runs
- id
- election_id
- proposal_id
- input_set_hash
- aggregate_result_json
- computed_at
- computed_by_ref

certifications
- id
- tally_run_id
- certifier_ref
- public_result_uri
- certified_at

audit_events
- id
- event_type
- actor_ref
- target_ref
- metadata_json
- created_at

admin_actions
- id
- actor_ref
- action_type
- target_ref
- reason
- created_at

disputes
- id
- election_id
- opened_by_ref
- status
- private_evidence_ref
- public_status_uri
- created_at
- resolved_at
```

Implementation must refine `*_ref` fields so they do not become accidental public identity links.

## What remains blocked

Before Slice 3 ballot casting, the project still needs:

- chosen voting protocol
- auth provider / member eligibility source decision
- exact secret-ballot model
- receipt protocol
- retention schedule
- role/permission matrix
- audit log tamper-evidence design
- dispute/recount evidence handling
- accessibility and fallback requirements
- explicit non-production UI copy
