# Production Internal Voting Architecture Plan

## Status

Advisory plan for **real internal DSA voting**. This is not an approval to run binding elections with the current `dsa-proto` implementation.

The current repository contains public ATProto-shaped civic records plus a local, non-production voting prototype. Production voting requires a separate private voting system with reviewed cryptography, operations, governance, and audit procedures.

## Executive recommendation

Treat voting as a high-assurance internal system that publishes only selected public artifacts outward:

```text
Authoritative member/eligibility source
        ↓
Private eligibility snapshot + voter auth/MFA
        ↓ issues one-use anonymous ballot credentials
Anonymous ballot box + encrypted ballot store
        ↓
Frozen tally set + threshold tally/certification
        ↓
Certified aggregate result summary
        ↓
Public ATProto result record after privacy review
```

ATProto may publish election notices, proposal text, choices, certification metadata, dispute status, and certified aggregate results. It must never contain rosters, auth tokens, eligibility proofs, raw ballots, receipt secrets, raw audit logs, per-voter turnout, or dispute evidence identifying voters.

## Production blockers

Severity-ranked blockers before any real election:

### Critical

1. **No chosen voting protocol.** The project needs an externally reviewed protocol for one-voter-one-counted-ballot, ballot secrecy, inclusion verification, tally verification, and recounts.
2. **No authoritative eligibility integration.** The system must know which DSA member system is authoritative, how eligibility freezes, and how exclusions/corrections/appeals work.
3. **No production authentication or MFA.** Voters need a real identity provider flow; admins and certifiers need phishing-resistant MFA and hardened accounts.
4. **No anonymous credential boundary.** Production must prevent the service that knows voter identity from learning ballot choices. Local synthetic credentials are insufficient.
5. **No tamper-evident audit and evidence-retention model.** Logs, ballot commitments, tally inputs, disputes, and admin actions must survive insider attacks and recounts without exposing votes.
6. **No separation-of-duties enforcement.** A single operator must not be able to change eligibility, issue credentials, inspect ballot data, run tally, certify, and publish results.

### High

7. **No certification/recount/dispute procedure.** Governance must define who certifies, who can challenge, deadlines, evidence access, and remedies.
8. **No key-management design.** Ballot encryption, signing, credential issuance, audit-log signing, backups, and revocation need HSM/KMS-backed key custody and dual control.
9. **No privacy review for small electorates.** Turnout and aggregate results can identify people in small chapters, committees, caucuses, or close/controversial votes.
10. **No production operations plan.** Availability, monitoring, incident response, backup/restore, disaster recovery, rate limiting, and DDoS resilience are undecided.
11. **No accessibility/fallback policy.** Real voting needs accessible UX, assisted-voting safeguards, and documented manual fallback that preserves secrecy and auditability.

### Medium

12. **No external security review plan.** Binding elections need independent AppSec and voting-systems review before pilot and again before broad rollout.
13. **No data-retention schedule.** Retention must balance audit/dispute needs against member privacy and political risk.
14. **No public communications policy.** Public records and UI copy must avoid leaking partial results, turnout-by-person, eligibility reasons, or internal conflict details.

## Required production components

### 1. Public ATProto publication layer

Allowed records:

- election notices
- proposal/resolution text
- public choices/options
- public status: scheduled, open, closed, certified, disputed, revoked, archived
- certified aggregate result summaries after privacy review
- certification metadata and caveats

Forbidden records:

- voter rosters or membership status
- eligibility proofs or reasons
- authentication/session tokens
- anonymous credential serials before final safe disclosure review
- ballots, encrypted ballots, raw commitments, receipt secrets, or receipt hashes that prove a choice
- per-voter turnout or participation records
- raw audit/admin/dispute/recount evidence

### 2. Identity, authentication, and MFA

Requirements:

- Integrate with a real IdP using OIDC/SAML or equivalent.
- Require MFA for voters where governance accepts the usability tradeoff.
- Require phishing-resistant MFA for admins, certifiers, auditors, and operators.
- Use short-lived sessions, CSRF protections, replay protection, secure cookies, and strict transport security.
- Prohibit support/admin impersonation for ballot casting.
- Log auth events without ballot choices or credential-to-choice links.

### 3. Eligibility service

Requirements:

- Import from the authoritative membership system into a private eligibility snapshot.
- Freeze eligibility before opening, with a documented correction and appeal process.
- Enforce one active voting opportunity per eligible voter per contest.
- Keep dues/payment/member-status detail outside public records and receipts.
- Give eligibility admins no access to ballot choices or tally internals.

### 4. Anonymous credential issuer

Production should use reviewed anonymous credentials, commonly a blind-signature or equivalent token-issuance flow:

1. Voter authenticates and passes eligibility checks.
2. Eligibility service marks that the voter received a ballot opportunity.
3. Credential issuer signs or issues a one-use ballot credential without learning the final ballot choice.
4. Ballot box verifies the credential and consumes it atomically without learning voter identity.

Requirements:

- Credentials are one-use, election/proposal-scoped, expiry-bound, and replay-resistant.
- Issuance logs cannot be joined with ballot submissions by precise timestamp, IP address, user agent, session ID, or credential identifier.
- Duplicate issuance, lost credentials, and failed submissions have documented recovery rules.

### 5. Anonymous ballot box

Requirements:

- Accept ballots only with valid unspent anonymous credentials.
- Atomically consume credentials to prevent double voting and replay.
- Store ballot content without voter identity, session ID, eligibility reason, IP address, or user agent.
- Encrypt ballots at rest and in transit.
- Keep polls-open state separate from tally state; no interim results by default.
- Produce inclusion artifacts that prove acceptance without proving the selected choice.

### 6. Cryptographic tally and certification service

The exact protocol needs external review. The plan should decide between a pragmatic blind-token encrypted-ballot design and a stronger end-to-end verifiable voting protocol.

Minimum requirements:

- Freeze the accepted ballot set at close.
- Hash/commit to the frozen input set.
- Use threshold-controlled decryption or tally authorization so one operator cannot reveal or alter results alone.
- Record tally runs with input-set hash, software version, operator/certifier approvals, and output hash.
- Publish only certified aggregate results after privacy review.

### 7. Receipts and voter verification

Receipts may prove:

- ballot submission was accepted;
- an inclusion artifact is present in the final tally set, if the chosen protocol safely supports this.

Receipts must not prove:

- selected choice, ranking, or ballot content;
- membership status or eligibility reason;
- whether any other voter participated;
- a coercer-verifiable vote.

Pragmatic first-production posture: use opaque receipt IDs plus a public or private bulletin-board inclusion check only after protocol review. Do not publish raw receipts to ATProto.

### 8. Tamper-evident audit log

Requirements:

- Append-only, hash-chained, signed audit events.
- WORM/immutable storage or equivalent retention controls.
- Separate security logs, election-admin logs, eligibility logs, credential-issuance logs, ballot-box logs, tally logs, certification logs, and publication logs.
- No log entry may contain both voter identity and selected choice.
- Regular external anchoring of log digests is allowed; raw logs must remain private.
- Break-glass access must be dual-approved and itself audited.

### 9. Admin separation and permissions

Minimum roles:

- **Election admin:** creates election metadata, proposals, choices, and notices; cannot alter eligibility or certify results.
- **Eligibility admin:** imports/freezes eligibility and handles corrections; cannot see ballot choices.
- **Credential issuer operator:** operates credential issuance; cannot tally or certify.
- **System operator:** maintains infrastructure; cannot cast as voter, change election meaning, or certify.
- **Tally operator:** runs approved tally jobs; cannot alter eligibility or publish results alone.
- **Certifier:** approves final tally and certification; cannot alter eligibility or ballots.
- **Dispute reviewer:** accesses minimum necessary evidence under privacy controls.
- **Security auditor:** reviews audit logs and admin actions; cannot alter election state.

High-risk actions should require dual control: eligibility freeze, election open/close override, credential issuer key rotation, tally execution, result certification, result revocation, evidence export, and break-glass access.

### 10. Recount and dispute process

Minimum flow:

1. Close election and freeze accepted ballot set.
2. Record input-set hash and audit-log digest.
3. Run initial tally under controlled role separation.
4. Certifiers review eligibility counts, credential-consumption counts, ballot counts, tally output, software version, and audit exceptions.
5. Publish certified aggregate result only after privacy review.
6. During challenge window, lock evidence and restrict access.
7. Dispute reviewers inspect minimum necessary evidence.
8. Outcome is upheld, amended, revoked, rerun, or escalated under governance rules.
9. Public ATProto layer shows only safe status/caveat and certified aggregate result.

## Threat model priorities

Highest-priority abuse paths to design and test against:

- Ineligible voter obtains credential.
- Eligible voter is omitted or blocked.
- Voter votes twice through race/replay/reissue paths.
- Admin changes eligibility after seeing turnout or partial results.
- Operator links issuance timing/network metadata to ballot choices.
- Receipt can be used for coercion or vote selling.
- Ballot box drops, replaces, or stuffs anonymous ballots.
- Tally operator runs unofficial interim tallies.
- Certifier publishes wrong or uncertified results.
- Raw audit/dispute evidence exposes political participation.
- Small electorate result or turnout leaks individual choices.
- ATProto publication accidentally leaks private artifacts forever.

## Suggested implementation phases

### Phase 0: Governance and security gate

No production code. Produce signed-off requirements:

- election types in scope;
- authoritative eligibility source;
- eligibility freeze/correction/appeal rules;
- auth/MFA policy;
- voting method limits;
- secret-ballot and receipt requirements;
- certification, recount, dispute, and retention policies;
- role matrix and dual-control matrix;
- external-review plan.

### Phase 1: Production architecture spike

Build a design spike, not election-running code:

- choose candidate protocol with external reviewer input;
- model anonymous credential issuance and ballot-box trust boundaries;
- define audit-log schemas and event taxonomy;
- define KMS/HSM and key-ceremony needs;
- write abuse-case tests as executable or checklist acceptance criteria.

### Phase 2: Private service foundation

Implement non-ballot production foundations:

- IdP integration and MFA enforcement;
- admin RBAC and dual-control approvals;
- private eligibility snapshot import/freeze;
- append-only audit log;
- public/private publication guardrails;
- no ballot casting yet.

### Phase 3: Anonymous credential and ballot-box pilot

Implement a non-binding pilot using synthetic or consenting test electorate:

- one contest, single-choice only;
- anonymous one-use credentials;
- atomic credential consumption;
- anonymous encrypted ballot storage;
- non-choice-revealing receipts;
- no public result claims.

### Phase 4: Tally, certification, and dispute pilot

Add closed-election controls:

- frozen input set and input hash;
- tally run records;
- certifier approval workflow;
- privacy review for aggregate publication;
- dispute/recount evidence lockbox;
- safe `org.dsa.vote.result` publication path.

### Phase 5: External review and limited binding pilot

Before any binding election:

- independent cryptographic protocol review;
- AppSec review and penetration test;
- privacy review for membership and political-affiliation risks;
- operations game day for outage, compromise, recount, and revocation;
- accessibility review;
- public voter instructions and incident communications plan.

### Phase 6: Broader rollout

Only after a successful limited pilot:

- support more election types incrementally;
- add revoting/replacement only with separate review;
- add ranked-choice or multi-seat elections only with separate tally/secrecy/recount design;
- publish recurring audit summaries and post-election reports.

## Near-term repo action

Keep `/api/local-voting/*` explicitly local-only. The next safe production-oriented work is documentation and design gates, then private auth/eligibility/audit foundations without ballot casting.
