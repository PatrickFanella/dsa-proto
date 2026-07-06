# Almaz Demo Deploy

Read-only public demo deployment for the DSA ATProto prototype on Almaz.

Live demo: <https://demo.dsaslate.us>

This is repo-side deploy scaffolding only. Do not edit live Almaz Caddy, restart services, or cut DNS over without explicit approval.

## Shape

- Cloudflare proxied DNS for `demo.dsaslate.us` or another confirmed demo hostname.
- Almaz Caddy container receives Cloudflare Tunnel traffic and proxies over Docker's `projects` network:
  - `/api*`, `/health`, `/ready` → `dsa-proto-demo-api:8080`
  - everything else → `dsa-proto-demo-web:80`
- API/web also bind to `127.0.0.1` ports for local smoke checks.
- Compose runs `web`, `api`, and private `postgres`.
- Postgres has no public port binding.
- API runs in fail-closed demo mode:
  - `DEMO_READ_ONLY=true`
  - `ENABLE_ADMIN_INGEST=false`
  - `AUTO_REPLAY_FIXTURES=false`
  - `REQUIRE_POSTGRES=true`
  - CORS allowlist comes from `CORS_ORIGIN`
  - local admin routes return 404

## First-time setup

1. Pick and confirm the public hostname. The examples use `demo.dsaslate.us`.
2. Copy env file and generate a real DB password:

   ```bash
   cp deploy/almaz/.env.example deploy/almaz/.env
   $EDITOR deploy/almaz/.env
   ```

   Use a URL-safe password or percent-encode reserved URL characters because the compose file embeds it in `DATABASE_URL`.

3. Validate compose locally from the repo root without printing expanded secrets:

   ```bash
   docker compose --env-file deploy/almaz/.env -f deploy/almaz/docker-compose.yml config >/dev/null
   ```

4. Build images:

   ```bash
   docker compose --env-file deploy/almaz/.env -f deploy/almaz/docker-compose.yml build
   ```

5. Start the private stack before DNS/Caddy cutover:

   ```bash
   docker compose --env-file deploy/almaz/.env -f deploy/almaz/docker-compose.yml up -d postgres api web
   ```

6. Seed curated fixture records once:

   ```bash
   docker compose --env-file deploy/almaz/.env -f deploy/almaz/docker-compose.yml --profile seed run --rm seed
   ```

7. Local-host smoke checks on Almaz:

   ```bash
   deploy/almaz/smoke.sh deploy/almaz/.env
   ```

   Expected:
   - `/health`, `/ready`, and read-only GETs return `200`.
   - `/ready` reports a non-zero `entityCount`.
   - `/api/admin/fixtures/ingest` returns `404`.
   - web returns `200` and serves the React SPA shell. The automated web test verifies the read-only demo banner.

## Manual backup / restore / monitoring

These scripts are manual helpers only. They do not install cron jobs, change host backups, or touch the live Almaz deployment unless you run them there yourself.

- `backup.sh`: creates a timestamped Postgres dump from the compose stack and stores it locally under `deploy/almaz/backups/` by default. This path is gitignored.
- `restore.sh`: restores a chosen dump into the compose Postgres service after confirmation, with `ON_ERROR_STOP=1` and a single transaction to avoid partial restores.
- `monitor.sh`: prints a small, secret-safe health summary for the compose stack.

Usage:

```bash
deploy/almaz/backup.sh deploy/almaz/.env
deploy/almaz/restore.sh deploy/almaz/.env deploy/almaz/backups/<file>.sql.gz
deploy/almaz/monitor.sh deploy/almaz/.env
```

All scripts read the existing compose env file, avoid printing secret values, and keep work scoped to the local compose stack.

## Caddy and Cloudflare cutover

1. Add the block from `deploy/almaz/Caddyfile.almaz` to the live Almaz Caddyfile after approval.
2. Validate and reload Caddy using the standard Almaz process.
3. In Cloudflare, create a proxied record for the confirmed host pointing at the Almaz proxy target.
4. Use SSL/TLS Full (strict), not Flexible.
5. Public smoke checks:

   ```bash
   CHECK_PUBLIC_URL=true PUBLIC_BASE_URL=https://<confirmed-host> deploy/almaz/smoke.sh deploy/almaz/.env
   ```

## Rollback

- Remove or comment the demo site block from Caddy and reload.
- Remove/disable the Cloudflare DNS record.
- Stop the stack:

  ```bash
  docker compose --env-file deploy/almaz/.env -f deploy/almaz/docker-compose.yml down
  ```

- Preserve the `postgres-data` volume unless intentionally destroying demo data.
