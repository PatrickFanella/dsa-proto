# Production Voting Governance and Protocol Gate

Status: Phase 0 gate for Plan 4. No production voting code should be written until this gate has explicit human sign-off.

This document turns the production voting architecture into an implementation-ready checklist. It is meant to prevent accidental production claims from a prototype and to force early decisions about governance, eligibility, protocol, auditability, and operations.

## Gate outcome

This gate is complete only when the project has a signed-off packet containing:

1. first production election type in scope;
2. authoritative eligibility source contract;
3. eligibility freeze, correction, and appeal rules;
4. authentication and MFA policy;
5. voting method limits;
6. ballot secrecy and receipt protocol decision;
7. role matrix and dual-control matrix;
8. retention/deletion schedule;
9. audit event taxonomy;
10. recount, dispute, certification, and revocation procedure;
11. small-electorate privacy rule;
12. external review checklist and named reviewers or reviewer criteria.

If any item remains undecided, production ballot casting remains blocked.

## First production election scope worksheet

Fill this before designing schemas or services.

| Decision | Required answer | Blocking if missing |
| --- | --- | --- |
| Election type | e.g. officer election, endorsement vote, convention resolution, procedural vote | Yes |
| Binding effect | Binding / advisory / ratification / poll | Yes |
| Eligible electorate | National membership, chapter membership, caucus membership, delegates, committee members | Yes |
| Electorate size estimate | approximate minimum/maximum voter count | Yes |
| Sensitivity tier | low / medium / high / disciplinary or legally sensitive | Yes |
| Ballot method | single-choice, approval, ranked-choice, multi-seat, yes/no, multi-question | Yes |
| Revoting policy | no revotes / latest ballot counts / explicit replacement ceremony | Yes |
| Quorum rule | threshold and numerator/denominator | Yes |
| Notice period | how long before opening | Yes |
| Voting window | open and close rules, timezone, extension authority | Yes |
| Result publication | what aggregate result may be public | Yes |
| Challenge period | duration, who can challenge, remedy options | Yes |
| Accessibility/fallback | supported assistive flow and fallback safeguards | Yes |

Recommended first production candidate: a limited, single-choice, non-officer pilot with consenting test electorate and no sensitive discipline/casework implications.

## Eligibility source contract

The eligibility source must be authoritative before implementation.

Required fields for the contract:

- source system name and owner;
- legal/governance basis for eligibility;
- fields imported into the private eligibility snapshot;
- fields explicitly not imported;
- identity key used to derive a private voter subject HMAC;
- freeze timestamp;
- correction window;
- appeal path;
- eligibility admin role responsible for corrections;
- snapshot hash and signing/checkpoint procedure;
- retention period for snapshot and appeals evidence;
- deletion or minimization procedure after dispute window.

Rules:

- The public ATProto layer must never receive raw roster data, dues/payment status, member-status reason, or eligibility proof.
- Eligibility admins must not access ballot choices, ballot box data, tally internals, or receipt secrets.
- The voting system must support aggregate counts for audit without exposing per-voter participation publicly.

## Authentication and session decision

Production auth must use a real IdP or membership-controlled identity provider.

Required decisions:

- IdP / auth provider;
- voter MFA requirement;
- admin/certifier/auditor MFA requirement;
- session lifetime;
- device/browser constraints;
- CSRF and replay protections;
- account recovery policy;
- support flow and support-agent limits;
- explicit ban on admin/support impersonation for ballot casting;
- log fields allowed and forbidden.

Minimum posture:

- voters: short-lived session and MFA if governance accepts the accessibility/usability tradeoff;
- admins/certifiers/auditors/operators: phishing-resistant MFA;
- logs: no ballot choice beside identity/session/credential context.

## Voting protocol decision

Choose one protocol family before production implementation.

| Option | Status | Notes |
| --- | --- | --- |
| Blind-signature / anonymous credential + encrypted ballot box | Candidate first-production path | Simpler than full E2E voting but still requires external review. |
| End-to-end verifiable voting system | Stronger long-term path | Preferred for high-stakes elections if a vetted system can be adopted or integrated. |
| Procedural separation only | Not production secret ballot | Useful for prototypes, not binding elections. |

Required protocol properties:

- one eligible voter can obtain at most one active credential per contest unless a reviewed revote protocol exists;
- ballot box verifies a credential without learning voter identity;
- issuer cannot join the issued credential to the ballot/nullifier later seen by ballot box;
- ballot content is encrypted or otherwise protected until tally;
- receipt proves accepted submission or safe inclusion only, not selected choice;
- accepted ballot set can be frozen and hashed at close;
- tally can be reproduced from frozen inputs;
- recount evidence can be inspected without public disclosure of votes.

## Role matrix

No single human or service account may control the entire election lifecycle.

| Role | May do | Must not do | MFA | Audit requirement |
| --- | --- | --- | --- | --- |
| Election admin | Create election metadata, proposals, choices, notices | Import eligibility, issue credentials, inspect ballots, certify alone | Required | All config changes hash-chained |
| Eligibility admin | Import/freeze eligibility, handle corrections/appeals | See ballot choices, tally internals, receipt secrets | Required | Snapshot/correction events hash-chained |
| Credential issuer operator | Operate credential issuer and key ceremony under policy | See ballot choices, certify results, alter eligibility | Phishing-resistant | Issuance counts/checkpoints only; no choice data |
| Ballot-box operator | Operate anonymous ballot service | See voter identity, eligibility reason, auth session, certify results | Phishing-resistant | Ballot acceptance/checkpoint events, no identity data |
| Tally operator | Run approved tally jobs after close/freeze | Alter eligibility, change choices, certify alone | Phishing-resistant | Tally input hash, software hash, output hash |
| Certifier | Approve certification or reject tally | Alter eligibility, alter ballots, run infra alone | Phishing-resistant | Certification approval/rejection signed |
| Dispute reviewer | Inspect minimum necessary evidence under dispute rules | Publicly expose raw evidence, alter records | Phishing-resistant | Evidence access logged and dual-approved |
| Security auditor | Review audit logs and controls | Alter election state, ballots, or eligibility | Phishing-resistant | Read access logged |
| System operator | Deploy, monitor, restore infra | Cast as voter, alter election meaning, certify results | Phishing-resistant | Deploy/config/secret actions logged |

## Dual-control matrix

These actions require at least two distinct roles or two-person approval.

| Action | Required approval |
| --- | --- |
| Freeze eligibility snapshot | Eligibility admin + certifier or election admin |
| Open election | Election admin + certifier |
| Emergency close/extend election | Election admin + certifier + security auditor review |
| Rotate credential issuer key | Credential issuer operator + security auditor/system operator |
| Tally execution | Tally operator + certifier |
| Certify final result | Certifier quorum + audit exception review |
| Publish public result | Certifier + privacy reviewer/election admin |
| Revoke/amend result | Certifier + dispute reviewer + security auditor |
| Export dispute evidence | Dispute reviewer + security auditor |
| Break-glass admin access | System operator + security auditor, post-action review required |
| Restore private voting DB | System operator + security auditor + certifier notification |

## Retention schedule template

Set specific durations before production. Placeholder values are not approval.

| Data class | Default posture | Decision required |
| --- | --- | --- |
| Auth sessions | Short-lived; delete quickly | duration and invalidation rules |
| Auth logs | Minimized and identity-bearing | retention and access roles |
| Eligibility snapshot | Retain through certification/dispute window, then minimize | exact period and deletion method |
| Appeal evidence | Highly sensitive | exact retention and evidence owner |
| Credential issuance logs | Coarse counts/checkpoints; no ballot linkage | retention and timestamp precision |
| Anonymous ballots | Retain through dispute/recount period; encrypted/opaque | retention and crypto-erasure plan |
| Receipts | Hash/minimize; no choice proof | retention and voter lookup policy |
| Tally input sets | Long enough for audit/recount | retention and public digest policy |
| Audit events | Long-term but minimized | retention, checkpoint, immutable backup policy |
| Admin actions | Long-term sensitive logs | retention, access, export controls |
| Public result records | Long-term public | revocation/amendment policy |

## Audit event taxonomy

Minimum event families:

- `election.config.created`
- `election.config.updated`
- `election.config.frozen`
- `eligibility.snapshot.imported`
- `eligibility.snapshot.frozen`
- `eligibility.appeal.opened`
- `eligibility.appeal.resolved`
- `credential.issuance.requested`
- `credential.issuance.accepted`
- `credential.issuance.rejected`
- `ballot.accepted`
- `ballot.rejected`
- `election.closed`
- `tally.input_set.frozen`
- `tally.run.started`
- `tally.run.completed`
- `certification.approved`
- `certification.rejected`
- `result.published`
- `result.revoked`
- `dispute.opened`
- `dispute.evidence_accessed`
- `dispute.resolved`
- `admin.break_glass.opened`
- `admin.break_glass.closed`
- `secret.rotated`
- `deploy.released`
- `backup.restored`

Every event family must define:

- allowed actor role;
- target object;
- required reason;
- fields allowed in metadata;
- forbidden fields;
- hash-chain / checkpoint behavior;
- retention class.

Forbidden audit metadata combinations:

- voter identity + selected choice;
- auth/session token + ballot content;
- credential issuance identifier + anonymous ballot nullifier;
- receipt token + selected choice;
- eligibility reason + selected choice.

## Certification, recount, and dispute checklist

Before public results:

- election config frozen;
- eligibility snapshot frozen;
- ballot box closed;
- accepted ballot set frozen;
- input-set hash recorded;
- audit chain checkpointed;
- tally software version/hash recorded;
- tally run output hash recorded;
- duplicate credential/nullifier check passed;
- accepted ballots <= eligible voters;
- certifier quorum reached;
- privacy review passed for electorate size and result sensitivity;
- dispute window and communication plan ready.

Dispute flow must define:

- who can open a dispute;
- deadline to open;
- evidence lockbox owner;
- roles allowed to inspect evidence;
- minimum-necessary evidence rule;
- public status language;
- remedies: uphold, amend, revoke, rerun, escalate;
- how public ATProto result records are amended or revoked.

## Small-electorate privacy rule

Before publishing aggregate results, review:

- electorate size;
- turnout;
- number of choices;
- unanimity or near-unanimity;
- chapter/caucus/committee subgroup size;
- timing and public controversy;
- whether publication could expose individual political positions.

If privacy risk is high, publish a safer summary, delay publication, aggregate with a larger group, or do not publish public results.

## External review checklist

Required before binding production pilot:

- voting protocol review;
- AppSec review and penetration test;
- privacy review for membership/political-affiliation risks;
- accessibility review;
- operations game day;
- backup/restore drill;
- incident response tabletop;
- key ceremony rehearsal;
- recount/dispute tabletop;
- voter instructions review;
- public communications review.

Reviewers should be independent of day-to-day implementers where possible.

## Phase 0 completion checklist

Phase 0 is complete when:

- [ ] first election scope worksheet is complete;
- [ ] eligibility source contract is signed off;
- [ ] auth/MFA policy is signed off;
- [ ] voting protocol family is selected or an evaluation shortlist is approved;
- [ ] role matrix is accepted by governance/security stakeholders;
- [ ] dual-control matrix is accepted;
- [ ] retention schedule has concrete durations;
- [ ] audit taxonomy has allowed/forbidden fields;
- [ ] certification/recount/dispute procedure is accepted;
- [ ] small-electorate privacy rule is accepted;
- [ ] external review plan is accepted;
- [ ] non-negotiable public/private boundary remains unchanged.

Until every item is checked, the implementation backlog may proceed only on non-ballot foundations and design spikes.
