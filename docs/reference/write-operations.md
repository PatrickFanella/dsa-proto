# Write operations reference

ATProto OAuth with PKCE and DPoP replaces source-controlled app bearer tokens.

- `authSelfPublish` grants controller PDS writes for `orgProfile` and `publicEvent` only.
- `GET /api/v1/session` reports whether OAuth is enabled, the signed-in DID when present, and the actions and collections available to the browser session.
- `POST /api/v1/self/records` accepts record content only for creates; the PDS selects URI, CID, commit, and revision.
- `authReviewSubmit` grants review submission/status RPCs to the AppView audience.
- `submitForReview` creates encrypted-at-rest, private operations and append-only audit events.
- Authorized registry publication is separate and uses `authRegistryPublish` plus the exact root DID.
- Chapter and unit delegation administration uses `authManageDelegations`; OAuth permission to write a delegation never substitutes for AppView validation of its parent chain and scope.
- Rejected payloads and moderation notes remain private and must be retention-limited operationally.

## Self-authored record operations

The endpoint accepts one explicit operation at a time:

```json
{ "action": "create", "collection": "us.dsaslate.temp.publicEvent", "record": { "...": "content" } }
```

```json
{ "action": "update", "uri": "at://did:plc:controller/us.dsaslate.temp.publicEvent/rkey", "expectedCid": "bafy...", "record": { "...": "content" } }
```

```json
{ "action": "delete", "uri": "at://did:plc:controller/us.dsaslate.temp.publicEvent/rkey", "expectedCid": "bafy..." }
```

The authenticated DID must own an update or delete URI. Updates and deletes require the CID last observed by the client and pass it to the PDS as `swapRecord`; a concurrent change returns HTTP `409` with `record_conflict`. Client-selected URI, CID, trust status, indexed timestamp, or repository envelope fields are rejected.

The response contains the PDS-confirmed `uri`, `cid` for create/update, and operation action. A successful response means the repository commit succeeded; it does not mean the AppView has indexed it yet. The generated client’s `waitForObservation` helper polls canonical authority resolution until the new CID—or a deletion tombstone—is observed. Interfaces should represent those as separate publishing and awaiting-index states.

Browser mutations enforce the configured application origin when an `Origin` header is present. Session cookies are HttpOnly, and OAuth/DPoP material remains server-side and encrypted at rest.

The legacy `/api/write/*` preview remains disabled by default for the preserved demo. It has no built-in registry credential and requires an explicitly injected operation store, so it cannot become an accidental production path.
