# Foundation Contracts and Invariants

This document defines the contract that every app should build against when it consumes the DSA AT Protocol foundation layer.

The foundation layer is the shared public base for identity, authority, verification/status, organizational relationships, and approved public records. Apps may add workflows and views on top, but they should not redefine identity, authority, lifecycle, or publication rules for themselves.

## Non-goals

The foundation layer is not:

- a voting system;
- a private member database;
- an external source archive or citation graph;
- a general workflow engine;
- a publication CMS;
- the primary home for sensitive internal organizing data.

For this prototype, the maintained fixture set is the source of truth. The fixtures model the canonical public record layer we want apps to consume. They may be informed by real-world public knowledge, but the prototype does not publish external source-chain records.

## 1. Identity contract

Every public entity in the base layer should have a durable identity that survives ordinary display changes.

### Entity types

The base layer may describe public identities for:

- national bodies;
- chapters;
- caucuses and member formations;
- committees, commissions, working groups, and staff roles;
- publications and campaign identities;
- opt-in public member profiles;
- app-layer public records such as events, endorsements, statements, publications, and resource pointers.

### Canonical identity fields

Each entity should expose enough information for apps to answer:

- What is the entity's stable identifier?
- What DID currently controls it?
- What handle currently represents it?
- What public name should apps display?
- What type of entity is it?
- Is it current, renamed, merged, split, dissolved, archived, or disputed?

### Identity invariants

- A handle is not the identity. Handles may change.
- A display name is not the identity. Names may change.
- A DID or stable record URI should anchor continuity wherever possible.
- Renames should preserve continuity with the prior identity.
- Merges, splits, and dissolutions should be explicit lifecycle events, not silent edits.
- Tombstones should remain discoverable when an identity is revoked, archived, dissolved, or superseded.

## 2. Authority contract

Apps should not infer institutional authority from popularity, recency, or self-description alone. The base layer must say who is allowed to assert what.

### Authority questions

For every important public claim, consuming apps should be able to ask:

- Who asserted this?
- What authority did they have to assert it?
- Is the assertion current?
- Has it been revoked, disputed, superseded, or archived?
- Which trust label should apps use when displaying it?

### Authority roots

The prototype should treat the fixture set as the current source of truth for authority. A production version should define explicit trust roots, such as national infrastructure, chapter-controlled infrastructure, caucus-controlled infrastructure, or approved delegated publishers.

### Delegation invariants

- Authority can be delegated, but delegation must be explicit.
- Delegation should have a scope: entity type, record family, jurisdiction, time range, or app domain.
- Revocation should override delegated authority from the revocation point forward.
- Disputes should be visible to consumers rather than hidden behind a single “valid” answer.
- App-layer publishers may publish approved public records, but they do not automatically become foundation-layer authorities.

## 3. Lifecycle contract

Every app needs the same answer to “what is current?” The base layer should distinguish immutable history from the current projection.

### Lifecycle states

Use these lifecycle meanings consistently:

| State | Meaning | App behavior |
| --- | --- | --- |
| `active` | Current public record or entity. | Show normally. |
| `inactive` | Not currently active, but not necessarily invalid. | Show with status context. |
| `superseded` | Replaced by a newer record. | Prefer the newer record, keep history. |
| `deprecated` | Still visible, but no longer recommended for new use. | Avoid for new app behavior. |
| `revoked` | Authority has withdrawn or invalidated the record. | Do not treat as current. |
| `disputed` | A recognized party challenges accuracy or authority. | Show warning/context. |
| `archived` | Preserved as historical record. | Keep discoverable, not current. |
| `tombstoned` | Identity or record intentionally removed from active use while preserving a marker. | Do not reuse silently. |

### Lifecycle invariants

- Current projections should be derivable from immutable records.
- Historical records should remain inspectable unless a safety/privacy rule requires removal from public views.
- Revocation, dispute, archive, and supersession should be records or first-class status fields, not only UI copy.
- Apps should consume lifecycle state from the base layer rather than inventing their own current/historical rules.

## 4. Organizational graph contract

The foundation layer owns the public organizational graph. Apps should consume this graph instead of rebuilding chapter/caucus/committee relationships locally.

### Relationship types

The base layer should support public relationships such as:

- chapter recognized by national;
- caucus recognized by chapter or national body;
- committee, commission, or working group created by a body;
- publication associated with a body;
- campaign associated with a body;
- public role or mandate held by an entity;
- archive, revocation, dispute, or succession relationship.

### Graph invariants

- Parent/child relationships should use known entity types.
- Cycles should be either invalid or explicitly modeled as non-hierarchical relationships.
- Cross-affiliations are allowed only when the relationship type supports them.
- Temporary bodies need an explicit term, mandate, or archive path.
- Dissolved or archived units should remain linked to successors or historical parents where known.
- Jurisdiction should be explicit when it changes app behavior.

## 5. Verification and status contract

Trust labels tell apps how to display and rely on public records. They are not generic vibes; each label needs a stable meaning.

### Trust labels

Use these labels consistently:

| Label | Meaning |
| --- | --- |
| `official` | Published or controlled by the relevant official authority. |
| `verified-by-national` | Verified by national-level authority. |
| `verified-by-chapter` | Verified by a chapter-level authority. |
| `verified-by-caucus` | Verified by a caucus-level authority. |
| `self-declared` | Published by the subject or claimant without higher verification. |
| `community-submitted` | Submitted by a community source and not yet institutionally verified. |
| `secondary-source` | Derived from public secondary information, not direct authority. |
| `uncertain` | Insufficient authority or confidence for stronger treatment. |

### Status invariants

- Trust labels describe confidence/authority, not lifecycle.
- Lifecycle states such as `revoked`, `disputed`, and `archived` should not be encoded as trust labels.
- Apps should display weaker labels differently from official or verified records.
- No app should upgrade a trust label on its own without publishing or receiving a foundation-layer authority/status assertion.

## 6. Publication and privacy contract

The base layer is public infrastructure. Publication rules should be strict by default.

### Publication invariants

- Public organizational identity and relationship records are in scope.
- Optional public member affiliation must be opt-in, minimal, and never treated as proof of dues status or private membership.
- Private member data, contact details, dues/payment status, grievance/casework material, private deliberation, sensitive logistics, and high-risk organizing details are out of scope.
- Voting systems, ballots, credentials, receipts, tallies, eligibility, voter rosters, and vote metadata are out of scope.
- External source records and source-chain proof records are out of scope for this prototype.
- Apps may publish approved public records outward, but their private workflow state stays outside the shared public protocol layer.

### Redaction rule

If a record cannot be safely public, minimized, and understood by unrelated indexers, it does not belong in the foundation layer.

## 7. Correction and dispute contract

The base layer should not pretend public data is neutral or magically correct. It needs an explicit path for challenge and correction.

### Correction flow

At minimum, apps should expect records to be:

1. published;
2. challenged or flagged;
3. corrected, superseded, disputed, revoked, or archived;
4. preserved with enough history for consumers to understand what changed.

### Dispute invariants

- Disputed records should remain visible with context unless safety requires removal from public views.
- Corrections should supersede records rather than silently mutate public meaning.
- Revocations should identify the revoking authority and effective point in time.
- Apps should surface contested status when it materially affects user interpretation.

## 8. Compatibility contract

Apps need stable schemas and predictable change rules.

### Compatibility invariants

- Required fields should not be removed without a versioned migration path.
- New optional fields should be safe for older consumers to ignore.
- Enum values should be documented before apps rely on them.
- Deprecated fields should remain readable until consumers have a migration path.
- Fixture migrations should be documented when they change identity, authority, lifecycle, or publication semantics.
- Breaking schema changes should update docs and tests in the same change.

## 9. Consumer contract for apps

Apps built on the base layer should follow these rules:

- consume canonical identities from the base layer;
- consume org relationships from the base layer;
- consume authority/status/lifecycle from the resolver or shared API;
- avoid creating local-only identity or authority models unless they are explicitly app-private;
- keep private workflow state out of public records;
- publish only approved public record families outward;
- preserve record URIs and stable identifiers when linking between apps;
- display caveats for fixture/demo data, weaker trust labels, disputes, revocations, and archived records.

## 10. Prototype acceptance criteria

The prototype base is strong enough for app experiments when:

- fixtures cover representative identity changes, disputes, revocations, archives, and relationships;
- the resolver returns current projection plus lifecycle/status context;
- docs define trust labels and lifecycle states in one place;
- tests catch invalid graph links, unsafe publication classes, and removed/out-of-scope record families;
- app demos can build directories, public record views, and dashboards without redefining identity, org graph, or authority rules.
