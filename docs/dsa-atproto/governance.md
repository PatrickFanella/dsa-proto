# Governance and Safety Rules

This document describes the governance semantics implemented by the current prototype. It is not a production DSA governance policy.

## Current trust labels

Trust labels are display and filtering signals for public records:

- `official`
- `verified-by-national`
- `verified-by-chapter`
- `verified-by-caucus`
- `self-declared`
- `community-submitted`
- `secondary-source`
- `uncertain`

The prototype treats `revoked`, `disputed`, `archived`, `superseded`, and `tombstoned` as lifecycle or resolver states, not trust labels.

## Current authority behavior

Authority is fixture-backed. The resolver combines target records, known revisions, supporting authority records, disputes, revocations, archive markers, lifecycle state, trust label, and caveats.

Production trust roots, key custody, signature validation, account recovery, and delegated issuer authorization are not implemented.

## Current app-write governance

The write gateway exists but is fail-closed by default.

Current app-write rules:

- no public Almaz write access;
- no app access to admin fixture ingest;
- app tokens authenticate against a local registry;
- app scopes restrict collection, host, and allowed trust labels;
- ordinary app writes cannot publish foundation families;
- ordinary app writes cannot self-assign `official` or verified labels;
- review-required apps create private `pending_review` operations only;
- the only first-family app-write preview is `org.dsa.event.public`.

## Current data safety boundary

The public layer is only for public organizational and civic records.

Out of scope for public records:

- private member databases;
- personal contact details not explicitly published for the demo;
- dues/payment status;
- grievance, casework, disciplinary, or private deliberation material;
- sensitive logistics;
- external proof-chain records;
- election/ballot systems.

Publication-boundary validation rejects disallowed record families and obvious unsafe private-data-shaped payload keys during fixture replay, registry health validation, and live-ingest paths. This is a guardrail, not a complete privacy review.

## Current correction and dispute model

The prototype represents corrections and contested status with first-class records and resolver output rather than silent UI-only edits:

- disputes use `org.dsa.authority.dispute`;
- revocations use `org.dsa.authority.revocation`;
- archive markers use `org.dsa.record.archive`;
- identity continuity records model rename/supersession/archive/tombstone cases;
- immutable revision history is preserved for known records.

Apps should surface those states when they affect interpretation.

## Future production governance not built yet

Before any production use, the project would need real governance for:

- official handle ownership;
- DID/key custody and recovery;
- delegated authority checks;
- moderation queues and takedown procedures;
- schema evolution and deprecation windows;
- operational ownership for indexers, APIs, backups, and incident response.
