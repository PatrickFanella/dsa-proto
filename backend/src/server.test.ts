import { afterEach, describe, expect, it } from 'vitest';
import { caucusSeedRecords, chapterSeedRecords, memberAffiliationSeedRecords, mockRecordEnvelopeSchema, normalizeDirectoryEntity } from './domain.js';
import { createApp, createMemoryRepository, getConfig } from './server.js';

describe('getConfig', () => {
  it('parses a port from env', () => {
    expect(getConfig({ PORT: '9090' }).PORT).toBe(9090);
  });
});

describe('directory record validation', () => {
  it('accepts mocked chapter and caucus records', () => {
    expect(mockRecordEnvelopeSchema.parse(chapterSeedRecords[0]).uri).toContain('at://');
    expect(mockRecordEnvelopeSchema.parse(caucusSeedRecords[0]).collection).toBe('org.dsa.profile.caucus');
    expect(mockRecordEnvelopeSchema.parse(memberAffiliationSeedRecords[0]).collection).toBe('org.dsa.affiliation.member');
  });

  it('rejects records when collection and payload type disagree', () => {
    expect(() => mockRecordEnvelopeSchema.parse({ ...caucusSeedRecords[0], collection: 'org.dsa.profile.chapter' })).toThrow();
  });
});

describe('ingestion and read path', () => {
  it('normalizes and stores mixed records in memory', async () => {
    const repo = createMemoryRepository([]);
    await repo.ingestMockRecords([chapterSeedRecords[0], caucusSeedRecords[0], memberAffiliationSeedRecords[0]]);
    const entities = await repo.listEntities();
    expect(entities).toHaveLength(3);
    expect(entities[0]).toMatchObject({ name: 'New York City DSA', trustLabel: 'mock-official', type: 'chapter' });
    expect(entities[1]).toMatchObject({ name: 'DSA Climate Caucus', type: 'caucus' });
    expect(entities[2]).toMatchObject({ type: 'member-affiliation', trustLabel: 'self-declared' });
    expect(entities[2].record.record.$type).toBe('org.dsa.affiliation.member');
    expect(normalizeDirectoryEntity(caucusSeedRecords[0]).searchText).toContain('climate caucus');
    expect(normalizeDirectoryEntity(memberAffiliationSeedRecords[0]).searchText).toContain('member.alpha.example');
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
