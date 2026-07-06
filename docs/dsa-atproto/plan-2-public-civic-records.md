# Plan 2: Public Civic Records Layer

## Purpose

Plan 1 built the local registry/workbench foundation: canonical chapter and caucus records, fixture import/replay, registry health, authority/status display, prototype verification, local publishing, org-chart exploration, and an opt-in ATProto ingestion spike.

Plan 2 moves from **who exists** to **what public civic information is published**.

The goal is to model public statements, endorsements, events, and publications as ATProto-shaped records that connect back to chapters, caucuses, publications, candidates, campaigns, and org units.

## Guiding principles

- Public-only records.
- No private member data.
- Link records back to canonical registry entities where possible.
- Keep fixture replay and registry health deterministic.
- Prefer one narrow civic record type at a time.
- Keep production claims modest: local prototype first, real ATProto later.

## Candidate record families

### 1. Public statements

Recommended first slice.

Candidate collection:

```text
org.dsa.statement.public
```

Fields:

- `title`
- `summary`
- `body` or `bodyMarkdown`
- `issuerUri`
- `issuerName`
- `publishedAt`
- `topics`
- `relatedEntityUris`
- `status: published | archived | draft`

Why first:

- Low risk.
- Clearly public.
- Useful for chapters, caucuses, committees, and publications.
- Exercises non-profile records without election/calendar complexity.

### 2. Public endorsements

Candidate collection:

```text
org.dsa.endorsement.public
```

Fields:

- `endorsingEntityUri`
- `candidateOrMeasureName`
- `officeOrMeasure`
- `jurisdiction`
- `electionDate`
- `status: active | withdrawn | archived`
- `statementUri` or `sourceUrl`

Status: implemented in the local prototype as a narrow endorsement slice.

### 3. Public events

Candidate collection:

```text
org.dsa.event.public
```

Fields:

- `title`
- `hostEntityUri`
- `startsAt`
- `endsAt`
- `mode: in-person | online | hybrid`
- `publicUrl`
- `locationLabel`
- `status: scheduled | cancelled | archived`

Status: implemented in the local prototype as a narrow public-event slice.

Avoid precise sensitive logistics unless explicitly public.

### 4. Publications and articles

Candidate collections:

```text
org.dsa.publication.profile
org.dsa.publication.article
```

Fields:

- publication identity
- article title
- public URL
- author/display byline
- published date
- tags/topics
- related entity URIs

This can connect Democratic Left, Socialist Forum, caucus publications, and chapter blogs.

Status: implemented in the local prototype as a narrow publication profile/article slice.

### 5. Related-record graph

Once at least one civic record family exists, entity details should show related records:

- chapter → statements
- caucus → publications/statements
- publication → articles
- endorsement → statement/source
- event → host chapter/caucus

Status: implemented in the local prototype as a unified related civic activity timeline.

## Plan 2 first slice: public statements

Status: implemented in the local prototype.

### Goal

Add public statement records end-to-end: schema, fixture examples, ingestion, API, UI list/detail, related entity links, tests, and docs.

### Scope

- Add `org.dsa.statement.public` schema to the record envelope union.
- Seed a few safe public prototype statements.
- Keep statements out of `directory_entities`.
- Add a statement read projection/API:

  ```http
  GET /api/statements
  GET /api/statements/:id
  ```

- Show a statements section in the UI.
- Link statements to issuer/related directory entities by AT URI.
- Display authority/status and prototype caveats.
- Add tests for schema validation, API response, and UI rendering.

### Acceptance criteria

- `make verify` passes.
- At least three public statement fixtures are visible in the UI.
- Statements identify issuer name and issuer URI.
- Statement detail shows raw/protocol metadata.
- Directory entity detail can show related statements, or the statements UI links back to entities.
- No private/internal organizing data is modeled.

### Non-goals

- Rich editorial CMS.
- Full-text search over statement body.
- Real ATProto publishing.
- Moderation workflow.
- Private member-only statements.

## Follow-up slices

1. Public statements end-to-end. ✅
2. Related-record panel on entity detail pages. ✅
3. Public publications/articles. ✅
4. Public endorsements. ✅
5. Public events. ✅
6. Safe deploy/demo mode with local admin disabled.
