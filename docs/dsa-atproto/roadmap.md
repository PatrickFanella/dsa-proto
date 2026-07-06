# Roadmap

This roadmap has been regrouped after several productive off-plan slices. The prototype should now be understood as a **local civic data workbench** rather than only a chapter directory.

## Phase 0: Repository specialization

Status: complete.

Delivered:

- Converted inherited template language to `dsa-proto`.
- Preserved Open Pilot issue and PR templates.
- Added DSA ATProto concept docs and requirements answers.
- Added project-specific Makefile shortcuts.

## Phase 1: Local directory workbench

Status: substantially complete.

Delivered:

- Transport-neutral `RecordEnvelope` validation.
- Raw `atproto_records` storage.
- Denormalized `directory_entities` read model.
- Chapter, caucus, and opt-in member-affiliation records.
- Search, type filters, state filters, and chapter-kind filters.
- Entity authority/status detail panel.
- Local fixture replay with rejected-record reporting.
- Chapter CSV import from `docs/dsa-chapters.csv`.
- Caucus CSV import from `docs/dsa-caucuses.csv`.
- Browser and CLI local fixture authoring.

Remaining hardening:

- Better fixture caveat metadata for imported records.
- Demo reset and seed-state clarity.
- UI polish for large directories.

## Phase 2: ATProto ingestion spike

Status: prototype spike complete.

Delivered:

- Researched current ATProto TypeScript ingestion options.
- Chose `@atproto/sync` `Firehose` for first live adapter.
- Added opt-in `pnpm --dir backend run ingest:atproto` script.
- Kept live network access disabled by default.
- Kept `make verify` offline and deterministic.

Remaining hardening before production use:

- Cursor/checkpoint handling.
- Backfill strategy.
- Delete/tombstone behavior.
- Observability, retry, and alerting.
- Identity/handle resolution cache.

## Phase 3: Prototype trust and verification

Status: prototype complete, production model not complete.

Delivered:

- `org.dsa.verification.assertion` record shape.
- Mock verification/dispute/revocation/self-declared states.
- Read-time trust metadata applied to directory entities.
- Browser publisher for local verification assertions.
- UI copy that avoids implying real DSA legitimacy.

Remaining hardening:

- Formal issuer/subject policy.
- Source/citation model for assertions.
- Conflict handling when multiple issuers disagree.
- Production governance review.

## Phase 3.5: Public organization structure explorer

Status: experimental slice complete.

This was off the original plan but useful for grounding the model in public DSA structure.

Delivered:

- `org.dsa.profile.orgUnit` records for public organizational units.
- `org.dsa.relationship.governance` records for public chart relationships.
- `/api/org-chart` endpoint with `kind` and `unit` filters.
- React org-chart explorer grouped by unit kind.
- Source-linked notes for the June 2020 DSA organization chart.

Remaining hardening:

- Updated/official source review.
- Better relationship vocabulary.
- Clear distinction between chart summaries and bylaws-level governance.

## Phase 4: Fixture authority/status model

Status: recommended next lane.

Goal: make imported and derived records explicit about fixture authorship, status, and caveats.

The next sprint should harden this phase through the app-facing contracts in [foundation-contracts.md](foundation-contracts.md). See [next-sprint-foundation-contracts.md](next-sprint-foundation-contracts.md) for the concrete sprint plan.

Candidate work:

- Add fixture caveat fields where needed.
- Attach authoring caveats to CSV-imported chapter/caucus records.
- Attach authoring caveats to org-chart units and relationships.
- Display fixture caveat metadata in the directory and org-chart UI.
- Document what is official, curated, user-authored, mock, or opinion-derived.

Exit criteria:

- Every non-hand-authored dataset has a visible fixture caveat.
- UI can distinguish imported public data from mock/demo data.
- Replaying fixtures preserves authority/status caveats.

## Phase 5: Expanded civic records

Status: future.

Goal: move beyond profiles and org structure into higher-value civic information.

Candidate record types:

- Public events
- Endorsements
- Public statements
- Publications/articles
- Source-linked voter guides

Exit criteria:

- At least one non-profile civic record type is ingested and shown in context.
- Records can link back to organizations and sources.
- Safety review confirms no private organizing data is modeled.

## Phase 6: Deployable demo

Status: future.

Goal: make the prototype accessible to reviewers without local setup.

Scope:

- Deployment target selection.
- Environment variable documentation.
- Production-safe Docker config.
- Admin endpoints disabled, removed, or protected.
- Demo data reset path.
- Public-facing disclaimers.

Exit criteria:

- Public demo URL exists.
- README contains deployment and demo instructions.
- Demo data is clearly labeled as prototype/mock/curated data.
- Local-only publisher/admin paths are not exposed unsafely.
