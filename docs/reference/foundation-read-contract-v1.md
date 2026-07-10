# Foundation read contract v1

Status: experimental temporary namespace, stable within `us.dsaslate.temp.*` compatibility rules.

## Canonical XRPC

- `us.dsaslate.temp.listEntities`
- `us.dsaslate.temp.getEntity`
- `us.dsaslate.temp.getOrgGraph`
- `us.dsaslate.temp.resolveAuthority`
- `us.dsaslate.temp.listActivity`
- `us.dsaslate.temp.getSyncStatus`
- `us.dsaslate.temp.submitForReview`
- `us.dsaslate.temp.getReviewOperation`

The generated Lexicon bindings are the field-level source of truth.

## REST adapter

- `GET /api/v1/entities`
- `GET /api/v1/entities/:id`
- `GET /api/v1/org-graph`
- `GET /api/v1/records/resolve`
- `GET /api/v1/activity`
- `GET /api/v1/sync/status`
- `GET|POST /api/v1/review/operations`

REST returns `contractVersion: "v1"`, `data`, and an optional opaque `cursor`. List limits default to 50 and cap at 100.

## Core views

`Provenance` describes source record URI/CID, repo DID/revision, stream sequence, observation time, and validation/sync status. `AuthorityDecision` describes the independently computed policy decision. `EntityView` combines entity URI, optional current profile/DSA unit, provenance, authority, and lifecycle.

Consumers must not collapse authority, provenance, lifecycle, or workflow into one enum. `official` is impossible for the temporary namespace.

The supported TypeScript consumer is `@dsaslate/foundation-client`. Its generated Lexicon types are the application boundary, and its `listAllEntities` and `listAllActivity` helpers consume opaque cursors without exposing their contents. An `EntityView` may include `profileProvenance`, `profileAuthority`, `dsaUnitProvenance`, and `dsaUnitAuthority` describing the records selected for those projections.

Projection selection requires an exact entity strong reference (`uri` and `cid`). Eligible profiles and DSA classifications are ranked by computed authority, then validated provenance and authenticated observation order; revisions are compared only within the same repository.

Legacy `/api/*` fixture responses are not part of this contract.
