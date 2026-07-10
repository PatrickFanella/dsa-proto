# dsa-proto

`dsa-proto` is a TypeScript AppView foundation for public organizational data on AT Protocol. It now contains real temporary Lexicons, deterministic v0 conversion, Tap-backed synchronization, policy-versioned authority resolution, XRPC plus REST v1 views, and OAuth/DPoP-backed PDS publishing.

Nothing in this repository is official DSA infrastructure yet. All `us.dsaslate.temp.*` records remain provisional, and the resolver cannot return `official` until a stable namespace and formally adopted activation configuration exist.

## Built foundation

- Canonical Lexicon JSON and generated TypeScript bindings under `backend/lexicons/` and `backend/src/lexicons/`.
- Public v1 records for organizational identity/profile/relationships, authority, transitions, DSA policy/unit classification, and events.
- Strict AT URI, DID, NSID, TID, handle, CID, raw-content, unknown-field, and privacy-boundary validation.
- Deterministic migration from disposable `org.dsa.*` fixtures; public member affiliations are dropped.
- Official `@atproto/tap` consumption with acknowledged delivery, per-repository serialization, identity/account state, quarantine, and recovery hooks.
- Versioned authority decisions that keep provenance, lifecycle, workflow, and authority separate.
- Canonical `us.dsaslate.temp.*` XRPC methods with `/api/v1/*` dashboard adapters.
- A generated, typed application client under `packages/foundation-client` with opaque-cursor helpers and structured errors.
- ATProto OAuth with DPoP, encrypted Postgres session/state storage, private review operations, and PDS-selected URI/CID writes.
- An isolated Events application for foundation-v1 staging, with public browsing plus OAuth-controlled event create/update/delete and explicit indexing progress; the legacy fixture dashboard remains a separate mode.
- Isolated local and Almaz staging topology under `deploy/local` and `deploy/almaz-staging`; the existing `deploy/almaz` read-only demo is unchanged.

## Verification

Node 24 and pnpm 10.33.0 are required.

```bash
make verify
```

The offline gate regenerates Lexicon bindings, checks schema compatibility and clean diffs, then runs typechecks, lint, tests, builds, Compose validation, and Open Pilot template checks. `make verify-integration` is the separate networked PDS/Tap stack.

## Interfaces

Canonical XRPC queries and procedures live at `/xrpc/us.dsaslate.temp.*`. Dashboard adapters include:

- `/api/v1/entities`
- `/api/v1/entities/:id`
- `/api/v1/org-graph`
- `/api/v1/records/resolve`
- `/api/v1/activity`
- `/api/v1/sync/status`
- `/api/v1/session`
- `/api/v1/review/operations`
- `/api/v1/self/records`

Legacy unversioned fixture routes remain only for `demo.dsaslate.us` compatibility and have no v1 guarantee. Admin fixture ingest and the legacy bearer-token gateway are disabled by default; no enabled bearer credential ships in source.

See [docs/dsa-atproto/README.md](docs/dsa-atproto/README.md), [the v1 read contract](docs/reference/foundation-read-contract-v1.md), [the write operations reference](docs/reference/write-operations.md), and [the Almaz staging runbook](deploy/almaz-staging/README.md).

## License

GPL-3.0-only. See `LICENSE`.
