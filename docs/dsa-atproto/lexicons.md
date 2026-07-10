# Temporary Lexicons

Canonical JSON lives under `backend/lexicons/`; `backend/src/lexicons/` is generated and must not be hand-edited. The namespace is experimental and disposable: `us.dsaslate.temp.*`.

## Records

- `us.dsaslate.temp.orgEntity`
- `us.dsaslate.temp.orgProfile`
- `us.dsaslate.temp.orgRelationship`
- `us.dsaslate.temp.authorityDelegation`
- `us.dsaslate.temp.authorityAttestation`
- `us.dsaslate.temp.authorityAction`
- `us.dsaslate.temp.identityTransition`
- `us.dsaslate.temp.dsaUnit`
- `us.dsaslate.temp.dsaPolicy`
- `us.dsaslate.temp.publicEvent`

Authority targets use `com.atproto.repo.strongRef`. Organizational relationships use stable AT URIs where following the current entity is intended. Generic organizational records do not hardcode DSA unit categories; `dsaUnit` and `dsaPolicy` provide that policy layer.

## Permission sets

- `authSelfPublish`: controller profile and public-event creates/updates/deletes.
- `authReviewSubmit`: AppView review submission/status RPCs with inherited audience.
- `authRegistryPublish`: restricted provisional root publication for all temporary foundation collections.
- `authManageDelegations`: lets an organization controller manage delegation records in its own repository; AppView still requires an exact parent strong reference and a non-expanding chain to the root.

## Generation and evolution

```bash
make lexicons
make lexicons-check
```

The verification gate regenerates bindings, fails on a dirty diff, and compares existing schemas with the merge-base version. Existing required fields, types, formats, refs, keys, and definitions cannot be removed or repurposed; new fields must be optional.

The DNS authority record for this group is `_lexicon.temp.dsaslate.us TXT "did=<registry-root-did>"`. Each schema is published from that DID as a `com.atproto.lexicon.schema` record whose rkey equals the NSID. DNS and live publication are operator actions and have not been performed by repository changes.

Deferred families—`publicStatement`, `publication`, `publicationArticle`, and `publicEndorsement`—should be introduced one family at a time after staging stability. `org.dsa.affiliation.member` is never migrated.
