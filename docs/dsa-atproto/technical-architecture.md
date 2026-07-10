# Technical architecture

```text
controller PDSes ──> relay ──> Tap (verification/backfill/acks)
                                      │
                                      ▼
                            AppView sync worker
                                      │ atomic record + cursor
                                      ▼
                                  Postgres
                                      │
                         shared application handlers
                            ┌─────────┴─────────┐
                            ▼                   ▼
                      XRPC contract       REST /api/v1
                                                │
                                                ▼
                                         React dashboard
```

The portable registry/root account is a `did:plc`; the AppView service identity is `did:web:api-staging.dsaslate.us`. DNS controls the experimental Lexicon namespace. A separate DSA policy record controls organizational meaning, and neither fact alone constitutes official adoption.

## Integrity and storage

`foundation_record_versions` retains immutable content, raw canonical CBOR, decoded unknown fields, repo revision, stream sequence, action, validation state, disposition, and observation time. `foundation_current_records` is selected by authenticated repo revision rather than client timestamps. Repo state and the processed cursor are persisted in the same transaction used by Tap handlers before acknowledgement.

Tap performs CAR backfill, repository/MST/signature verification, per-repository ordering, and automatic resynchronization. The AppView additionally checks the DID's authoritative PDS, collection/type/URI equality, monotonic revisions, enrolled-repository policy, and provisional authority.

## OAuth and writes

The Node OAuth client implements PKCE/DPoP and requests the published permission sets. OAuth state, DPoP JWK material, and sessions are encrypted in Postgres. The browser receives only an opaque, HttpOnly, SameSite app-session cookie.

- `orgProfile` and `publicEvent` content is sent to the controller PDS; the PDS chooses the commit, revision, URI, and CID.
- Moderated claims enter `review_operations_v1`; rejected content and moderation notes stay private.
- Registry migration uses a distinct registry-publish permission and root session, then arrives in the AppView through Tap.
- The legacy token gateway has no source credential and no default in-memory production operation store.

## Deployment

`deploy/local` runs a separate PDS/Tap/AppView/web/Postgres integration topology. `deploy/almaz-staging` is isolated from `deploy/almaz` by Compose project, volumes, networks, secrets, loopback ports, and Caddy hosts. Only PDS, API/XRPC/OAuth/DID metadata, and web endpoints are public.

`make verify` is offline and deterministic. `make verify-integration` is networked and requires container images; browser OAuth/account-consent acceptance remains an explicit staging step.
