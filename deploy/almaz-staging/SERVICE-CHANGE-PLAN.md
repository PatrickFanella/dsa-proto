---
title: "DSA Slate foundation staging service change plan"
created: "2026-07-09"
updated: "2026-07-10"
status: staging-live-foundation-published
host: almaz
type: plan
---

# DSA Slate foundation staging service change plan

## Goal

Deploy the provisional AT Protocol PDS, Tap, AppView, Postgres, and Events client without changing the existing read-only demo or exposing Almaz directly.

## Proposed placement

- Host: `almaz`
- Compose root: an isolated checkout deployed as the `dsa-slate-foundation-staging` Compose project
- Docker networks: `dsaslate_staging_edge` plus an internal-only staging private network
- Host ports: loopback-only API, PDS, and web ports for monitoring and recovery
- Public routes: `pds-staging.dsaslate.us`, `api-staging.dsaslate.us`, and `app-staging.dsaslate.us` through the existing named Cloudflare Tunnel to `http://caddy:80`

## State and dependencies

- Persistent volumes: PDS repositories/account state, Tap cursor state, and AppView Postgres
- Databases: dedicated AppView Postgres; PDS and Tap maintain their own isolated state
- Secrets: untracked `deploy/almaz-staging/secrets/` files with restrictive permissions
- Callers: Cloudflare Tunnel -> existing Caddy -> PDS/API/web; Tap -> PDS/relay; Tap worker -> Tap/Postgres

## Safety plan

- Backup before change: no pre-existing staging state; begin automated encrypted off-host backups immediately after account creation
- Rollback: remove the three tunnel hostname routes, remove the staging Caddy blocks, detach Caddy from the staging edge network, and stop the isolated Compose project while preserving volumes
- Network impact: no A/AAAA origin exposure and no new public host bindings; existing tunnel and Caddy remain the ingress boundary
- Storage impact: dedicated Docker volumes only; no media, MergerFS, or SnapRAID changes
- Monitoring: readiness, 5xx, sync lag/cursor age, desynchronized repositories, DID failures, disk, audit failures, and backup age

## Execution steps

1. Verify live Almaz health, Docker networks, Caddy configuration, tunnel configuration path, capacity, and backup destination.
2. Install the isolated stack and secrets, attach Caddy to `dsaslate_staging_edge`, validate configuration, then start services without public hostname routes.
3. Verify loopback and internal-origin health, add tunnel routes, ask the DNS owner to publish identity/Lexicon TXT records, and perform public OAuth/PDS/Tap/AppView acceptance.

## Verification

- Container health: all staging containers running with Postgres healthy and no restart loops
- Local origin: on-host readiness, PDS health, sync status, and Caddy Host-header probes
- Public route: external HTTPS checks for PDS, API DID metadata, OAuth metadata, and Events web client
- GPU: not applicable
- Backup/docs: checksum-verified backup plus isolated restore drill and updated Almaz service inventory

## Approval

- Approved by: repository owner in the active task
- Approval timestamp: 2026-07-09 (conversation approval; official organizational activation remains a separate gate)

## Deployment checkpoint

Verified on Almaz through 2026-07-10:

- PDS, Tap, AppView API, web, and Postgres are healthy with reviewed PDS/Tap image digests.
- Caddy is attached to `dsaslate_staging_edge`; staging Caddy routes validate and pass Host-header origin probes.
- Cloudflared contains the three one-level staging ingress rules before its catch-all and restarted healthy.
- A checksum-verified backup, isolated AppView restore drill, and monitoring run passed.
- Public one-level CNAME records, edge TLS, OAuth metadata, and service routes are live.
- The registry account is `did:plc:4f5y7qroik2vqzuur5fhv236`; the real root is configured and the Tap worker is running.
- Registry-handle and Lexicon TXT records resolve publicly, all 23 canonical temporary Lexicons are published from the registry repository, and OAuth initiation redirects correctly for registry, self-publication, and delegation-management scopes.
- Registry OAuth consent and canonical migration publication are complete. The current projection contains 762 provisional records, root enrollment remains one repository, cursor 773 is monotonic, and Tap backlog is zero.
- An OAuth create/update/delete/tombstone round trip, concurrent migration startup, restart persistence, backup, restore, and monitor checks pass. Of 252 entities, 251 are `provisional`, one is intentionally `disputed`, and none are `official`.
- Off-host backup scheduling, alert delivery, and host disk-capacity remediation remain. Almaz measured 93% filesystem use on 2026-07-10; shared Docker build cache is a major reclaimable category and must be handled under the host-wide maintenance scope.
