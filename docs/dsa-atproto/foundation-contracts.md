# Foundation contracts

## Identity and provenance

- AT URI authority equals repository DID.
- AT URI collection equals both the indexed collection and record `$type`.
- URI, DID, NSID, rkey, handle, TID revision, and CID syntax is validated.
- Raw canonical CBOR and decoded unknown fields are preserved together.
- Current state follows authenticated repository revision, never client `indexedAt`.
- Historical `asOf` excludes later observations.

## Authority

Every decision contains policy URI/version, root DID, strong-reference chain, reasons, and evaluation time. Resolver depth defaults to 16, is capped at 32, and detects cycles. Temporary namespace/policy data cannot resolve as official.

## API

Lexicon JSON defines the canonical XRPC contract. REST v1 calls the same service handlers and is parity-tested. List methods use opaque cursors with a 50 default and 100 maximum. Error responses include stable error name, message, request ID, and retryability.

## Publication and privacy

Clients submit record content, never an envelope/trust status. The PDS returns URI, CID, commit, and revision. Public validation rejects person/membership/contact/payment/grievance/ballot/private-logistics field names while preserving unrelated future extension fields.

## Operations

Admin fixture ingest defaults off in every environment. Requests have a 1 MiB ceiling, 15-second timeout, rate limits, structured request IDs, and body/secret-free logs. Node 24 and pnpm 10.33.0 are pinned in CI.
