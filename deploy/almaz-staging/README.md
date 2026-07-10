# Almaz foundation staging

This is a separate Compose project from `deploy/almaz`, which remains the read-only legacy demo. It owns distinct databases, volumes, networks, loopback-only operator ports, Caddy sites, and secrets. Public traffic follows the existing Almaz path: Cloudflare edge -> named Cloudflare Tunnel -> Almaz `cloudflared` -> `http://caddy:80` -> the isolated staging edge network. No staging container accepts direct public ingress.

## Before first start

1. In the existing named Cloudflare Tunnel, add public hostnames for `pds-staging.dsaslate.us`, `api-staging.dsaslate.us`, and `app-staging.dsaslate.us`. Each route must use service `http://caddy:80` and preserve the request host. Place these ingress rules before the tunnel's catch-all. These one-level names are covered by Universal SSL. Let Cloudflare create the tunnel CNAME records; do not create A/AAAA records exposing Almaz, and do not change `demo.dsaslate.us`.
2. Keep the zone encryption posture at Full (strict) for non-tunnel origins. These staging routes use the encrypted tunnel to Almaz and plain HTTP only on the private Docker hop from `cloudflared` to Caddy, so they do not require a new public origin certificate or host port.
3. Copy `.env.example` to untracked `.env`. Replace PDS and Tap images with reviewed digest-pinned images.
4. Run `sh deploy/almaz-staging/bootstrap-secrets.sh` once to create missing service secrets, then follow `secrets/README.md` for custody and backup. The script never replaces existing keys, sets files to `0600`, and keeps the directory at `0700`.
5. Add `Caddyfile` to the existing Caddy configuration, attach the Caddy container to `dsaslate_staging_edge`, validate the complete Caddy configuration, and reload Caddy. The staging site addresses intentionally begin with `http://` because Cloudflare already terminates public TLS before the private Caddy hop.
6. Start the stack with `docker compose --env-file deploy/almaz-staging/.env -f deploy/almaz-staging/docker-compose.yml up -d --build`.
7. Create the portable registry account on the staging PDS, preserve its `did:plc` recovery material offline, and update `PROVISIONAL_ROOT_DID`.
8. Publish `_atproto.registry.pds-staging.dsaslate.us TXT "did=<registry-root-did>"` for the registry handle, then `_lexicon.temp.dsaslate.us TXT "did=<registry-root-did>"` only after the registry account and recovery material are verified. PDS account handles under `.pds-staging.dsaslate.us` use DNS TXT resolution and do not require wildcard HTTP ingress.
9. Publish the Lexicon records and the canonical migrated dataset through the registry PDS. The operator flow is `/oauth/login?handle=registry.pds-staging.dsaslate.us&mode=registry`, followed by `make foundation-publish`; the AppView must learn these records from Tap, not direct SQL.

For Almaz's locally managed tunnel configuration, `install-tunnel-routes.py` inserts the three origin routes immediately before the existing catch-all and is idempotent. Back up the live Cloudflared configuration before running it, then restart Cloudflared and verify every pre-existing hostname remains present.

`create-registry-account.sh` creates or resumes the staging registry account and stores its password/session only under the ignored `secrets/` directory. Run it only after public PDS TLS succeeds. Its output intentionally contains only the handle and DID; the password file and PDS/PLC recovery material require a separate encrypted custody workflow.

After the real root DID is configured and the Tap worker is running, `pds-roundtrip.sh` creates a disposable root-authored organization, waits for the public AppView to resolve it as provisional, deletes it with CID concurrency, and waits for the AppView tombstone. It refreshes the registry session first and never prints tokens or passwords.

Root-only staging sets Tap's relay URL to the authoritative staging PDS so commit delivery is immediate and deterministic. Before enrolling repositories hosted by other PDSs, expand synchronization to a public relay or additional Tap feed and rerun gap/recovery acceptance.

The PDS and AppView API use explicit Cloudflare resolvers inside their containers. Almaz's primary Docker upstream resolver currently times out before the PDS's DID-resolution deadline; this per-service override preserves Docker service discovery and avoids changing host-wide DNS.

## Operations

- Run `backup.sh` daily and set `BACKUP_REMOTE` to encrypted off-host storage. `BACKUP_RECOVERY_ARCHIVE` may point to a separately encrypted recovery bundle.
- Run `restore-drill.sh` on a schedule; it verifies checksums and restores AppView Postgres into a disposable Compose project.
- Run `monitor.sh` from the host monitor. It checks API/PDS/database health, AppView sync state, Tap backlog, and backup age. Alert on any nonzero exit and separately collect 5xx, disk, DID-resolution, and audit-log metrics.
- The Cloudflare Tunnel exposes only the Caddy host routes for PDS, API/XRPC/OAuth/DID metadata, and web traffic. Loopback ports are for on-host monitoring and recovery only; Postgres and Tap worker ports remain private.

## Activation gate

This stack is provisional even when healthy. It cannot produce `official` decisions because the temporary policy URI and namespace fail the resolver activation gate. Production activation additionally requires a documented organizational decision, stable namespace, exact adopted policy URI/root DID/artifact digest, two-person root custody, tested key rotation and restore, privacy/security review, incident runbook, and named operational ownership.
