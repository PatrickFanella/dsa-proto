import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { chapterSeedRecords, caucusSeedRecords, memberAffiliationSeedRecords, verificationAssertionSeedRecords, publicStatementSeedRecords, publicationSeedRecords, endorsementSeedRecords, publicEventSeedRecords, orgChartSeedRecords, governanceRelationshipSeedRecords, lifecycleStatusSchema, recordEnvelopeSchema, trustLabelSchema, identityContinuitySeedRecords, projectCurrentIdentity, type RecordEnvelope } from './domain.js';
import { createApp, createMemoryRepository, getConfig } from './server.js';
import { replayFixtureRecords } from './fixture-replay.js';
import { loadFixtureFile } from './fixture-files.js';
import { InMemoryWriteOperationStore } from './write-operations.js';

describe('getConfig', () => {
  it('parses a port from env', () => {
    expect(getConfig({ PORT: '9090' }).PORT).toBe(9090);
  });
});

describe('record validation', () => {
  it('keeps lifecycle and trust label vocabularies separate', () => {
    expect(lifecycleStatusSchema.options).toEqual(expect.arrayContaining(['deprecated', 'tombstoned']));
    expect(trustLabelSchema.options).toEqual(expect.arrayContaining(['official', 'uncertain']));
    expect(trustLabelSchema.options).not.toEqual(expect.arrayContaining(['revoked', 'disputed', 'archived']));
  });

  it('accepts core fixture records', () => {
    expect(recordEnvelopeSchema.parse(chapterSeedRecords[0]).collection).toBe('org.dsa.profile.chapter');
    expect(recordEnvelopeSchema.parse(caucusSeedRecords[0]).collection).toBe('org.dsa.profile.caucus');
    expect(recordEnvelopeSchema.parse(memberAffiliationSeedRecords[0]).collection).toBe('org.dsa.affiliation.member');
    expect(recordEnvelopeSchema.parse(verificationAssertionSeedRecords[0]).collection).toBe('org.dsa.verification.assertion');
    expect(recordEnvelopeSchema.parse(publicStatementSeedRecords[0]).collection).toBe('org.dsa.statement.public');
    expect(recordEnvelopeSchema.parse(publicationSeedRecords[0]).collection).toBe('org.dsa.publication.profile');
    expect(recordEnvelopeSchema.parse(endorsementSeedRecords[0]).collection).toBe('org.dsa.endorsement.public');
    expect(recordEnvelopeSchema.parse(publicEventSeedRecords[0]).collection).toBe('org.dsa.event.public');
    expect(recordEnvelopeSchema.parse(orgChartSeedRecords[0]).collection).toBe('org.dsa.profile.orgUnit');
    expect(recordEnvelopeSchema.parse(governanceRelationshipSeedRecords[0]).collection).toBe('org.dsa.relationship.governance');
    expect(recordEnvelopeSchema.parse(identityContinuitySeedRecords[0]).collection).toBe('org.dsa.identity.continuity');
  });

  it('accepts authority records without source URIs', () => {
    expect(recordEnvelopeSchema.parse({
      uri: 'at://did:plc:npc/org.dsa.authority.delegation/public-records-2026',
      cid: 'bafy-mock-authority-delegation',
      did: 'did:plc:npc',
      handle: 'dsausa.org',
      collection: 'org.dsa.authority.delegation',
      indexedAt: '2026-07-01T00:00:00.000Z',
      trustLabel: 'official',
      record: {
        $type: 'org.dsa.authority.delegation',
        subjectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self',
        delegatedToUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
        scope: 'chapter-public-records',
        authority: 'publish and verify public chapter records',
        effectiveFrom: '2026-07-01T00:00:00.000Z',
        effectiveUntil: '2027-07-01T00:00:00.000Z',
        status: 'active',
      },
    })).toMatchObject({ collection: 'org.dsa.authority.delegation' });
  });

  it('projects identity continuity without replacing the stable identity', () => {
    const rename = projectCurrentIdentity(identityContinuitySeedRecords, 'caucus:climate-justice');
    const superseded = projectCurrentIdentity(identityContinuitySeedRecords, 'org-unit:metro-dsa');
    const tombstoned = projectCurrentIdentity(identityContinuitySeedRecords, 'org-unit:metro-dsa-east');

    expect(rename).toMatchObject({ stableId: 'caucus:climate-justice', displayName: 'DSA Climate Caucus', handle: 'climate.dsausa.org', status: 'active' });
    expect(rename?.recordUri).toBe('at://did:plc:climatecaucus/org.dsa.identity.continuity/rename-marker');
    expect(superseded).toMatchObject({ stableId: 'org-unit:metro-dsa', displayName: 'Metro DSA', handle: 'metrodsa.example', status: 'superseded', successorUri: 'at://did:plc:metrodsa-east/org.dsa.profile.orgUnit/self' });
    expect(tombstoned).toMatchObject({ stableId: 'org-unit:metro-dsa-east', displayName: 'Metro DSA East', handle: 'metrodsa-east.example', status: 'tombstoned', archivedByUri: 'at://did:plc:metrodsa/org.dsa.profile.orgUnit/self' });
    expect(rename?.subjectUri).not.toBe(rename?.recordUri);
  });
});

describe('API responses', () => {
  let server: ReturnType<typeof createApp> | undefined;
  afterEach(() => server?.close());

  it('serves core read routes in demo mode', async () => {
    server = createApp(createMemoryRepository(), { DEMO_READ_ONLY: true });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    expect((await fetch(`http://127.0.0.1:${address.port}/api/entities`)).status).toBe(200);
    expect((await fetch(`http://127.0.0.1:${address.port}/api/activity`)).status).toBe(200);
  });

  it('loads the canonical fixture dataset file and exposes ready metadata', async () => {
    const fixture = await loadFixtureFile(fileURLToPath(new URL('../fixtures/records.json', import.meta.url)));
    server = createApp(createMemoryRepository(fixture.records as Parameters<typeof createMemoryRepository>[0], fixture.metadata), { DEMO_READ_ONLY: true });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const ready = await fetch(`http://127.0.0.1:${address.port}/ready`).then((res) => res.json() as Promise<{ status: string; dataset: { dataset: string; schema: string } }>);
    const entity = await fetch(`http://127.0.0.1:${address.port}/api/entities`).then((res) => res.json() as Promise<{ data: unknown[] }>);

    expect(ready.status).toBe('ready');
    expect(ready.dataset).toMatchObject({ dataset: 'canonical-fixture', schema: 'records.v1' });
    expect(entity.data.length).toBeGreaterThan(0);
  });

  it('keeps admin fixture ingest disabled in read-only demo mode', async () => {
    server = createApp(createMemoryRepository(), { DEMO_READ_ONLY: true });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/fixtures/ingest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ records: [] }) });
    expect(response.status).toBe(404);
  });

  it('fails closed for the write gateway in demo/read-only mode', async () => {
    server = createApp(createMemoryRepository(), { DEMO_READ_ONLY: true, ENABLE_WRITE_GATEWAY: true });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, { method: 'POST' });
    expect(response.status).toBe(404);
  });

  it('requires app token when the write gateway is enabled', async () => {
    server = createApp(createMemoryRepository(), { ENABLE_WRITE_GATEWAY: true, writeOperationStore: new InMemoryWriteOperationStore() });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, { method: 'POST' });
    expect(response.status).toBe(401);
  });

  it('creates a dry-run operation without mutating public event reads', async () => {
    const repository = createMemoryRepository();
    const store = new InMemoryWriteOperationStore();
    const before = await repository.listEvents();
    server = createApp(repository, { ENABLE_WRITE_GATEWAY: true, writeOperationStore: store });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const body = {
      dryRun: true,
      record: {
        uri: 'at://did:plc:demo/org.dsa.event.public/dry-run-1',
        cid: 'bafy-dry-run-1',
        did: 'did:plc:demo',
        handle: 'demo.example',
        collection: 'org.dsa.event.public',
        indexedAt: '2026-07-01T00:00:00.000Z',
        trustLabel: 'community-submitted',
        record: {
          $type: 'org.dsa.event.public',
          title: 'Dry Run Event',
          hostEntityUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
          hostEntityName: 'NYC DSA',
          startsAt: '2026-07-10T18:00:00.000Z',
          mode: 'online',
          status: 'scheduled',
          topics: [],
          relatedEntityUris: [],
        },
      },
    };
    const response = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer demo-staging-event-token',
        'idempotency-key': 'idem-1',
        'if-none-match': '*',
      },
      body: JSON.stringify(body),
    });
    const json = await response.json() as { data: { operationId: string; status: string } };
    const after = await repository.listEvents();

    expect(response.status).toBe(200);
    expect(json.data.status).toBe('dry_run');
    expect(after).toHaveLength(before.length);
    expect(store.getOperation(json.data.operationId)?.status).toBe('dry_run');
  });

  it('rejects non-dry-run writes when publish is disabled', async () => {
    server = createApp(createMemoryRepository(), { ENABLE_WRITE_GATEWAY: true, ENABLE_WRITE_PUBLISH: false, writeOperationStore: new InMemoryWriteOperationStore() });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer demo-staging-event-token', 'idempotency-key': 'idem-publish-disabled' },
      body: JSON.stringify({ record: { uri: 'at://did:plc:demo/org.dsa.event.public/publish-disabled', cid: 'bafy-publish-disabled', did: 'did:plc:demo', handle: 'demo.example', collection: 'org.dsa.event.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'community-submitted', record: { $type: 'org.dsa.event.public', title: 'Publish Disabled', hostEntityUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', hostEntityName: 'NYC DSA', startsAt: '2026-07-10T18:00:00.000Z', mode: 'online', status: 'scheduled', topics: [], relatedEntityUris: [] } } }),
    });

    expect(response.status).toBe(422);
  });

  it('creates pending review operations without mutating public event projections', async () => {
    const repository = createMemoryRepository();
    const before = await repository.listEvents();
    const store = new InMemoryWriteOperationStore();
    server = createApp(repository, { ENABLE_WRITE_GATEWAY: true, ENABLE_WRITE_PUBLISH: true, writeOperationStore: store });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer demo-staging-event-token', 'idempotency-key': 'idem-pending-review', 'if-none-match': '*' },
      body: JSON.stringify({ record: { uri: 'at://did:plc:demo/org.dsa.event.public/pending-review', cid: 'bafy-pending-review', did: 'did:plc:demo', handle: 'demo.example', collection: 'org.dsa.event.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'community-submitted', record: { $type: 'org.dsa.event.public', title: 'Pending Review', hostEntityUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', hostEntityName: 'NYC DSA', startsAt: '2026-07-10T18:00:00.000Z', mode: 'online', status: 'scheduled', topics: [], relatedEntityUris: [] } } }),
    });
    const json = await response.json() as { data: { status: string } };
    const after = await repository.listEvents();

    expect(response.status).toBe(200);
    expect(json.data.status).toBe('pending_review');
    expect(after).toHaveLength(before.length);
  });

  it('returns the same operation for the same idempotency key and request', async () => {
    server = createApp(createMemoryRepository(), { ENABLE_WRITE_GATEWAY: true, writeOperationStore: new InMemoryWriteOperationStore() });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const body = { dryRun: true, record: { uri: 'at://did:plc:demo/org.dsa.event.public/idem-same', cid: 'bafy-idem-same', did: 'did:plc:demo', handle: 'demo.example', collection: 'org.dsa.event.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'community-submitted', record: { $type: 'org.dsa.event.public', title: 'Same', hostEntityUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', hostEntityName: 'NYC DSA', startsAt: '2026-07-10T18:00:00.000Z', mode: 'online', status: 'scheduled', topics: [], relatedEntityUris: [] } } };
    const headers = { 'content-type': 'application/json', authorization: 'Bearer demo-staging-event-token', 'idempotency-key': 'idem-same', 'if-none-match': '*' };
    const first = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, { method: 'POST', headers, body: JSON.stringify(body) }).then((res) => res.json() as Promise<{ data: { operationId: string } }>);
    const second = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, { method: 'POST', headers, body: JSON.stringify(body) }).then((res) => res.json() as Promise<{ data: { operationId: string } }>);

    expect(second.data.operationId).toBe(first.data.operationId);
  });

  it('conflicts when the same idempotency key is reused with a different request', async () => {
    server = createApp(createMemoryRepository(), { ENABLE_WRITE_GATEWAY: true, writeOperationStore: new InMemoryWriteOperationStore() });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const headers = { 'content-type': 'application/json', authorization: 'Bearer demo-staging-event-token', 'idempotency-key': 'idem-conflict', 'if-none-match': '*' };
    const firstBody = { dryRun: true, record: { uri: 'at://did:plc:demo/org.dsa.event.public/idem-1', cid: 'bafy-idem-1', did: 'did:plc:demo', handle: 'demo.example', collection: 'org.dsa.event.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'community-submitted', record: { $type: 'org.dsa.event.public', title: 'One', hostEntityUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', hostEntityName: 'NYC DSA', startsAt: '2026-07-10T18:00:00.000Z', mode: 'online', status: 'scheduled', topics: [], relatedEntityUris: [] } } };
    const secondBody = JSON.parse(JSON.stringify(firstBody)) as typeof firstBody;
    secondBody.record.cid = 'bafy-idem-2';
    secondBody.record.record.title = 'Two';
    const first = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, { method: 'POST', headers, body: JSON.stringify(firstBody) });
    const second = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, { method: 'POST', headers, body: JSON.stringify(secondBody) });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
  });

  it('conflicts when creating over an existing URI', async () => {
    const repository = createMemoryRepository();
    const existing = {
      uri: 'at://did:plc:demo/org.dsa.event.public/existing',
      cid: 'bafy-existing-event',
      did: 'did:plc:demo',
      handle: 'demo.example',
      collection: 'org.dsa.event.public',
      indexedAt: '2026-07-01T00:00:00.000Z',
      trustLabel: 'community-submitted',
      record: {
        $type: 'org.dsa.event.public',
        title: 'Existing Event',
        hostEntityUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
        hostEntityName: 'NYC DSA',
        startsAt: '2026-07-10T18:00:00.000Z',
        mode: 'online',
        status: 'scheduled',
        topics: [],
        relatedEntityUris: [],
      },
    } satisfies RecordEnvelope;
    await repository.ingestRecordEnvelopes([existing]);
    server = createApp(repository, { ENABLE_WRITE_GATEWAY: true, writeOperationStore: new InMemoryWriteOperationStore() });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer demo-staging-event-token', 'idempotency-key': 'idem-existing', 'if-none-match': '*' },
      body: JSON.stringify({ dryRun: true, record: existing }),
    });

    expect(response.status).toBe(409);
  });

  it('keeps the first writable family limited to public events', async () => {
    const store = new InMemoryWriteOperationStore();
    server = createApp(createMemoryRepository(), { ENABLE_WRITE_GATEWAY: true, ENABLE_WRITE_PUBLISH: true, writeOperationStore: store });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer demo-staging-event-token', 'idempotency-key': 'idem-statement-blocked', 'if-none-match': '*' },
      body: JSON.stringify({
        record: {
          uri: 'at://did:plc:demo/org.dsa.statement.public/not-first-family',
          cid: 'bafy-statement-blocked',
          did: 'did:plc:demo',
          handle: 'demo.example',
          collection: 'org.dsa.statement.public',
          indexedAt: '2026-07-01T00:00:00.000Z',
          trustLabel: 'community-submitted',
          record: { $type: 'org.dsa.statement.public', title: 'Not first writable family', summary: 'Statements are not enabled for app writes yet.', bodyMarkdown: 'Only public events are enabled for the first write slice.', issuerUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', issuerName: 'NYC DSA', publishedAt: '2026-07-01T00:00:00.000Z', topics: [], relatedEntityUris: [], status: 'published' },
        },
      }),
    });
    const json = await response.json() as { data: { status: string; errors: string[] } };

    expect(response.status).toBe(422);
    expect(json.data.status).toBe('rejected');
    expect(json.data.errors.join(' ')).toContain('collection org.dsa.statement.public not allowed');
  });

  it('stores rejected dry-runs for invalid host scope and exposes them to the same app only', async () => {
    const repository = createMemoryRepository();
    const store = new InMemoryWriteOperationStore();
    server = createApp(repository, { ENABLE_WRITE_GATEWAY: true, writeOperationStore: store });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/write/records`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-dsa-app-token': 'demo-staging-event-token',
        'idempotency-key': 'idem-2',
        'if-match': 'bafy-current-cid',
      },
      body: JSON.stringify({
        dryRun: true,
        record: {
          uri: 'at://did:plc:demo/org.dsa.event.public/dry-run-2',
          cid: 'bafy-dry-run-2',
          did: 'did:plc:demo',
          handle: 'demo.example',
          collection: 'org.dsa.event.public',
          indexedAt: '2026-07-01T00:00:00.000Z',
          trustLabel: 'community-submitted',
          record: {
            $type: 'org.dsa.event.public',
            title: 'Rejected Dry Run',
            hostEntityUri: 'at://did:plc:missing/org.dsa.profile.chapter/self',
            hostEntityName: 'Missing Host',
            startsAt: '2026-07-10T18:00:00.000Z',
            mode: 'online',
            status: 'scheduled',
            topics: [],
            relatedEntityUris: [],
          },
        },
      }),
    });
    const json = await response.json() as { data: { operationId: string; status: string; errors: string[] } };
    const op = store.getOperation(json.data.operationId);
    const denied = await fetch(`http://127.0.0.1:${address.port}/api/write/operations/${json.data.operationId}`, {
      headers: { authorization: 'Bearer wrong-token' },
    });
    const allowed = await fetch(`http://127.0.0.1:${address.port}/api/write/operations/${json.data.operationId}`, {
      headers: { authorization: 'Bearer demo-staging-event-token' },
    });

    expect(response.status).toBe(422);
    expect(json.data.status).toBe('rejected');
    expect(json.data.errors.join(' ')).toContain('host entity not found');
    expect(op?.status).toBe('rejected');
    expect(denied.status).toBe(401);
    expect(allowed.status).toBe(200);
  });

  it('rejects out-of-scope families during fixture replay', async () => {
    const repository = createMemoryRepository();
    const report = await replayFixtureRecords([
      {
        uri: 'at://did:plc:vote/org.dsa.localVoting.tally/self',
        cid: 'bafy-mock-local-vote',
        did: 'did:plc:vote',
        handle: 'vote.example',
        collection: 'org.dsa.localVoting.tally',
        indexedAt: '2026-07-01T00:00:00.000Z',
        trustLabel: 'community-submitted',
        record: { $type: 'org.dsa.localVoting.tally', sourceUrl: 'https://example.org/public-vote' },
      },
      {
        uri: 'at://did:plc:clean/org.dsa.statement.public/self',
        cid: 'bafy-clean',
        did: 'did:plc:clean',
        handle: 'clean.example',
        collection: 'org.dsa.statement.public',
        indexedAt: '2026-07-01T00:00:00.000Z',
        trustLabel: 'community-submitted',
        record: { $type: 'org.dsa.statement.public', title: 'ok', summary: 'ok', bodyMarkdown: 'ok', issuerUri: 'at://did:plc:clean/org.dsa.profile.chapter/self', issuerName: 'Clean', publishedAt: '2026-07-01T00:00:00.000Z', topics: [], relatedEntityUris: [], status: 'published' },
      },
    ], repository);

    expect(report.acceptedCount).toBe(1);
    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0].reason).toContain('out-of-scope collection family');
  });

  it('resolves authority without external source records', async () => {
    server = createApp(createMemoryRepository(), { DEMO_READ_ONLY: true });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/records/resolve?uri=${encodeURIComponent(chapterSeedRecords[0].uri)}`);
    const json = await response.json() as { data: { caveats: string[]; authorityRecords: unknown[] } };
    expect(response.status).toBe(200);
    expect(json.data.caveats[0]).toContain('fixture source of truth');
    expect(json.data.authorityRecords).toBeDefined();
  });

  it('surfaces lifecycle and conflict context for disputed, revoked, archived, and superseded records', async () => {
    server = createApp(createMemoryRepository(), { DEMO_READ_ONLY: true });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const dispute = await fetch(`http://127.0.0.1:${address.port}/api/records/resolve?uri=${encodeURIComponent(caucusSeedRecords[0].uri)}`).then((res) => res.json() as Promise<{ data: { status: string; activeDisputes: unknown[]; lifecycleState?: string } }>);
    const revoked = await fetch(`http://127.0.0.1:${address.port}/api/records/resolve?uri=${encodeURIComponent(chapterSeedRecords[0].uri)}`).then((res) => res.json() as Promise<{ data: { status: string; activeRevocations: unknown[]; trustLabel?: string } }>);
    const archived = await fetch(`http://127.0.0.1:${address.port}/api/records/resolve?uri=${encodeURIComponent('at://did:plc:demleft/org.dsa.profile.orgUnit/self')}`).then((res) => res.json() as Promise<{ data: { archiveMarkers: unknown[]; status: string } }>);
    const superseded = await fetch(`http://127.0.0.1:${address.port}/api/records/resolve?uri=${encodeURIComponent(identityContinuitySeedRecords[2].uri)}`).then((res) => res.json() as Promise<{ data: { lifecycleState?: string; status: string } }>);

    expect(dispute.data.status).toBe('disputed');
    expect(dispute.data.activeDisputes.length).toBeGreaterThan(0);
    expect(revoked.data.status).toBe('revoked');
    expect(revoked.data.activeRevocations.length).toBeGreaterThan(0);
    expect(archived.data.archiveMarkers.length).toBeGreaterThan(0);
    expect(archived.data.status).toBe('archived');
    expect(superseded.data.lifecycleState).toBe('superseded');
    expect(superseded.data.status).toBe('superseded');
  });

  it('keeps active records valid while exposing the shared resolver contract for public records', async () => {
    server = createApp(createMemoryRepository(), { DEMO_READ_ONLY: true });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/records/resolve?uri=${encodeURIComponent(publicStatementSeedRecords[0].uri)}`);
    const json = await response.json() as { data: { status: string; trustLabel?: string; supportingAuthorityRecords: unknown[]; fixtureSourceOfTruthCaveat: string } };
    expect(response.status).toBe(200);
    expect(json.data.status).toBe('valid');
    expect(json.data.trustLabel).toBeDefined();
    expect(json.data.supportingAuthorityRecords).toBeDefined();
    expect(json.data.fixtureSourceOfTruthCaveat).toContain('fixture source of truth');
  });
});
