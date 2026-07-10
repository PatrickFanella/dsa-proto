# Current state

The repository now has two deliberately separate surfaces:

1. `demo.dsaslate.us`: the existing read-only fixture demo and unversioned compatibility routes.
2. The new `us.dsaslate.temp.*` foundation: real Lexicons, a PDS publication path, Tap synchronization, AppView projections, authority evaluation, OAuth writes, and isolated staging configuration.

## Implemented

- Twenty-two canonical Lexicon schemas: ten public record types, eight XRPC methods, three permission sets, and shared definitions, generated with `@atproto/lex`.
- Eight canonical XRPC methods and matching `/api/v1` adapters with opaque cursors (50 default, 100 maximum).
- A generated `@dsaslate/foundation-client` consumer package that follows opaque pagination and preserves authority/provenance types.
- Immutable record versions, raw DAG-CBOR bytes, current state, repo/identity state, candidate disposition, authority cache tables, encrypted OAuth state, and private review audit tables.
- Strict envelope validation and regression coverage preventing client/database trust labels from becoming `official`.
- A deterministic converter from legacy chapters, caucuses, org units, relationships, authority/lifecycle records, transitions, and events. Member affiliations and deferred app families are dropped.
- A registry publisher that sends only content/rkeys to the root PDS and verifies the PDS-returned URI/CID; the AppView no longer loads migrated staging records directly into its foundation tables.
- Tap acknowledged WebSocket processing. The worker enrolls the root and root-delegated repositories, serializes each repository, persists before acknowledgement, ignores non-authoritative PDS updates, and keeps unenrolled records in candidate/quarantine disposition.
- Authority precedence for invalid/desynchronized provenance, revocation, dispute, expiry, official/provisional root chains, non-root attestation, self-assertion, and unresolved data.
- OAuth BFF state/session storage encrypted with AES-256-GCM, confidential-client signing keys, DPoP-bound grants, HttpOnly app sessions, self-authored PDS writes, and private review submissions.
- Local and Almaz staging Compose/Caddy/runbook scaffolding, backup/checksum/restore-drill scripts, and provisional UI mode.
- A separate Events app surface for v1 staging, with public browsing, OAuth session visibility, controller-owned event create/update/delete, CID conflict protection, explicit PDS-versus-AppView progress, and no legacy fixture fallback.

## Still requires external execution or organizational authority

- Almaz runs the isolated staging PDS, root-only Tap feed, AppView API/worker, web client, and Postgres behind loopback/private networks. The one-level service names are live through Caddy and Cloudflare Tunnel; direct origin exposure remains disabled.
- The portable staging registry is `did:plc:4f5y7qroik2vqzuur5fhv236`, hosted by `https://pds-staging.dsaslate.us` with handle `registry.pds-staging.dsaslate.us`. It remains provisional.
- The registry-handle and namespace-authority TXT records resolve publicly. All 23 `us.dsaslate.temp.*` Lexicons are published from the registry repository, and OAuth initiation redirects to the staging PDS for registry, self-publication, and delegation-management scopes.
- Authority resolution and repository enrollment support constrained root -> chapter/unit -> organizer chains with exact parent strong references, depth/cycle checks, validity and revocation handling, and entity/collection/action subset enforcement.
- Registry OAuth consent is complete. The canonical migration published 762 current records through the PDS: 252 entities, profiles, and DSA unit classifications plus policy, authority, and transition records. Tap/AppView cursor 773 is current with no backlog or desynchronized repositories.
- Public PDS -> Tap -> AppView create/update/delete/tombstone acceptance through OAuth, concurrent first-boot migrations, API/indexer restart persistence, backup checksums, isolated restore, and monitoring passed on 2026-07-10. Of 252 migrated entities, 251 resolve `provisional` and one preserves its migrated root-issued `disputed` state; `official` remains impossible.
- An encrypted off-host backup destination, scheduled timers, alert delivery, and Almaz disk-capacity remediation still need activation.
- Obtain formal organizational adoption, choose the stable namespace, publish stable v1 schemas and migration manifests, and configure the exact adoption digest/root/policy gate.

Until those actions occur, this is production-oriented implementation and deployment scaffolding, not an activated official service.

## Public boundary

Public v1 contains non-person organizational and deliberately public civic records only. Person identity, membership, interest, contact, dues/payment, grievance, ballot/election, and private logistics data are rejected and remain in separate systems.
