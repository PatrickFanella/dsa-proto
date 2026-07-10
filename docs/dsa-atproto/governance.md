# Governance and activation

Authority, provenance, workflow status, and lifecycle are separate values. A client, fixture, handle, URL, database row, or record envelope cannot assert `official`.

## Resolver order

1. Invalid or desynchronized provenance is unresolved.
2. Active root revocation wins.
3. Active root dispute wins over ordinary attestations.
4. Expired authority yields `expired`.
5. A complete chain to a formally activated stable root yields `official`.
6. A complete chain to the staging root yields `provisional`.
7. A recognized non-root claim yields `attested`.
8. A controller-authored profile/event without higher authority is `selfAsserted`.
9. Everything else is `unresolved`.

Temporary policy records can never satisfy step 5. The code requires activation enabled, a non-temporary stable namespace, a non-temporary adopted policy URI, and an adoption artifact digest. Missing any input keeps the result provisional.

## Federation and review

The root DID is enrolled by configuration. Additional repositories enter the primary view only through a current root-derived delegation chain. A non-root delegation must point to its exact parent URI/CID, be authored by the parent delegate, stay within the parent's entity/collection/action scope, carry the `delegate` action in the parent grant, and remain inside validity and revocation bounds. Other valid records remain private candidate/quarantine data. Moderated claims require a private review decision and an authorized registry publisher; moderation notes are not public ATProto records.

## Custody and organizational gate

Official activation additionally requires a documented organizational decision naming the root controller, custodians, scope, incident authority, and stable namespace; two-person recovery custody; offline recovery material; tested rotation and restore; privacy/security review; schema-evolution and incident runbooks; and named operations ownership.

`dsaslate.us` DNS control proves temporary schema authority. It does not prove DSA organizational adoption. If the organization delegates a different domain, stable NSIDs must use that domain rather than silently renaming temporary records.
