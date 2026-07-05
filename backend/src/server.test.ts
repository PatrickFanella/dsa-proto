import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { getLiveAtprotoIngestionConfig, ingestLiveAtprotoEvent, mapLiveAtprotoEventToEnvelope } from './atproto-live.js';
import { allSeedRecords, caucusSeedRecords, chapterSeedRecords, governanceRelationshipSeedRecords, memberAffiliationSeedRecords, orgChartSeedRecords, recordEnvelopeSchema, normalizeDirectoryEntity, verificationAssertionSeedRecords, type ChapterRecord } from './domain.js';
import { loadFixtureRecordsFromFile, loadRawFixtureRecordsFromFile, writeFixtureRecordsToFile } from './fixture-files.js';
import { buildAuthorFixtureRecord } from './fixtures-author.js';
import { replayFixtureRecords } from './fixture-replay.js';
import { createApp, createMemoryRepository, getConfig } from './server.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('getConfig', () => {
  it('parses a port from env', () => {
    expect(getConfig({ PORT: '9090' }).PORT).toBe(9090);
  });
});

describe('directory record validation', () => {
  it('accepts mocked chapter and caucus records', () => {
    expect(recordEnvelopeSchema.parse(chapterSeedRecords[0]).uri).toContain('at://');
    expect(recordEnvelopeSchema.parse(caucusSeedRecords[0]).collection).toBe('org.dsa.profile.caucus');
    expect(recordEnvelopeSchema.parse(memberAffiliationSeedRecords[0]).collection).toBe('org.dsa.affiliation.member');
  });

  it('accepts verification assertion records', () => {
    expect(recordEnvelopeSchema.parse(verificationAssertionSeedRecords[0]).collection).toBe('org.dsa.verification.assertion');
  });

  it('accepts org unit and governance relationship records', () => {
    expect(recordEnvelopeSchema.parse(orgChartSeedRecords[0]).collection).toBe('org.dsa.profile.orgUnit');
    expect(recordEnvelopeSchema.parse(governanceRelationshipSeedRecords[0]).collection).toBe('org.dsa.relationship.governance');
  });

  it('rejects records when collection and payload type disagree', () => {
    expect(() => recordEnvelopeSchema.parse({ ...caucusSeedRecords[0], collection: 'org.dsa.profile.chapter' })).toThrow();
  });
});

describe('ingestion and read path', () => {
  it('normalizes and stores mixed records in memory', async () => {
    const repo = createMemoryRepository([]);
    await repo.ingestRecordEnvelopes([chapterSeedRecords[0], caucusSeedRecords[0], memberAffiliationSeedRecords[0], ...verificationAssertionSeedRecords]);
    const entities = await repo.listEntities();
    expect(entities).toHaveLength(3);
    expect(entities[0]).toMatchObject({ name: 'New York City DSA', trustLabel: 'mock-official', type: 'chapter' });
    expect(entities[0].verificationStatus).toBe('mock-verified');
    expect(entities[1]).toMatchObject({ name: 'DSA Climate Caucus', type: 'caucus', verificationStatus: 'disputed' });
    expect(entities[2]).toMatchObject({ type: 'member-affiliation', trustLabel: 'self-declared' });
    expect(entities[2].record.record.$type).toBe('org.dsa.affiliation.member');
    expect(normalizeDirectoryEntity(caucusSeedRecords[0], allSeedRecords)?.searchText).toContain('climate caucus');
    expect(normalizeDirectoryEntity(memberAffiliationSeedRecords[0], allSeedRecords)?.searchText).toContain('member.alpha.example');
  });

  it('loads and replays fixture files from disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsa-fixtures-'));
    const file = join(dir, 'records.json');
    await writeFixtureRecordsToFile(file, [chapterSeedRecords[0], verificationAssertionSeedRecords[0]]);
    const loaded = await loadFixtureRecordsFromFile(file);

    const repo = createMemoryRepository([]);
    const report = await replayFixtureRecords(loaded, repo);

    expect(report).toMatchObject({ acceptedCount: 2, rejected: [], ingestedCount: 2 });
    expect(await repo.listEntities()).toHaveLength(1);
  });

  it('can replay invalid fixture files with a rejection report', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsa-fixtures-'));
    const file = join(dir, 'records.json');
    await writeFixtureRecordsToFile(file, [chapterSeedRecords[0]]);
    const rawRecords = await loadRawFixtureRecordsFromFile(file);
    rawRecords.push({ ...chapterSeedRecords[0], uri: 'not-at-uri' });

    const repo = createMemoryRepository([]);
    const report = await replayFixtureRecords(rawRecords, repo);

    expect(report.acceptedCount).toBe(1);
    expect(report.rejected).toHaveLength(1);
    expect(await repo.listEntities()).toHaveLength(1);
  });

  it('author helper generates valid deterministic records', async () => {
    const record = buildAuthorFixtureRecord({ type: 'chapter', name: 'West Side DSA', file: 'fixtures/records.json' });
    expect(recordEnvelopeSchema.parse(record)).toMatchObject({
      collection: 'org.dsa.profile.chapter',
      record: { name: 'West Side DSA' },
    });
  });

  it('replays fixtures through validation before ingestion', async () => {
    const repo = createMemoryRepository([]);
    const report = await replayFixtureRecords([chapterSeedRecords[0], caucusSeedRecords[0], memberAffiliationSeedRecords[0], ...verificationAssertionSeedRecords], repo);

    expect(report).toMatchObject({ acceptedCount: 5, ingestedCount: 5, rejected: [] });
    expect(await repo.listEntities()).toHaveLength(3);
  });

  it('reports rejected records while still ingesting valid ones', async () => {
    const repo = createMemoryRepository([]);
    const invalidRecord = { ...chapterSeedRecords[0], uri: 'not-at-uri' };
    const report = await replayFixtureRecords([chapterSeedRecords[0], invalidRecord, memberAffiliationSeedRecords[0]], repo);

    const entities = await repo.listEntities();
    expect(entities).toHaveLength(2);
    expect(report.acceptedCount).toBe(2);
    expect(report.ingestedCount).toBe(2);
    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0]).toMatchObject({ index: 1 });
    expect(report.rejected[0].reason).toContain('uri');
    expect(report.rejected[0].reason).not.toContain('New York City DSA');
  });

  it('replay stays idempotent for deterministic fixture records', async () => {
    const repo = createMemoryRepository([]);
    await replayFixtureRecords([chapterSeedRecords[0], caucusSeedRecords[0]], repo);
    await replayFixtureRecords([chapterSeedRecords[0], caucusSeedRecords[0]], repo);

    const entities = await repo.listEntities();
    expect(entities).toHaveLength(2);
    expect(entities.map((entity) => entity.id)).toEqual([chapterSeedRecords[0].uri, caucusSeedRecords[0].uri]);
  });
});

describe('live ATProto ingestion adapter', () => {
  it('is disabled by default and parses supported collection config', () => {
    expect(getLiveAtprotoIngestionConfig({}).enabled).toBe(false);
    expect(getLiveAtprotoIngestionConfig({ ATPROTO_LIVE_INGESTION: 'true', ATPROTO_COLLECTIONS: 'org.dsa.profile.chapter,unknown.collection' })).toMatchObject({
      enabled: true,
      collections: ['org.dsa.profile.chapter'],
    });
  });

  it('maps create events to unverified record envelopes without network access', () => {
    const envelope = mapLiveAtprotoEventToEnvelope({
      event: 'create',
      uri: chapterSeedRecords[0].uri,
      cid: chapterSeedRecords[0].cid,
      did: chapterSeedRecords[0].did,
      handle: chapterSeedRecords[0].handle,
      collection: chapterSeedRecords[0].collection,
      record: chapterSeedRecords[0].record,
    }, () => new Date('2026-07-01T12:00:00.000Z'));

    expect(recordEnvelopeSchema.parse(envelope)).toMatchObject({
      uri: chapterSeedRecords[0].uri,
      trustLabel: 'unverified',
      indexedAt: '2026-07-01T12:00:00.000Z',
    });
  });

  it('ingests valid live events and rejects invalid ones without partial writes', async () => {
    const repo = createMemoryRepository([]);
    const accepted = await ingestLiveAtprotoEvent({
      event: 'update',
      uri: caucusSeedRecords[0].uri,
      cid: caucusSeedRecords[0].cid,
      did: caucusSeedRecords[0].did,
      handle: caucusSeedRecords[0].handle,
      collection: caucusSeedRecords[0].collection,
      record: caucusSeedRecords[0].record,
    }, repo);
    const rejected = await ingestLiveAtprotoEvent({
      event: 'create',
      uri: chapterSeedRecords[0].uri,
      cid: chapterSeedRecords[0].cid,
      did: chapterSeedRecords[0].did,
      collection: chapterSeedRecords[0].collection,
      record: { ...chapterSeedRecords[0].record, $type: 'org.dsa.profile.caucus' },
    }, repo);
    const ignored = await ingestLiveAtprotoEvent({ event: 'delete', did: chapterSeedRecords[0].did, collection: chapterSeedRecords[0].collection }, repo);

    expect(accepted).toBe('accepted');
    expect(rejected).toBe('rejected');
    expect(ignored).toBe('ignored');
    expect(await repo.listEntities()).toHaveLength(1);
  });
});

describe('API response', () => {
  let server: ReturnType<typeof createApp> | undefined;

  afterEach(() => server?.close());

  it('serves mixed directory entities', async () => {
    server = createApp(createMemoryRepository());
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/entities`);
    const json = (await response.json()) as { prototype: boolean; data: Array<{ name: string; type: string }> };
    expect(json.prototype).toBe(true);
    expect(json.data.some((item) => item.type === 'caucus')).toBe(true);
    expect(json.data.some((item) => item.type === 'member-affiliation')).toBe(true);
    expect(json.data.every((item) => item.type !== 'verification-assertion')).toBe(true);
  });

  it('serves the org chart slice', async () => {
    server = createApp(createMemoryRepository());
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/org-chart`);
    const json = await response.json() as { prototype: boolean; sourceUrl: string; updatedLabel: string; units: Array<{ name: string }>; relationships: Array<{ relationship: string }> };
    expect(json.prototype).toBe(true);
    expect(json.sourceUrl).toContain('National-DSA-Organization-Chart.jpg');
    expect(json.updatedLabel).toContain('June 2020');
    expect(json.units.some((unit) => unit.name === 'National Political Committee')).toBe(true);
    expect(json.relationships.some((rel) => rel.relationship === 'elects')).toBe(true);
  });

  it('serves registry health from the canonical fixture file', async () => {
    server = createApp(createMemoryRepository());
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/registry/health`);
    const json = await response.json() as { prototype: boolean; status: string; totalRecords: number; validCount: number; invalidCount: number; duplicateCount: number; directoryCountsByType: Record<string, number>; directoryCountsByCollection: Record<string, number>; fileLabel: string };
    expect(response.status).toBe(200);
    expect(json.prototype).toBe(true);
    expect(json.status).toBe('ok');
    expect(json.totalRecords).toBe(247);
    expect(json.validCount).toBe(247);
    expect(json.invalidCount).toBe(0);
    expect(json.duplicateCount).toBe(0);
    expect(json.directoryCountsByType).toMatchObject({ chapter: 233, caucus: 14 });
    expect(json.directoryCountsByCollection).toMatchObject({ 'org.dsa.profile.chapter': 233, 'org.dsa.profile.caucus': 14 });
    expect(json.fileLabel).toContain('fixtures/records.json');
  });

  it('filters org chart units by kind', async () => {
    server = createApp(createMemoryRepository());
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/org-chart?kind=publication`);
    const json = await response.json() as { units: Array<{ kind: string; uri: string }>; relationships: Array<{ subjectUri: string; objectUri: string }> };
    expect(json.units.length).toBeGreaterThan(0);
    expect(json.units.every((unit) => unit.kind === 'publication')).toBe(true);
    expect(json.relationships.every((relationship) => json.units.some((unit) => unit.uri === relationship.subjectUri || unit.uri === relationship.objectUri))).toBe(true);
  });

  it('focuses the org chart on a unit and its direct connections', async () => {
    server = createApp(createMemoryRepository());
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const unit = 'at://did:plc:npc/org.dsa.profile.orgUnit/self';
    const response = await fetch(`http://127.0.0.1:${address.port}/api/org-chart?unit=${encodeURIComponent(unit)}`);
    const json = await response.json() as { units: Array<{ uri: string }>; relationships: Array<{ subjectUri: string; objectUri: string }> };
    expect(json.units.map((item) => item.uri)).toContain(unit);
    expect(json.units.length).toBeGreaterThan(1);
    expect(json.relationships.length).toBeGreaterThan(0);
    expect(json.relationships.every((relationship) => json.units.some((unitRecord) => unitRecord.uri === relationship.subjectUri || unitRecord.uri === relationship.objectUri))).toBe(true);
  });

  it('filters entities by type and search text', async () => {
    server = createApp(createMemoryRepository());
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/entities?type=member-affiliation&q=alex`);
    const json = (await response.json()) as { data: Array<{ type: string; name: string }> };
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({ type: 'member-affiliation', name: 'Alex Rivera' });
  });

  it('filters entities by state and jurisdiction type', async () => {
    const repo = createMemoryRepository([
      {
        ...chapterSeedRecords[0],
        record: {
          ...(chapterSeedRecords[0].record as ChapterRecord),
          jurisdiction: { name: 'New York City', state: 'NY', country: 'US', type: 'chapter' },
        },
      },
    ]);
    server = createApp(repo);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/entities?state=NY&jurisdictionType=chapter`);
    const json = (await response.json()) as { data: Array<{ jurisdictionState?: string; jurisdictionType?: string }> };
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({ jurisdictionState: 'NY', jurisdictionType: 'chapter' });
  });

  it('filters organizing committees by jurisdiction type', async () => {
    const chapterRecord = chapterSeedRecords[0].record as ChapterRecord;
    const repo = createMemoryRepository([{
      ...chapterSeedRecords[0],
      uri: 'at://did:plc:ca-committee/org.dsa.profile.chapter/self',
      did: 'did:plc:ca-committee',
      record: { ...chapterRecord, jurisdiction: { ...chapterRecord.jurisdiction, type: 'organizing-committee', state: 'CA', name: 'California Organizing Committee' } },
    }]);
    const entities = await repo.listEntities({ jurisdictionType: 'organizing-committee' });
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ jurisdictionState: 'CA', jurisdictionType: 'organizing-committee' });
  });

  it('serves verification metadata on entity detail payloads', async () => {
    server = createApp(createMemoryRepository());
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/entities/at%3A%2F%2Fdid%3Aplc%3Anycdsa%2Forg.dsa.profile.chapter%2Fself`);
    const json = await response.json() as { data: { verificationStatus: string; verifiedBy?: string; verificationReason?: string } };
    expect(json.data.verificationStatus).toBe('mock-verified');
    expect(json.data.verifiedBy).toBe('dsausa.org');
    expect(json.data.verificationReason).toContain('NYC chapter');
  });

  it('filters postgres-shaped repository memory results consistently', async () => {
    const repo = createMemoryRepository();
    const chapters = await repo.listEntities({ type: 'chapter', search: 'michigan' });
    expect(chapters).toHaveLength(1);
    expect(chapters[0].name).toBe('Michigan DSA');
  });

  it('serves a directory entity detail payload', async () => {
    server = createApp(createMemoryRepository());
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/entities/at%3A%2F%2Fdid%3Aplc%3Anycdsa%2Forg.dsa.profile.chapter%2Fself`);
    const json = await response.json() as { prototype: boolean; data: { did: string; handle: string; collection: string; record: { record: { $type: string } } } };
    expect(response.status).toBe(200);
    expect(json.prototype).toBe(true);
    expect(json.data.did).toBe('did:plc:nycdsa');
    expect(json.data.record.record.$type).toBe('org.dsa.profile.chapter');
  });

  it('returns 404 for missing entities', async () => {
    server = createApp(createMemoryRepository());
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/entities/at%3A%2F%2Fmissing`);
    expect(response.status).toBe(404);
  });

  it('keeps the chapter endpoint chapter-only', async () => {
    server = createApp(createMemoryRepository());
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/chapters`);
    const json = (await response.json()) as { data: Array<{ type: string }> };
    expect(json.data.every((item) => item.type === 'chapter')).toBe(true);
  });

  it('ingests chapter fixtures through the admin endpoint', async () => {
    const repo = createMemoryRepository([]);
    server = createApp(repo);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const record = chapterSeedRecords[0];
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/fixtures/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ records: [record] }),
    });
    const json = await response.json() as { acceptedCount: number; ingestedCount: number; rejected: Array<unknown> };
    expect(response.status).toBe(200);
    expect(json).toMatchObject({ acceptedCount: 1, ingestedCount: 1, rejected: [] });
    expect((await repo.listEntities()).map((entity) => entity.id)).toContain(record.uri);
  });

  it('updates entity verification metadata after ingesting a verification assertion', async () => {
    const repo = createMemoryRepository([]);
    server = createApp(repo);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const records = [chapterSeedRecords[0], verificationAssertionSeedRecords[0]];
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/fixtures/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    expect(response.status).toBe(200);

    const detailResponse = await fetch(`http://127.0.0.1:${address.port}/api/entities/${encodeURIComponent(chapterSeedRecords[0].uri)}`);
    const detail = await detailResponse.json() as { data: { verificationStatus: string; verifiedBy?: string; verificationReason?: string } };
    expect(detail.data.verificationStatus).toBe('mock-verified');
    expect(detail.data.verifiedBy).toBe('dsausa.org');
    expect(detail.data.verificationReason).toContain('NYC chapter');

    const listResponse = await fetch(`http://127.0.0.1:${address.port}/api/entities`);
    const list = await listResponse.json() as { data: Array<{ id: string; verificationStatus: string; verifiedBy?: string; verificationReason?: string }> };
    expect(list.data.find((item) => item.id === chapterSeedRecords[0].uri)).toMatchObject({ verificationStatus: 'mock-verified', verifiedBy: 'dsausa.org' });
  });

  it('rejects invalid admin fixture bodies', async () => {
    server = createApp(createMemoryRepository([]));
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/fixtures/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not-json',
    });
    expect(response.status).toBe(400);
    const json = await response.json() as { error: string };
    expect(json.error).toBe('invalid_json');
  });

  it('returns structured rejections for invalid fixture records', async () => {
    server = createApp(createMemoryRepository([]));
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const invalidRecord = { ...chapterSeedRecords[0], uri: 'not-at-uri' };
    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/fixtures/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ records: [chapterSeedRecords[0], invalidRecord] }),
    });
    const json = await response.json() as { acceptedCount: number; rejected: Array<{ index: number; reason: string }> };
    expect(json.acceptedCount).toBe(1);
    expect(json.rejected).toHaveLength(1);
    expect(json.rejected[0]).toMatchObject({ index: 1 });
    expect(json.rejected[0].reason).toContain('uri');
  });
});
