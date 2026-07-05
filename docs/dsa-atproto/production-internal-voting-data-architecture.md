# Production Internal Voting Data Architecture Plan

Status: planning guidance. This is **not** a production-ready voting protocol. It refines the private data architecture needed before any binding internal election work.

## Recommendation

Keep ATProto as the public governance artifact layer and build a separate private voting system. Production remains blocked until a reviewed anonymous credential / ballot protocol is selected; a normal web-app schema alone cannot safely provide secret ballots.

```text
Public civic indexer/API
- current atproto_records public envelopes
- org.dsa.vote.election / proposal / choice
- future certified org.dsa.vote.result only

Private voting system
- election operations DB
- eligibility snapshot service DB
- credential issuer DB
- anonymous ballot box DB
- tally/certification/dispute DB
- tamper-evident audit log
```

Do not share database roles, logs, analytics streams, or request identifiers across the identity-bearing services and the ballot box.

## Private/public data boundary

Public ATProto may contain election notices, proposal text, choice labels, opening/closing times, public eligibility description, certified aggregate result summaries, caveats, and public dispute status.

Never publish voter rosters, eligibility proofs, member/dues status, auth sessions, credential tokens, ballot receipts, raw ballots, audit logs, admin actions, recount evidence, per-person turnout, or timestamps granular enough to relink voters to ballots.

## Core private tables/concepts

Use separate schemas or, preferably, separate databases for identity-bearing data and anonymous ballots.

### `voting_config` schema

- `elections(id, public_election_uri, status, opens_at, closes_at, frozen_at, certified_at, config_hash)`
- `proposals(id, election_id, public_proposal_uri, status, frozen_content_hash)`
- `choices(id, proposal_id, public_choice_uri, sort_order, frozen_content_hash)`

Constraints/indexes:

- `CHECK (opens_at < closes_at)`.
- `UNIQUE (public_election_uri)`, `UNIQUE (public_proposal_uri)`, `UNIQUE (public_choice_uri)`.
- `UNIQUE (proposal_id, sort_order)` and `UNIQUE (proposal_id, public_choice_uri)`.
- Status transitions enforced by application plus DB trigger; no proposal/choice edits after freeze except compensating version records.

### `eligibility` schema

- `eligibility_snapshots(id, election_id, source_ref, source_hash, status, frozen_at, imported_by_ref)`
- `eligible_voters(id, snapshot_id, voter_subject_hmac, eligibility_scope, status, created_at)`
- `eligibility_appeals(id, snapshot_id, voter_subject_hmac, status, private_evidence_ref)`

Boundaries:

- Store only a KMS-peppered HMAC/pseudonymous subject key, not full member records.
- The authoritative member/dues system stays outside voting DBs.
- No choice, credential serial, ballot id, receipt, IP, or user-agent fields here.

Constraints/indexes:

- `UNIQUE (snapshot_id, voter_subject_hmac)`.
- Partial unique index for one frozen active snapshot per election.
- Index `(snapshot_id, status)` for counts and issuance checks.

### `credential_issuer` schema

- `credential_issuances(id, election_id, proposal_id, eligible_voter_id, issued_at_coarse, revoked_at, blinded_request_hash, audit_event_id)`

Production requirement:

- Use blind signatures or an equivalent anonymous credential. The value stored here must not be the serial/nullifier later seen by the ballot box.
- If the issuer can join `eligible_voter_id` to a ballot nullifier, the system is non-production.

Constraints/indexes:

- `UNIQUE (eligible_voter_id, proposal_id) WHERE revoked_at IS NULL` unless a reviewed revote/reissue protocol exists.
- Index `(proposal_id, issued_at_coarse)` only for aggregate operations; avoid precise linkable timestamps.

### `ballot_box` schema

- `anonymous_ballots(id, election_id, proposal_id, anonymous_nullifier_hash, encrypted_choice_payload, payload_hash, accepted_at_coarse, audit_event_id)`
- `ballot_receipts(id, proposal_id, receipt_token_hash, ballot_inclusion_hash, issued_at_coarse)`

Boundaries:

- No voter id, session id, eligible voter id, issuance id, IP, user-agent, auth provider id, or admin actor id.
- Prefer encrypted/opaque choice payload until tally. If plaintext `choice_id` is stored for a simpler election, restrict it to the ballot-box role and treat it as highly sensitive.

Constraints/indexes:

- `UNIQUE (proposal_id, anonymous_nullifier_hash)` to prevent duplicate anonymous credentials.
- `UNIQUE (receipt_token_hash)`.
- Index `(proposal_id, accepted_at_coarse)` for input-set construction.
- Append-only trigger preventing update/delete after acceptance.

### `tally` and `certification` schemas

- `tally_input_sets(id, proposal_id, input_set_hash, ballot_count, frozen_at)`
- `tally_runs(id, input_set_id, tally_algorithm, aggregate_result_json, result_hash, computed_at, computed_by_ref)`
- `certifications(id, tally_run_id, certifier_ref, status, certified_at, public_result_uri)`
- `public_result_outbox(id, certification_id, atproto_record_json, status, published_at)`

Constraints/indexes:

- `UNIQUE (proposal_id, input_set_hash)`.
- `UNIQUE (tally_run_id, certifier_ref)`.
- No tally before election close/freeze; enforce in service and DB trigger.
- No public outbox publish until certification status is approved and privacy review passes.

### `disputes` and `audit` schemas

- `disputes(id, election_id, proposal_id, opened_by_ref, status, private_evidence_ref, public_status_uri, created_at, resolved_at)`
- `audit_events(id, service_name, chain_id, sequence_no, event_type, actor_ref, target_ref, metadata_json, metadata_hash, previous_event_hash, event_hash, key_id, created_at)`
- `admin_actions(id, audit_event_id, action_type, actor_ref, target_ref, reason_hash, created_at)`

Audit hash chain:

- Compute `event_hash = sha256(canonical_json(event_without_hashes) || previous_event_hash)`.
- Maintain separate chains per service/sensitivity class to avoid mixing voter identity and ballot content.
- Sign daily checkpoints with a KMS key; optionally publish only checkpoint hashes and aggregate counts after privacy review.
- Audit metadata must not contain ballot choice beside identity-bearing fields.

## Data integrity requirements

- Every state-changing endpoint uses idempotency keys and serializable transactions or explicit row locks.
- Credential issuance and ballot submission must be race-safe; two concurrent submissions with one anonymous credential produce at most one ballot.
- Accepted ballots, audit events, tally input sets, and certifications are append-only; corrections are compensating records.
- `input_set_hash` is calculated over a canonical ordered list of accepted ballot ids/nullifiers/payload hashes.
- Reconcile counts at certification: accepted ballots <= eligible voters, duplicate nullifiers = 0, tally input hash matches stored ballots, certifier quorum satisfied.
- Application tests must assert forbidden columns never appear in ballot tables and forbidden fields never leave private APIs.
- Logs/metrics must be privacy-reviewed; ballot endpoint logs should omit request body, token, IP, user agent, and identity context.

## Migration, retention, and backups

- Introduce new private schemas in additive migrations only; add nullable columns, backfill, then `VALIDATE CONSTRAINT` before `NOT NULL`/strict checks.
- Use distinct DB roles: config admin, eligibility admin, credential issuer, ballot box writer, tally reader, certifier, dispute reviewer, auditor. No shared superuser in application code.
- Encrypt at rest; keep HMAC peppers, signing keys, and ballot decryption keys in KMS/HSM, not Postgres.
- Enable PITR and tested restores for private DBs; backups inherit the same sensitivity and retention as primary data.
- Retention defaults to decide before production: sessions hours/days; auth logs days; eligibility snapshots through dispute/appeal window then minimized; ballots/receipts through legal/governance retention then crypto-erased or deleted; certifications/public results long-term; audit logs long-term but minimized.
- Deletion policy must include backups: expire backup sets or use crypto-erasure where legal deletion is required.

## Implementation slices

1. **Design gate**: protocol choice, threat model, role matrix, retention schedule, small-electorate privacy rules.
2. **Private schema skeleton**: additive migrations for config, eligibility, credential issuer, ballot box, tally, disputes, audit; no casting yet.
3. **Eligibility snapshot**: import/minimize/freeze snapshot; aggregate counts only; appeal placeholders.
4. **Credential issuance adapter**: anonymous credential interface with a fake local adapter and a production-blocking feature flag until blind credentials are reviewed.
5. **Anonymous ballot box**: submit opaque/encrypted ballots with unique nullifier, receipt hash, append-only writes, and race tests.
6. **Close/freeze/tally**: construct input-set hash, run aggregate tally after close, prevent interim results.
7. **Certification/outbox**: certifier workflow and ATProto `org.dsa.vote.result` publication after privacy review.
8. **Disputes/recount**: evidence locking, minimum-necessary access, status-only public updates.
9. **Ops hardening**: backup/restore drills, retention jobs, log scrubbing, audit checkpoint verification, incident runbook.

## Main risks

- Timing, logs, receipts, or credential serials can re-identify ballots even if tables look separated.
- Small electorates can leak choices through aggregate publication.
- Admins/operators with broad DB access can reconstruct links unless duties and database privileges are split.
- Backups and observability pipelines often retain sensitive data longer than the primary DB.
- Without a reviewed anonymous credential protocol, production secret-ballot claims are unsafe.
