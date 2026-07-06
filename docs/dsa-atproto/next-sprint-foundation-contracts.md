# Next Sprint: Foundation Contract Hardening

This sprint uses [foundation-contracts.md](foundation-contracts.md) as the planning source. The goal is to make the shared foundation layer strong enough that future apps can consume identity, authority, lifecycle, and org graph data without inventing their own base models.

## Sprint goal

Turn the foundation contract from documentation into enforceable prototype behavior: fixture coverage, validation, resolver output, and UI affordances should all reflect the same identity, authority, lifecycle, graph, status, publication, and compatibility rules.

## Non-goals

- Do not add voting, ballots, eligibility, vote metadata, or tally workflows.
- Do not reintroduce external source-chain or citation records.
- Do not expand into a publication CMS, event management system, or workflow engine.
- Do not add private member data or sensitive internal organizing data.
- Do not make the live ATProto ingestion path production-critical.

## Sprint slices

### Slice 1: Contract audit and gap map

**Why:** Before adding code, map the current implementation against the new foundation contract.

**Work:**

- Audit current schemas, fixtures, resolver output, registry-health checks, and UI panels against `foundation-contracts.md`.
- Produce a short checklist of contract clauses that are already implemented, partially implemented, or missing.
- Decide which contract terms are represented as schema fields, derived resolver fields, validation checks, or documentation-only policy.

**Acceptance criteria:**

- A contract gap checklist exists in docs or as issues.
- Each gap maps to one of: schema, fixture, resolver, UI, test, or docs.
- No gap requires voting, private data, or external source-chain records.

### Slice 2: Canonical lifecycle/status vocabulary

**Why:** Apps need one answer for current vs historical vs contested records.

**Work:**

- Normalize lifecycle states around `active`, `inactive`, `superseded`, `deprecated`, `revoked`, `disputed`, `archived`, and `tombstoned`.
- Separate lifecycle states from trust labels in code, fixtures, docs, and UI copy.
- Make fixture examples cover at least active, disputed, revoked, archived, and superseded records.
- Ensure lifecycle/status terms are documented in one canonical place and referenced elsewhere.

**Acceptance criteria:**

- Resolver output distinguishes trust label from lifecycle state.
- Tests assert that disputed/revoked/archived are not treated as trust labels.
- UI can display lifecycle state without implying official legitimacy.

### Slice 3: Identity continuity fixtures

**Why:** A base layer for many apps must handle renames, splits, merges, dissolutions, and tombstones.

**Work:**

- Add representative fixture records for identity continuity cases:
  - renamed chapter or caucus;
  - dissolved or archived unit;
  - successor relationship;
  - tombstoned identity marker.
- Define how stable identifiers, handles, display names, and record URIs behave across those cases.
- Add tests for resolver/current-projection behavior around those fixtures.

**Acceptance criteria:**

- Fixtures demonstrate identity continuity without relying on handle/display-name stability.
- Resolver or API output exposes enough context for apps to follow current and historical identities.
- Tests prevent silent identity replacement when a record should be superseded, archived, or tombstoned.

### Slice 4: Org graph validation

**Why:** The foundation layer owns the public org graph. Bad graph data will poison every app built on top.

**Work:**

- Define allowed relationship types and allowed source/target entity types.
- Add registry-health checks for unknown entity references, invalid relationship kinds, obvious cycles, and unsupported parent/child pairs.
- Preserve support for non-hierarchical cross-affiliations where explicitly modeled.
- Document jurisdiction and temporary-body expectations where they affect app behavior.

**Acceptance criteria:**

- Registry health fails on broken org graph references.
- Tests cover valid hierarchy, valid cross-affiliation, invalid parent/child pair, and invalid cycle behavior.
- Org-chart UI can continue reading the graph without local relationship rules.

### Slice 5: Authority resolver upgrade

**Why:** Apps should consume authority/status/lifecycle from the base layer instead of recomputing it locally.

**Work:**

- Extend resolver output so selected entities and public records include:
  - current lifecycle state;
  - trust label;
  - supporting authority records;
  - active disputes/revocations/archive markers;
  - fixture-source-of-truth caveat.
- Keep authority claims fixture-authored; do not add external source-chain records.
- Add tests for conflicting assertions and revocation/dispute precedence.

**Acceptance criteria:**

- Directory, org-unit, and public-record consumers can rely on one resolver contract.
- Revoked or disputed records produce visible resolver context.
- Tests cover precedence rules for active, disputed, revoked, archived, and superseded states.

### Slice 6: Publication-boundary guardrails

**Why:** The public base must not drift into private or sensitive records.

**Work:**

- Convert publication matrix expectations into registry-health or validation checks where possible.
- Add rejected fixture examples for out-of-scope record families or unsafe payload shapes.
- Ensure admin fixture ingest rejects or reports disallowed record families.
- Confirm demo read-only mode keeps publisher/admin controls disabled.

**Acceptance criteria:**

- Tests catch reintroduction of voting/local-voting/source-chain record families.
- Unsafe private-data-like fields are rejected, flagged, or documented as invalid for foundation records.
- Public demo safety docs and behavior remain aligned.

## Suggested sprint order

1. Slice 1: Contract audit and gap map.
2. Slice 2: Canonical lifecycle/status vocabulary.
3. Slice 4: Org graph validation.
4. Slice 5: Authority resolver upgrade.
5. Slice 3: Identity continuity fixtures.
6. Slice 6: Publication-boundary guardrails.

Slices 2 and 4 can run in parallel after Slice 1. Slice 5 should wait until the vocabulary is stable. Slice 6 should run throughout as a regression guard, then finish at the end.

## Sprint exit criteria

The sprint is done when:

- `foundation-contracts.md` has a matching implementation checklist or issue set;
- fixture records cover lifecycle, identity continuity, authority, dispute, revocation, archive, and org graph edge cases;
- registry health catches broken graph links and disallowed public record classes;
- resolver output is the single app-facing source for authority/status/lifecycle context;
- UI surfaces resolver context before app-layer content;
- tests prevent reintroduction of voting, private data, and external source-chain records;
- `make verify` passes.

## Issue breakdown

1. Audit implementation against foundation contracts.
2. Normalize lifecycle/status vocabulary and tests.
3. Add identity continuity fixtures and resolver coverage.
4. Add org graph relationship validation to registry health.
5. Upgrade authority resolver contract for app consumers.
6. Add publication-boundary guardrails and rejected-fixture tests.
7. Update UI panels to display lifecycle/status/authority context consistently.
8. Update docs after implementation decisions land.
