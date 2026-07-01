# ATProto Ingestion Adapter Spike

This spike identifies the smallest real ATProto ingestion path that could feed the same internal record envelope used by the mocked ingestion path.

It is intentionally not wired into local startup. Local development and tests should continue to use deterministic mocked records.

## Current recommendation

Use a two-adapter boundary:

```text
Fixture replay adapter ─┐
                       ├─ emits MockRecordEnvelope-compatible records
Live ATProto adapter ──┘
                               ↓
                         existing validation
                               ↓
                         existing ingestion/upsert
                               ↓
                         Postgres read model
```

Milestone 1 should keep the fixture replay adapter as the default. A Phase 2 spike can add the live adapter behind an explicit script or worker command.

## TypeScript options

### 1. `@atproto/sync` `Firehose`

Best fit for a realistic first live-network spike.

- Consumes repo events from `com.atproto.sync.subscribeRepos` over WebSocket.
- Matches the ATProto sync layer more directly than app-specific feed streams.
- Can be shaped into the same envelope already used by this prototype.

References:

- ATProto sync specification: <https://atproto.com/specs/sync>
- Bluesky/ATProto `@atproto/sync` package: <https://github.com/bluesky-social/atproto/tree/main/packages/sync>

### 2. `@atproto/tap`

Useful if the project wants a higher-level indexing pipeline later.

- Provides ingestion/indexer-oriented helpers around repo and identity events.
- May be better for backfill plus live indexing once the prototype grows beyond a small spike.

Reference:

- Bluesky/ATProto `@atproto/tap` package: <https://github.com/bluesky-social/atproto/tree/main/packages/tap>

### 3. Jetstream

Useful for quick JSON event experiments, but not the preferred canonical path for this prototype.

- Easier to consume than raw repo sync.
- Less directly aligned with repo-accurate ingestion semantics.

Reference:

- Jetstream announcement/docs: <https://docs.bsky.app/blog/jetstream>

## Adapter interface

The live adapter should emit the same internal envelope shape that `mockRecordEnvelopeSchema` validates today:

```ts
type IngestibleRecordEnvelope = {
  uri: string;
  cid: string;
  did: string;
  handle: string;
  collection: 'org.dsa.profile.chapter' | 'org.dsa.profile.caucus' | 'org.dsa.affiliation.member';
  indexedAt: string;
  trustLabel: 'mock-official' | 'self-declared' | 'unverified' | 'experimental';
  record: Record<string, unknown>;
};

type RecordEnvelopeSink = (record: IngestibleRecordEnvelope) => Promise<void>;
```

The existing backend can then validate the envelope with `mockRecordEnvelopeSchema` and pass it to `ingestMockRecords`. The method name can be renamed later once both mock and live transports share the same path.

## `@atproto/sync` pseudocode

This is intentionally pseudocode, not production code.

```ts
import { Firehose } from '@atproto/sync';
import { IdResolver } from '@atproto/identity';

const DSA_COLLECTIONS = new Set([
  'org.dsa.profile.chapter',
  'org.dsa.profile.caucus',
  'org.dsa.affiliation.member',
]);

export function createAtprotoFirehoseAdapter(sink: RecordEnvelopeSink) {
  const idResolver = new IdResolver();

  return new Firehose({
    idResolver,
    service: 'wss://bsky.network',
    async handleEvt(event) {
      if (event.event !== 'create' && event.event !== 'update') return;
      if (!DSA_COLLECTIONS.has(event.collection)) return;

      const handle = await resolveHandleOrFallback(idResolver, event.did);

      await sink({
        uri: `at://${event.did}/${event.collection}/${event.rkey}`,
        cid: String(event.cid),
        did: event.did,
        handle,
        collection: event.collection,
        indexedAt: new Date().toISOString(),
        trustLabel: 'unverified',
        record: event.record,
      });
    },
  });
}
```

Notes:

- The exact event object shape should be confirmed against the installed `@atproto/sync` version during implementation.
- If collection filtering supports exact collection names only, keep the explicit `Set` above instead of relying on wildcard filtering.
- `trustLabel` must default to `unverified` for live self-published records unless a separate verification record is implemented.

## Fixture replay adapter

The fixture adapter should remain the default local development path:

```ts
export async function replayFixtureRecords(records: unknown[], sink: RecordEnvelopeSink) {
  for (const record of records) {
    await sink(mockRecordEnvelopeSchema.parse(record));
  }
}
```

This preserves deterministic tests and avoids requiring live network access for `make verify`.

## Setup requirements for a future live spike

- Add dependencies only in the spike branch or follow-up implementation issue:
  - `@atproto/sync`
  - `@atproto/identity`
  - optionally `@atproto/syntax` for AT URI helpers
- Add an explicit worker/script entrypoint such as `pnpm --dir backend run ingest:atproto`.
- Keep live ingestion disabled by default in `docker compose`.
- Keep mock fixture ingestion as the default bootstrap path.
- Use environment variables for relay URL and any future operational settings.

Possible environment variables:

```text
ATPROTO_RELAY_URL=wss://bsky.network
ATPROTO_COLLECTIONS=org.dsa.profile.chapter,org.dsa.profile.caucus,org.dsa.affiliation.member
ATPROTO_LIVE_INGESTION=false
```

## Operational and production-readiness risks

- **Identity resolution:** raw repo events may not include a handle. The app needs identity resolution and caching, or it must store DID-first records with best-effort handles.
- **Idempotency:** firehose events can replay. Ingestion must keep using upserts keyed by AT URI.
- **Deletes and tombstones:** deletes will not include a record payload. A production adapter needs deletion handling for `atproto_records` and `directory_entities`.
- **Ordering:** relay delivery order should not be treated as exactly-once or globally ordered.
- **Backfill:** a live subscriber alone may miss historical records. Backfill needs a separate repository sync/import path.
- **Moderation:** public records can be false, malicious, or impersonating. The UI must keep trust labels explicit and avoid implying DSA verification.
- **Namespace squatting:** `org.dsa.*` records published by arbitrary DIDs are not inherently legitimate.
- **Schema evolution:** live records may use older or future shapes. Validation failures should be observable and non-fatal.
- **Operational load:** production ingestion needs logging, retry/backoff, metrics, cursor handling, and alerting.
- **Safety:** live ingestion must not encourage private rosters, dues/payment status, internal votes, casework, discipline, private deliberation, or high-risk logistics.

## Follow-up implementation slice

A future issue should implement only the fixture/live adapter boundary first:

1. Rename `ingestMockRecords` to a transport-neutral name such as `ingestRecordEnvelopes`.
2. Add an offline fixture replay adapter and tests.
3. Add a live `@atproto/sync` adapter behind an opt-in script.
4. Verify the live adapter can emit one valid envelope into the same existing ingestion path.
5. Keep `make verify` offline and deterministic.
