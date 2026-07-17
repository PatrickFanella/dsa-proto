# Foundation client

`@dsaslate/foundation-client` is the reusable application-facing client for the temporary DSA Slate AppView. Its response and input types are generated from the canonical Lexicons in `backend/lexicons`; applications should not duplicate those contracts or reinterpret authority from record fields.

The package is ESM-only and supports browsers plus Node.js 20+. It relies on the
documented Fetch, Web Crypto, and `btoa` platform APIs; it does not provide a
CommonJS build. Published tarballs intentionally include generated `dist/`
files plus standard package metadata, this README, and the license; `dist/` is
built deterministically by `prepack`.

The GPL-3.0-only corresponding source is maintained in the public
[`dsa-proto` repository](https://git.subcult.tv/patrickfanella/dsa-proto/src/branch/main/packages/foundation-client).
Each published version must reference its immutable release commit or tag.

```ts
import { FoundationClient } from '@dsaslate/foundation-client';

const client = new FoundationClient('https://api-staging.dsaslate.us');
const entities = await client.listAllEntities({ unitKind: 'chapter' });
const events = await client.listAllActivity();
```

The `listAll*` helpers follow opaque cursors with loop and page-limit protection. Public reads use canonical XRPC methods. Authenticated procedures use the same-origin OAuth BFF session and return `FoundationClientError` with the AppView error code, request ID, and retryability.

## Identity handoff

Preserve the `beginIdentityHandoff` result only for the active browser flow, then redirect the browser. On the callback, the consumer must compare the returned `state` exactly before exchanging the callback `code` with the original verifier and audience:

```ts
const handoff = await client.beginIdentityHandoff({ handle, audience, returnUri });
window.location.assign(handoff.authorizationUrl);

// On the configured callback route, retrieve `handoff` from active flow memory.
const callback = new URL(window.location.href);
if (callback.searchParams.get('state') !== handoff.state) throw new Error('state mismatch');
const identity = await client.exchangeIdentityHandoff({
  code: callback.searchParams.get('code') ?? '', verifier: handoff.verifier, audience,
});
```

State correlation is the consumer's responsibility. Do not log or persist the code, verifier, state, or returned credentials beyond this flow.

Consumers must display provenance, authority, lifecycle, and workflow status separately. In particular, they must never convert an authority result into a client-selected `official` flag.
