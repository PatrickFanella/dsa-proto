# Production Demo Safety Guards

Status: implemented safety guard summary for the live Almaz demo. This remains a demo deployment, not a production civic registry.

This document maps the current prototype routes and workflows to safe deployment controls. The public deployment disables local fixture publishing and any local-only admin tooling.

Live deployment target: <https://demo.dsaslate.us> on Almaz.

## Goal

Ship a read-only public demo without exposing local mutation tools or fixture import helpers.

## Demo mode rule

Production mode should fail closed.

Suggested environment variables:

```text
NODE_ENV=production
ENABLE_LOCAL_ADMIN=false
ENABLE_FIXTURE_REPLAY=false
ENABLE_LIVE_ATPROTO_INGESTION=false
ALLOW_MEMORY_REPOSITORY=false
```

Rules:

- If `NODE_ENV=production`, local admin must be disabled unless an explicit safe demo exception exists.
- If Postgres is unavailable, the backend must not fall back to in-memory data.
- The demo must not auto-seed or auto-replay fixtures on startup.
- Public UI should show read-only demo copy when mutation routes are disabled.
- Local admin routes should return 404 in the demo host.
- Postgres stays private on the Docker network; no public DB port.
- CORS must use an allowlist.
- Demo startup must require Postgres.
- No auto replay on boot.

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
| `GET /api/registry/health` | fixture registry summary | enabled or restricted | no private data; verify file-path leakage is safe |
| `POST /api/admin/fixtures/ingest` | local fixture publisher | disabled | 404 |

## UI guard matrix

| UI area | Production default | Required behavior |
| --- | --- | --- |
| Directory and authority/status | enabled | visible as public read-only demo |
| Registry health panel | enabled with caution | no local file paths if public copy matters |
| Chapter publisher | hidden/disabled | show only in local workbench mode |
| Verification publisher | hidden/disabled | show only in local workbench mode |
| Civic activity/public records | enabled | read-only |

## Backend implementation checklist

Implemented in the Almaz demo stack:

- [x] Config parser fields exist for local admin, fixture replay, memory fallback, and live ingestion.
- [x] Local admin defaults to disabled in the Almaz demo.
- [x] `POST /api/admin/fixtures/ingest` is gated off in demo mode.
- [x] Tests prove demo mode blocks these routes.
- [x] Demo mode still supports local development when enabled there.
- [x] In-memory fallback is not used in the demo deployment.
- [x] Auto-seeding/replay is off in the demo deployment.
- [x] CORS uses an allowlist.
- [x] Readiness checks Postgres connectivity and migration/version state.
- [x] Request logging avoids mutation bodies.

## Frontend implementation checklist

Implemented in the Almaz demo stack:

- [x] Build-time/runtime config supports workbench mode vs read-only demo mode.
- [x] Local publisher panels stay hidden unless local admin is enabled.
- [x] Read-only public demo banner is shown in demo mode.
- [x] Tests cover hidden publisher panels in demo mode.

## Deployment checklist

Implemented for Almaz demo:

- [x] Separate Postgres for the demo stack.
- [x] No Compose database port exposed publicly.
- [x] Migrations run before app startup.
- [x] No automatic fixture replay on boot.
- [x] Readiness endpoint is available for the deploy platform.
- [x] Health endpoint is separate from readiness.
- [ ] Backups enabled and restore tested.
- [x] TLS at edge.
- [x] CORS allowlist configured.
- [x] Structured logs avoid mutation payloads.
- [ ] Alerts for DB unavailable, 5xx spike, failed readiness, backup stale, audit/log write failure.

Status note: the checklist is not a hand-checked audit artifact. Checked items reflect implemented controls in the repo; unchecked items are still pending or require operational validation outside the repo.

## Smoke tests for safe demo mode

Use these as manual or automated smoke tests:

```bash
# Reads work
curl -fsS "$BASE_URL/api/entities" >/dev/null
curl -fsS "$BASE_URL/api/activity" >/dev/null

# Local mutation routes are blocked
curl -i -X POST "$BASE_URL/api/admin/fixtures/ingest" | grep -E "403|404"
```
