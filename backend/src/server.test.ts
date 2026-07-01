import { afterEach, describe, expect, it } from 'vitest';
import { caucusSeedRecords, chapterSeedRecords, memberAffiliationSeedRecords, recordEnvelopeSchema, normalizeDirectoryEntity } from './domain.js';
import { replayFixtureRecords } from './fixture-replay.js';
import { createApp, createMemoryRepository, getConfig } from './server.js';

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

  it('rejects records when collection and payload type disagree', () => {
    expect(() => recordEnvelopeSchema.parse({ ...caucusSeedRecords[0], collection: 'org.dsa.profile.chapter' })).toThrow();
  });
});

describe('ingestion and read path', () => {
  it('normalizes and stores mixed records in memory', async () => {
    const repo = createMemoryRepository([]);
    await repo.ingestRecordEnvelopes([chapterSeedRecords[0], caucusSeedRecords[0], memberAffiliationSeedRecords[0]]);
    const entities = await repo.listEntities();
    expect(entities).toHaveLength(3);
    expect(entities[0]).toMatchObject({ name: 'New York City DSA', trustLabel: 'mock-official', type: 'chapter' });
    expect(entities[1]).toMatchObject({ name: 'DSA Climate Caucus', type: 'caucus' });
    expect(entities[2]).toMatchObject({ type: 'member-affiliation', trustLabel: 'self-declared' });
    expect(entities[2].record.record.$type).toBe('org.dsa.affiliation.member');
    expect(normalizeDirectoryEntity(caucusSeedRecords[0]).searchText).toContain('climate caucus');
    expect(normalizeDirectoryEntity(memberAffiliationSeedRecords[0]).searchText).toContain('member.alpha.example');
  });

  it('replays fixtures through validation before ingestion', async () => {
    const repo = createMemoryRepository([]);
    const report = await replayFixtureRecords([chapterSeedRecords[0], caucusSeedRecords[0], memberAffiliationSeedRecords[0]], repo);

    expect(report).toMatchObject({ acceptedCount: 3, ingestedCount: 3, rejected: [] });
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
});
