# Production Voting Implementation Backlog

Status: issue-ready backlog for Plan 4. This backlog assumes the Phase 0 governance/protocol gate is either complete or explicitly being worked in parallel where noted.

The backlog is deliberately ordered to prevent ballot-casting code from arriving before identity, eligibility, anonymous credential, audit, and public/private boundary controls exist.

## Labels

- **Gate**: must be complete before implementation proceeds.
- **Foundation**: production infrastructure or schema, no ballot casting.
- **Pilot**: non-binding or limited pilot work only.
- **Production-blocking**: required before binding election use.

## Backlog overview

```text
A. Governance/protocol gate
        ↓
B. Public/private guardrails + service skeletons
        ↓
C. Eligibility snapshot + auth/RBAC foundations
        ↓
D. Anonymous credential protocol spike
        ↓
E. Ballot box pilot with anonymous credentials
        ↓
F. Tally/certification/dispute pilot
        ↓
G. External review + limited binding pilot
```

## Issue 1: Complete Phase 0 governance/protocol gate

Type: Gate  
Blocked by: none  
Production-blocking: yes

### What to build

Complete and sign off the worksheet in `production-voting-governance-gate.md` for the first production election type.

### Acceptance criteria

- First production election scope worksheet is complete.
- Eligibility source contract is approved.
- Auth/MFA policy is approved.
- Voting protocol family or evaluation shortlist is approved.
- Role and dual-control matrix is approved.
- Retention schedule has concrete durations.
- Audit taxonomy has allowed and forbidden fields.
- Recount/dispute/certification flow is accepted.
- External review plan is accepted.

### Verification

- Documentation review by governance owner, security owner, and implementation lead.
- No production ballot code depends on unchecked items.

## Issue 2: Add production-mode public/private route guardrails

Type: Foundation  
Blocked by: none  
Production-blocking: yes for any public deploy

### What to build

Add production configuration that disables local-only and prototype-only mutation routes in production environments.

Routes that must default off in production:

- `POST /api/admin/fixtures/ingest`
- `/api/local-voting/*`
- fixture authoring/replay admin workflows from public web surfaces

### Acceptance criteria

- Production mode denies local admin fixture ingestion.
- Production mode denies local voting endpoints.
- UI hides or hard-disables local publisher and local voting panels in production mode.
- Tests cover local mode allowed and production mode denied.
- Docs explain how to run read-only demo mode.

### Verification

- `make verify`
- manual check with production-mode env flag

## Issue 3: Define private voting service package boundary

Type: Foundation  
Blocked by: Issue 1 enough to know first election scope  
Production-blocking: yes

### What to build

Create a separate private voting service boundary in the repo or a planned sibling service. Do not implement ballot casting yet.

### Acceptance criteria

- Separate service/module boundary from public civic API is documented and scaffolded.
- Private service dependencies and config are isolated from public ATProto read model.
- Public API cannot import private ballot internals.
- Private service has explicit non-production default until protocol review passes.
- Threat boundary tests or static checks prevent accidental public export of private ballot concepts.

### Verification

- `make verify`
- architecture review against `production-internal-voting-data-architecture.md`

## Issue 4: Add production voting config schema skeleton

Type: Foundation  
Blocked by: Issues 1 and 3  
Production-blocking: yes

### What to build

Add private schema skeleton for election config, proposals, and choices that mirrors public URIs but remains private and migration-managed.

### Acceptance criteria

- Versioned migration for private `voting_config` schema.
- Tables for elections, proposals, choices with public URI references.
- Constraints for unique public URIs and valid election windows.
- Status transition model documented and tested.
- No ballot, eligibility, credential, or receipt tables yet.
- Public `org.dsa.vote.*` records remain publication artifacts, not private state source of truth.

### Verification

- migration test
- `make verify`

## Issue 5: Add tamper-evident audit log skeleton

Type: Foundation  
Blocked by: Issues 1 and 3  
Production-blocking: yes

### What to build

Implement a private append-only audit log skeleton with hash-chained events and separate sensitivity chains.

### Acceptance criteria

- Audit table or service supports `sequence_no`, `previous_event_hash`, `event_hash`, `key_id`, metadata hash, and service/chain identifiers.
- Event hash is deterministic over canonical event content.
- Updates/deletes are blocked or represented by compensating events.
- Event taxonomy from governance gate is represented in code or config.
- Tests prove hash-chain verification and tamper detection.
- Forbidden metadata combinations are rejected.

### Verification

- `make verify`
- targeted audit-chain test

## Issue 6: Add admin RBAC and dual-control model

Type: Foundation  
Blocked by: Issues 1, 3, and 5  
Production-blocking: yes

### What to build

Model production admin roles and dual-control approvals for high-risk actions.

### Acceptance criteria

- Roles exist for election admin, eligibility admin, credential issuer operator, ballot-box operator, tally operator, certifier, dispute reviewer, security auditor, and system operator.
- High-risk actions require dual-control approvals according to `production-voting-governance-gate.md`.
- Role permissions are testable and denied by default.
- Admin actions write audit events.
- No single role can perform eligibility freeze, credential issuance, tally, certification, and publication alone.

### Verification

- permission matrix tests
- audit event tests
- `make verify`

## Issue 7: Add eligibility snapshot import/freeze skeleton

Type: Foundation  
Blocked by: Issues 1, 3, 5, and 6  
Production-blocking: yes

### What to build

Build private eligibility snapshot import and freeze mechanics without real member-system integration yet.

### Acceptance criteria

- Versioned private eligibility schema.
- Import accepts minimized synthetic or test roster data only.
- Voter subject stored as KMS-peppered HMAC or test equivalent; no raw member profile fields.
- Freeze prevents mutation except via appeal/correction records.
- Aggregate counts available for audit.
- No choice, credential, receipt, IP, user-agent, or ballot IDs in eligibility tables.
- Audit events for import/freeze/correction.

### Verification

- schema tests for forbidden columns/fields
- freeze/correction tests
- `make verify`

## Issue 8: Add identity/auth/MFA integration plan and adapter interface

Type: Foundation  
Blocked by: Issues 1 and 6  
Production-blocking: yes

### What to build

Define auth adapter interface and production IdP/MFA requirements. Provide a local fake adapter only for non-production tests.

### Acceptance criteria

- Auth adapter returns stable private subject reference and assurance level.
- Admin/certifier paths require stronger assurance than voter paths.
- Session expiry, CSRF/replay defenses, and support-flow limits are documented and testable.
- No admin impersonation for ballot casting.
- Auth logs never include ballot choice, credential serial, receipt, or nullifier.

### Verification

- adapter contract tests
- auth-log field tests
- `make verify`

## Issue 9: Spike anonymous credential protocol candidates

Type: Gate / Foundation  
Blocked by: Issues 1, 7, and 8  
Production-blocking: yes

### What to build

Evaluate credential protocol options and choose a first pilot protocol with external-review path.

### Acceptance criteria

- Compare blind signatures, anonymous credentials, and vetted E2E voting system integration.
- Document what the issuer learns, what the ballot box learns, what the voter receives, and what auditors can verify.
- Document coercion/receipt risks.
- Document revocation/reissue constraints.
- Select pilot protocol or explicitly defer production ballot work.
- External reviewer criteria are defined.

### Verification

- security review
- data-architecture review
- governance sign-off

## Issue 10: Add credential issuer pilot boundary

Type: Pilot  
Blocked by: Issues 5, 6, 7, 8, and 9  
Production-blocking: yes before binding use

### What to build

Implement a pilot credential issuer boundary using the chosen/evaluated protocol or a clearly non-production fake adapter.

### Acceptance criteria

- One active credential per eligible voter per contest unless revote protocol is approved.
- Issuance logs cannot be joined to ballot nullifiers.
- Precise linkable timestamps are avoided or coarsened according to policy.
- Duplicate issuance and lost credential policy is implemented or explicitly blocked.
- Audit events record aggregate-safe issuance events.
- Tests cover race/duplicate issuance.

### Verification

- concurrency tests
- forbidden-linkage tests
- `make verify`

## Issue 11: Add anonymous ballot box pilot

Type: Pilot  
Blocked by: Issues 9 and 10  
Production-blocking: yes before binding use

### What to build

Implement an anonymous ballot box that accepts valid anonymous credentials and stores opaque/encrypted ballot payloads.

### Acceptance criteria

- Ballot table contains no voter id, session id, eligible voter id, issuance id, IP, user agent, auth provider id, or admin actor id.
- Unique anonymous nullifier prevents duplicate counted ballots.
- Credential consumption is atomic.
- Ballots are append-only.
- Receipts do not prove selected choice.
- Public APIs and ATProto records cannot expose ballots, receipts, credentials, or nullifiers.

### Verification

- race/replay tests
- schema forbidden-field tests
- public leak tests
- `make verify`

## Issue 12: Add close/freeze/tally pilot

Type: Pilot  
Blocked by: Issues 10 and 11  
Production-blocking: yes before binding use

### What to build

Add closed-election tally mechanics over a frozen accepted ballot set.

### Acceptance criteria

- No tally while election is open.
- Accepted ballot set freezes at close.
- Input-set hash is deterministic and stored.
- Tally run records include software version/hash and output hash.
- Tally can be reproduced from frozen inputs.
- Counts reconcile: accepted ballots <= eligible voters, duplicate nullifiers = 0.
- No interim results leak through API, logs, or UI.

### Verification

- tally refusal while open test
- reproducible tally test
- no interim result test
- `make verify`

## Issue 13: Add certification and public result outbox

Type: Pilot / Production-blocking  
Blocked by: Issues 5, 6, and 12  
Production-blocking: yes

### What to build

Add certifier approval workflow and a safe public result outbox for future `org.dsa.vote.result` records.

### Acceptance criteria

- Certifier quorum required.
- Privacy review required before result outbox publish.
- Result record contains only aggregate certified results and caveats.
- Revocation/amendment path creates compensating records.
- Public ATProto outbox cannot publish raw private artifacts.
- Audit events for certification, rejection, publication, and revocation.

### Verification

- permission tests
- public/private boundary tests
- `make verify`

## Issue 14: Add dispute and recount evidence lockbox

Type: Pilot / Production-blocking  
Blocked by: Issues 5, 6, 12, and 13  
Production-blocking: yes

### What to build

Add private dispute/recount workflow with minimum-necessary evidence access.

### Acceptance criteria

- Disputes can be opened during configured challenge window.
- Evidence access is role-limited and dual-approved.
- Evidence exports are audited and minimized.
- Public status updates do not reveal voter identities or raw ballots.
- Outcomes support uphold, amend, revoke, rerun, or escalate.
- Recount uses frozen input set and audit checkpoints.

### Verification

- evidence access tests
- public status leak tests
- `make verify`

## Issue 15: Add ops hardening for production voting services

Type: Production-blocking  
Blocked by: Issues 3 through 14  
Production-blocking: yes

### What to build

Add operational controls for production voting service readiness.

### Acceptance criteria

- Separate dev/staging/prod configs.
- Private DB backups and restore drills documented/tested.
- Readiness checks verify migrations, DB connectivity, audit-log write health, and key availability.
- Structured logs avoid forbidden private artifacts.
- Alerts cover DB unavailable, audit write failure, stale backups, unusual auth failures, high ballot rejection, credential issuance anomalies.
- Incident runbooks exist for outage, credential compromise, audit-log failure, eligibility error, and certification dispute.

### Verification

- readiness tests
- runbook review
- restore drill evidence

## Issue 16: External review and limited binding pilot readiness

Type: Gate  
Blocked by: Issues 1 through 15  
Production-blocking: yes

### What to build

Prepare the package for external review and a limited binding pilot.

### Acceptance criteria

- Independent voting-protocol review complete.
- AppSec review and penetration test complete.
- Privacy review complete.
- Accessibility review complete.
- Ops game day complete.
- Recount/dispute tabletop complete.
- Voter instructions and incident communication plan reviewed.
- Pilot electorate, scope, and fallback plan approved.

### Verification

- external review findings accepted or remediated;
- explicit go/no-go decision recorded.

## Dependency summary

| Issue | Depends on | Can start before Phase 0 complete? |
| --- | --- | --- |
| 1 Governance/protocol gate | none | yes |
| 2 Production route guardrails | none | yes |
| 3 Service boundary | partial Issue 1 | yes, design-only |
| 4 Config schema | 1, 3 | no |
| 5 Audit skeleton | 1, 3 | no |
| 6 RBAC/dual control | 1, 3, 5 | no |
| 7 Eligibility snapshot | 1, 3, 5, 6 | no |
| 8 Auth adapter | 1, 6 | no |
| 9 Credential protocol spike | 1, 7, 8 | no |
| 10 Credential issuer | 5, 6, 7, 8, 9 | no |
| 11 Ballot box | 9, 10 | no |
| 12 Tally | 10, 11 | no |
| 13 Certification/outbox | 5, 6, 12 | no |
| 14 Dispute/recount | 5, 6, 12, 13 | no |
| 15 Ops hardening | 3-14 | no |
| 16 External review/pilot | 1-15 | no |

## Immediate next implementation recommendation

Do Issue 2 next in this repository: production-mode route guardrails.

Reason: it protects any future public demo from exposing local admin and local voting prototype routes while production voting planning continues.
