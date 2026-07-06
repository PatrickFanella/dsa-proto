# Foundation Contract Gap Map

This gap map audits the current prototype against [foundation-contracts.md](foundation-contracts.md). It is the working checklist for [next-sprint-foundation-contracts.md](next-sprint-foundation-contracts.md).

Status values:

- **Implemented**: current code/docs/tests satisfy the contract enough for the prototype.
- **Partial**: the concept exists, but behavior, fixtures, resolver output, or tests are incomplete.
- **Missing**: the contract is mostly documentation-only today.

## Summary

| Contract area | Status | Primary follow-up |
| --- | --- | --- |
| Identity continuity | Partial | Add rename/archive/supersession/tombstone fixtures and resolver behavior. |
| Authority | Partial | Make resolver output the app-facing authority/status/lifecycle contract. |
| Lifecycle/status | Partial | Normalize canonical lifecycle vocabulary and keep it separate from trust labels. |
| Org graph | Partial | Add relationship reference, type-pair, and hierarchy validation. |
| Verification/trust labels | Partial | Remove non-contract trust labels and test label/lifecycle separation. |
| Publication boundary | Partial | Add guardrails for disallowed record families and private-data-shaped payloads. |
| Resolver/API | Partial | Return enough context for apps to avoid recomputing authority locally. |
| UI/tests | Partial | Add regression coverage for contract behavior and display caveats. |

## Gap details

### 1. Identity continuity

Current state:

- `RecordEnvelope` gives each public record a stable URI, DID, handle, collection, and record payload.
- Directory normalization covers current chapter, caucus, and opt-in member-affiliation cards.

Gaps:

- No representative fixtures for rename, successor, dissolution, archive, supersession, or tombstone cases.
- Apps cannot yet follow identity continuity without special-case local logic.
- Handles and display names are not yet tested as mutable display fields rather than identity anchors.

Follow-up slice: **Slice 3: Identity continuity fixtures**.

### 2. Authority

Current state:

- Authority, mandate, charter, delegation, appointment, revocation, dispute, and archive record shapes exist.
- The resolver can return basic status for a target record.

Gaps:

- Resolver output does not yet expose a complete app-facing contract for lifecycle state, trust label, supporting authority records, active disputes/revocations/archive markers, and fixture caveat.
- Delegation scope and authority precedence are not fully tested.
- Production trust roots remain future work; for this prototype, fixture authorship is the source of truth.

Follow-up slice: **Slice 5: Authority resolver upgrade**.

### 3. Lifecycle and status

Current state:

- Lifecycle state exists for some foundation records.
- Trust labels are conceptually separate from lifecycle states.

Gaps:

- Canonical lifecycle vocabulary should include `active`, `inactive`, `superseded`, `deprecated`, `revoked`, `disputed`, `archived`, and `tombstoned`.
- Current schemas/tests do not consistently cover `deprecated` and `tombstoned`.
- Record-family workflow states such as `draft`, `published`, `withdrawn`, `cancelled`, and `resolved` need an explicit mapping rule so they do not become foundation lifecycle states by accident.
- Trust labels should not include lifecycle states or local/demo-only terms.

Follow-up slice: **Slice 2: Canonical lifecycle/status vocabulary**.

### 4. Organizational graph

Current state:

- Public org-unit and governance-relationship records exist.
- `/api/org-chart` renders grouped org-chart data.

Gaps:

- Registry health does not yet validate relationship source/target references.
- Allowed relationship kinds and source/target entity-type pairs are not enforced.
- Hierarchical cycle detection is missing.
- Cross-affiliations need to remain allowed when the relationship type is explicitly non-hierarchical.

Follow-up slice: **Slice 4: Org graph validation**.

### 5. Verification and trust labels

Current state:

- Verification assertion records and UI status display exist.
- Docs define canonical trust labels.

Gaps:

- Prototype-era terms and record-family statuses need to be kept out of trust-label semantics.
- Tests should assert that `revoked`, `disputed`, and `archived` are lifecycle/authority-resolution states, not trust labels.

Follow-up slice: **Slice 2: Canonical lifecycle/status vocabulary**.

### 6. Publication boundary

Current state:

- The publication matrix defines in-scope, app-layer, and out-of-scope data classes.
- Voting and external source-chain records have been removed from active scope.

Gaps:

- Registry health and admin fixture ingest need explicit guardrails for disallowed record families.
- Test-only rejected fixtures should cover out-of-scope voting/source-chain families without putting invalid examples into canonical fixtures.
- Ordinary public reference URLs may remain allowed; guardrails should not ban every field whose name contains `source`.

Follow-up slice: **Slice 6: Publication-boundary guardrails**.

### 7. Resolver and API contract

Current state:

- `/api/records/resolve` exposes authority context for selected records.
- Directory and app-layer public record endpoints expose normalized data.

Gaps:

- Apps still need richer resolver context to avoid recomputing authority/status/lifecycle locally.
- Public records and org units should be able to use the same resolver contract as directory entities.

Follow-up slice: **Slice 5: Authority resolver upgrade**.

### 8. UI and tests

Current state:

- Tests cover schema parsing, duplicate registry identifiers, route smoke checks, read-only demo gating, and basic resolver behavior.

Gaps:

- Tests do not yet cover lifecycle vocabulary, graph validation, identity continuity, disallowed record families, or resolver precedence.
- UI should consistently show resolver context before app-layer content where records are selected.

Follow-up slices: **Slices 2 through 6**.

## Implementation order

Use this order, adjusted after architecture review:

1. Canonical lifecycle/status vocabulary.
2. Org graph validation.
3. Identity continuity fixtures.
4. Authority resolver upgrade.
5. Publication-boundary guardrails.

Identity continuity should land before the full resolver upgrade because resolver current-projection semantics depend on stable identity, supersession, and tombstone behavior.
