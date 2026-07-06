# Authority-Chain Validation and Key Custody

This document defines the intended trust and custody model for official DSA-shaped records.
It is design-level only. No production authority-chain validation, key custody service, recovery workflow, or revocation backend is implemented yet.

## Purpose

The system needs a verifiable answer to: who was allowed to sign this record, under what authority, with what key, and what happened if that authority later changed?

This design covers:

- trust root
- DIDs and handles
- signing and key custody
- delegation-chain validation
- revocation, dispute, and supersession
- recovery and rotation
- audit-log expectations
- privacy risks
- phased implementation milestones

## Trust root

The trust root is the organizational decision that says which authorities are canonical for a given DSA namespace.

Expected shape:

- National DSA designates the top-level trust root for `org.dsa.*` records.
- Chapters, caucuses, committees, and other units may receive delegated authority only within the scope granted to them.
- A trust-root record should be explicit, public where possible, and versioned like any other authority record.

What this is not:

- not a blockchain consensus layer
- not implicit trust in a single server
- not “whoever published last wins”

## DIDs and handles

- The DID is the durable identifier that anchors control of the identity.
- The handle is the human-readable name that resolves to the current DID mapping.
- Handles may change; the DID should remain stable across renames and migrations.
- A record should identify both the issuing DID and the handle in effect at signing time, if available.

The validation model must distinguish:

- identity ownership
- naming/branding
- authority to speak for an organizational unit

## Signing and key custody

Records should be signed by keys controlled by the authority that is allowed to issue them.

Expected custody options:

- self-custody for individuals or small groups
- organizational custody for chapter or national keys
- hardware-backed or delegated operational custody for high-value authorities

Minimum expectations:

- signing keys are scoped to specific authority roles
- private keys are not shared casually across unrelated roles
- custody changes are recorded as first-class authority events
- compromise of a key does not automatically imply continued authority

## Delegation-chain validation

A consumer validating a record should be able to walk the chain:

1. record signature is valid
2. signer DID is current and recognized
3. signer key was active at the record timestamp
4. signer had authority delegated by a parent authority
5. the delegation scope covers this record type and subject
6. no later revocation, supersession, or dispute invalidates the claim for the intended use

Validation should surface the entire chain, not just a pass/fail result.

## Revocation, dispute, supersession

Rules:

- Revocation removes future authority; it does not erase history.
- Dispute marks a claim as contested and may downgrade trust pending review.
- Supersession replaces an earlier record for current-state views while preserving the old record for audit/history.
- Archive means the record is no longer current, but still discoverable for historical context.

Recommended precedence for current-state presentation:

`revoked` > `disputed` > `superseded` > `archived` > `active`

## Recovery and rotation

The design should support:

- routine key rotation on a scheduled or risk-driven basis
- emergency rotation after compromise
- recovery procedures when an authorized custodian loses access
- authority re-issuance after organizational changes

Rotation should preserve continuity by linking the new key or DID to the old authority record with a signed transition event.

## Audit-log expectations

The audit trail should answer who changed what, when, why, and under what authority.

Expected audit properties:

- append-only history for authority events
- timestamps for issuance, rotation, revocation, dispute, and recovery actions
- actor identity for administrative actions
- references to source evidence or ticket/decision records when available
- enough detail to reconstruct validation decisions later

Audit logs should be tamper-evident in design, even if the prototype implementation is initially local or fixture-backed.

## Privacy risks

Authority-chain data can expose more than intended.

Risks include:

- revealing who controls sensitive organizational functions
- exposing delegation structure or internal succession disputes
- leaking operational patterns through rotation or recovery events
- correlating handles, DIDs, and organizational roles across systems

Mitigations should include minimal public metadata, selective disclosure where possible, and clear separation between public authority records and private operational evidence.

## Not implemented yet

Still missing from the prototype:

- production trust root and canonical authority registry
- DID/handle verification workflow beyond fixture/demo semantics
- authoritative delegation-chain validation service
- key custody or hardware security module integration
- recovery/rotation automation
- dispute resolution workflow with lifecycle enforcement
- tamper-evident audit log pipeline

## Phased milestones

1. **Phase 0 — Design baseline**: publish this document and align vocabulary across foundation docs.
2. **Phase 1 — Metadata model**: add canonical authority, custody, revocation, and supersession fields to record schemas.
3. **Phase 2 — Resolver support**: expose chain-of-authority explanations in read APIs and UI caveats.
4. **Phase 3 — Validation service**: implement delegated-signature verification and lifecycle checks.
5. **Phase 4 — Custody operations**: support rotation, recovery, and emergency revocation procedures.
6. **Phase 5 — Audit and hardening**: produce tamper-evident logs, alerts, and operational review tooling.

## Related docs

- [README.md](README.md)
- [foundation-layer.md](foundation-layer.md)
- [current-state.md](current-state.md)
