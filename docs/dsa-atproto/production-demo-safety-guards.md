# Production Demo Safety Guards

Status: guardrail plan for safely deploying the public civic workbench while production voting planning continues.

This document maps the current prototype routes and workflows to safe deployment controls. It is intentionally broader than voting: the same public deployment must also disable local fixture publishing and any local-only admin tooling.

## Goal

Ship a read-only public demo without exposing local mutation tools, fake voting endpoints, fixture import helpers, or private-voting-looking flows.

## Production mode rule

Production mode should fail closed.

Suggested environment variables:

```text
NODE_ENV=production
ENABLE_LOCAL_ADMIN=false
ENABLE_LOCAL_VOTING=false
ENABLE_FIXTURE_REPLAY=false
ENABLE_LIVE_ATPROTO_INGESTION=false
ALLOW_MEMORY_REPOSITORY=false
```

Rules:

- If `NODE_ENV=production`, local admin and local voting must be disabled unless an explicit safe demo exception exists.
- If Postgres is unavailable in production, the backend should not fall back to in-memory data.
- Production should not auto-seed or auto-replay fixtures on startup.
- Public UI should show read-only demo copy when mutation routes are disabled.

## Route guard matrix

| Surface | Current purpose | Production default | Required behavior |
| --- | --- | --- | --- |
| `GET /api/entities` | public directory read | enabled | read-only |
| `GET /api/entities/:id` | public entity detail | enabled | read-only |
| `GET /api/chapters` | public chapter read | enabled | read-only |
| `GET /api/org-chart` | public org chart | enabled | read-only |
| `GET /api/statements` | public statements | enabled | read-only |
| `GET /api/publications` | public publications | enabled | read-only |
| `GET /api/articles` | public articles | enabled | read-only |
| `GET /api/endorsements` | public endorsements | enabled | read-only |
| `GET /api/events` | public events | enabled | read-only |
| `GET /api/activity` | public civic activity | enabled | read-only |
| `GET /api/votes/elections` | public voting metadata | enabled with caveats | metadata only; no ballot endpoints implied |
| `GET /api/votes/proposals` | public voting metadata | enabled with caveats | metadata only |
| `GET /api/votes/choices` | public voting metadata | enabled with caveats | metadata only |
| `GET /api/registry/health` | fixture registry summary | enabled or restricted | no private data; verify file-path leakage is safe |
| `POST /api/admin/fixtures/ingest` | local fixture publisher | disabled | 404 or 403 with clear disabled message |
| `GET /api/local-voting/status` | local fake voting UX | disabled | 404 or 403; never exposed as production voting |
| `POST /api/local-voting/credentials` | local fake credential issuance | disabled | 404 or 403 |
| `POST /api/local-voting/ballots` | local fake ballot submit | disabled | 404 or 403 |

## UI guard matrix

| UI area | Production default | Required behavior |
| --- | --- | --- |
| Directory and provenance | enabled | visible as public read-only demo |
| Registry health panel | enabled with caution | no local file paths if public copy matters |
| Chapter publisher | hidden/disabled | show only in local workbench mode |
| Verification publisher | hidden/disabled | show only in local workbench mode |
| Local voting prototype panel | hidden/disabled | never shown in production public demo |
| Public voting registry | enabled with caveats | must say election/proposal/choice metadata only |
| Civic activity/public records | enabled | read-only |

## Backend implementation checklist

Before public deployment:

- [ ] Add config parser fields for local admin, local voting, fixture replay, memory fallback, and live ingestion.
- [ ] Default local admin and local voting to disabled when `NODE_ENV=production`.
- [ ] Gate `POST /api/admin/fixtures/ingest` behind `ENABLE_LOCAL_ADMIN=true`.
- [ ] Gate `/api/local-voting/*` behind `ENABLE_LOCAL_VOTING=true`.
- [ ] Add tests proving production mode blocks these routes.
- [ ] Add tests proving local development can still enable them.
- [ ] Remove or disable in-memory fallback in production.
- [ ] Stop auto-seeding/replay in production.
- [ ] Replace permissive CORS with configured allowed origins in production.
- [ ] Add readiness endpoint that checks Postgres connectivity and migration/version state.
- [ ] Ensure request logging does not record request bodies for mutation routes.

## Frontend implementation checklist

Before public deployment:

- [ ] Add build-time/runtime config for workbench mode vs read-only demo mode.
- [ ] Hide local publisher panels unless local admin is enabled.
- [ ] Hide local voting panel unless local voting is enabled.
- [ ] Show read-only public demo banner in production mode.
- [ ] Keep public voting registry caveat visible: no ballots or production voting implemented in this app.
- [ ] Add tests for hidden publisher/voting panels in production mode.

## Deployment checklist

Minimum public demo deployment requirements:

- [ ] Separate production Postgres.
- [ ] No Compose local dev database exposed publicly.
- [ ] Explicit migrations run before app startup.
- [ ] No automatic fixture replay on boot.
- [ ] Readiness endpoint used by deploy platform.
- [ ] Health endpoint separate from readiness.
- [ ] Backups enabled and restore tested.
- [ ] TLS at edge.
- [ ] CORS allowlist configured.
- [ ] Structured logs without private voting artifacts.
- [ ] Alerts for DB unavailable, 5xx spike, failed readiness, backup stale, audit/log write failure.

## Production voting guardrails

These guardrails are mandatory even after Plan 4 work begins:

- The public civic app must not become the private ballot service.
- Public ATProto records may expose election metadata and certified aggregate results only after privacy review.
- Private voting service APIs must live behind separate auth, network, DB, logging, and audit controls.
- Local `/api/local-voting/*` must never be renamed or repurposed as production voting.
- Any production ballot endpoint must be built from the Plan 4 private architecture, not by extending the local prototype service.

## Smoke tests for safe demo mode

Use these as manual or automated smoke tests:

```bash
# Reads work
curl -fsS "$BASE_URL/api/entities" >/dev/null
curl -fsS "$BASE_URL/api/activity" >/dev/null
curl -fsS "$BASE_URL/api/votes/elections" >/dev/null

# Local mutation/voting routes are blocked
curl -i -X POST "$BASE_URL/api/admin/fixtures/ingest" | grep -E "403|404"
curl -i "$BASE_URL/api/local-voting/status?voter=member-alpha" | grep -E "403|404"
curl -i -X POST "$BASE_URL/api/local-voting/credentials" | grep -E "403|404"
curl -i -X POST "$BASE_URL/api/local-voting/ballots" | grep -E "403|404"
```

## Relationship to production voting backlog

This is Issue 2 in `production-voting-implementation-backlog.md` and should be done before any public deployment, even if binding production voting is still far away.
