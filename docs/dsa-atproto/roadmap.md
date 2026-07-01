# Roadmap

## Phase 0: Repository specialization

Status: in progress / mostly complete.

Goals:

- Convert inherited template language to `dsa-proto`.
- Preserve Open Pilot issue and PR templates.
- Add requirements interview answers.
- Add prototype planning docs.

Exit criteria:

- Project README describes `dsa-proto`.
- DSA ATProto docs are linked.
- `make verify` passes.

## Phase 1: Local mocked-record prototype

Goal: prove the core loop locally with mocked ATProto-shaped records and a Postgres read model.

Scope:

- SQL schema for raw records and normalized directory entities.
- Zod schemas for chapter, caucus, and opt-in member affiliation records.
- Mock record fixtures.
- Ingestion/upsert service.
- REST endpoints for list/detail/search.
- Basic public directory UI.
- Docker Compose run path.

Out of scope:

- Live firehose ingestion.
- Real PDS publishing.
- Production verification service.
- Authenticated admin dashboard.

Exit criteria:

- A user can run the app locally with Docker Compose.
- Seeded records appear in the UI.
- Entity detail view shows ATProto metadata.
- `make verify` passes.

## Phase 2: Real ATProto ingestion spike

Goal: test whether real ATProto transport can feed the same validation and read-model path.

Scope:

- Investigate current ATProto TypeScript libraries and firehose/relay APIs.
- Build a small subscriber or importer for `org.dsa.*`-shaped records.
- Keep mocked ingestion as a deterministic local fallback.
- Document operational and moderation implications.

Exit criteria:

- One spike can ingest or simulate real transport through the same ingestion boundary.
- Architecture doc identifies what must change for production ingestion.
- Risks and dependencies are documented.

## Phase 3: Trust and verification model

Goal: make legitimacy explicit without hardcoding political assumptions into app logic.

Scope:

- Model `org.dsa.verification.assertion` records.
- Add trust labels to the read model.
- Display verification/dispute status in the UI.
- Document governance assumptions.

Exit criteria:

- The app can distinguish self-declared, mock-official, disputed, revoked, and archived states.
- Verification claims point to issuer identities.
- UI copy avoids implying unearned official status.

## Phase 4: Expanded civic records

Goal: move beyond profiles into higher-value civic information.

Candidate record types:

- Public events
- Endorsements
- Public statements
- Publications/articles
- Source citations

Exit criteria:

- At least one non-profile record type is ingested and shown in context.
- Records can link back to organizations and sources.
- Safety review confirms no private organizing data is modeled.

## Phase 5: Deployable demo

Goal: make the prototype accessible to reviewers without local setup.

Scope:

- Deployment target selection.
- Environment variable documentation.
- Production-safe Docker config.
- Admin endpoints disabled or protected.
- Seed/demo data reset path.

Exit criteria:

- Public demo URL exists.
- README contains deployment and demo instructions.
- Demo data is clearly labeled as prototype/mock data.
