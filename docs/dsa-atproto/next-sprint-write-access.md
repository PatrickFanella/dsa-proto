# Next Sprint: Write Access Readiness

This sprint gets the foundation layer ready for controlled app writes without turning the public demo into a writable surface.

The goal is not open publishing. The goal is a narrow, auditable write path that apps can use in staging first, while Almaz remains read-only and the foundation families remain protected.

## Non-goals

- No public writable Almaz demo.
- No generic app access to `/api/admin/fixtures/ingest`.
- No app writes to identity, authority, verification, org graph, archive, dispute, revocation, or identity-continuity families.
- No voting, external source-chain, private member data, grievance/casework, payment, or sensitive logistics records.
- No app-side trust upgrades to `official` or `verified-*`.

## Sprint slices

### 1. Freeze Foundation Read Contract v1

Publish a durable app-facing read reference under `docs/reference/` for:

- stable read endpoints;
- resolver shape;
- lifecycle, authority, and trust vocabularies;
- compatibility rules;
- current fixture/demo caveats.

Also fix docs drift where lifecycle states are described as trust labels or older lifecycle enums omit `deprecated` / `tombstoned`.

### 2. Single Source-of-Truth Runtime

Make the canonical fixture file the default non-test dataset source, while keeping built-in seed arrays for tests and local fallback. Add explicit dataset/schema metadata so readiness and docs can talk about one source of truth.

### 3. App Registry + Scope Model

Add a small registered-app model with scoped permissions:

- app id and display name;
- token identity for prototype auth;
- allowed collections;
- allowed subject or host entity scopes;
- trust-label ceiling;
- whether review is required;
- allowed lifecycle/workflow transitions where relevant.

Default registered apps may only target app-layer public record families. Foundation record families are blocked or review-only.

Baseline fixture registry: one staging/demo app token may write only `org.dsa.event.public`, only for the allowed host entity scope, and only with `community-submitted` / `uncertain` trust labels while `reviewRequired` remains true.

### 4. Write Operation + Audit Store

Add the write-operation model before persistence into public projections. Every write attempt should produce a private operation/audit entry with app id, request hash, target collection/URI, decision, validation errors, and timestamp. Pending/rejected/dry-run operations must remain private operation records and must not appear in public read projections.

### 5. Write Gateway Dry-Run Mode

Add a dedicated `/api/write/records` gateway behind fail-closed flags and prototype app auth. Dry-run mode validates:

- JSON shape;
- app auth and scope;
- schema/lexicon;
- publication boundary;
- subject/host entity existence where applicable;
- resolver summary;
- idempotency key shape;
- optimistic-concurrency headers.

Dry-run returns stable machine-readable validation and operation data without mutating public records.

Gate it behind `ENABLE_WRITE_GATEWAY=false` by default, and keep it disabled whenever `DEMO_READ_ONLY=true`.

### 6. Append-Only Writes + Idempotency

Enable persistent write operations with mandatory idempotency keys and optimistic concurrency. Accepted writes append immutable revisions and only update public current projections when the operation is allowed to publish. Same idempotency key plus same request returns the same operation; same key plus a different request returns conflict.

Runtime guardrails:

- `ENABLE_WRITE_GATEWAY=true` is required for any `/api/write/records` traffic;
- `ENABLE_WRITE_PUBLISH=true` is additionally required for non-dry-run publish attempts;
- `DEMO_READ_ONLY=true` disables all write routes;
- review-required apps create private `pending_review` operations and do not touch public projections;
- publish-eligible apps ingest only after passing concurrency checks.

### 7. First Writable Family: `org.dsa.event.public`

Enable only public event writes for a registered staging app. Event writes remain constrained to public fields, scoped host entities, `community-submitted` or weaker trust treatment, and moderation rules from the app registry.

Do not enable statements, articles, endorsements, foundation identity, authority, verification, org graph, archive, dispute, revocation, or member-affiliation writes in this slice.

### 8. Staging Deploy Flags and Docs

Document the safe rollout model:

- Almaz stays read-only;
- writable mode requires explicit env flags;
- app tokens stay out of git;
- staging deploys must run smoke tests;
- rollback is disabling write flags before touching data.

## Exit criteria

- `rtk make verify` passes after every slice.
- Every slice is committed separately.
- Generic admin ingest is documented and configured as local/dev-only, not an app write path.
- App write gateway is fail-closed by default.
- Foundation families cannot be written by ordinary apps.
- `org.dsa.event.public` is the only first writable family.
- Pending/rejected writes are visible as operations/audit entries but not public records.
