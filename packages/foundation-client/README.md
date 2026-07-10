# Foundation client

`@dsaslate/foundation-client` is the reusable application-facing client for the temporary DSA Slate AppView. Its response and input types are generated from the canonical Lexicons in `backend/lexicons`; applications should not duplicate those contracts or reinterpret authority from record fields.

```ts
import { FoundationClient } from '@dsaslate/foundation-client';

const client = new FoundationClient('https://api-staging.dsaslate.us');
const entities = await client.listAllEntities({ unitKind: 'chapter' });
const events = await client.listAllActivity();
```

The `listAll*` helpers follow opaque cursors with loop and page-limit protection. Public reads use canonical XRPC methods. Authenticated procedures use the same-origin OAuth BFF session and return `FoundationClientError` with the AppView error code, request ID, and retryability.

Consumers must display provenance, authority, lifecycle, and workflow status separately. In particular, they must never convert an authority result into a client-selected `official` flag.
