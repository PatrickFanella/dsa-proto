import { afterEach, describe, expect, it } from 'vitest';
import { chapterSeedRecords, mockRecordEnvelopeSchema, normalizeChapter } from './domain.js';
import { createApp, createMemoryRepository, getConfig } from './server.js';

describe('getConfig', () => {
  it('parses a port from env', () => {
    expect(getConfig({ PORT: '9090' }).PORT).toBe(9090);
  });
});

describe('chapter record validation', () => {
  it('accepts mocked chapter records', () => {
    expect(mockRecordEnvelopeSchema.parse(chapterSeedRecords[0]).uri).toContain('at://');
  });
});

describe('ingestion and read path', () => {
  it('normalizes and stores chapter records in memory', async () => {
    const repo = createMemoryRepository([]);
    await repo.ingestMockRecords([chapterSeedRecords[0]]);
    expect((await repo.listChapters())[0]).toMatchObject({ name: 'New York City DSA', trustLabel: 'mock-official' });
    expect(normalizeChapter(chapterSeedRecords[0]).searchText).toContain('nyc-dsa');
  });
});

describe('API response', () => {
  let server: ReturnType<typeof createApp> | undefined;

  afterEach(() => server?.close());

  it('serves chapters', async () => {
    server = createApp(createMemoryRepository());
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/chapters`);
    const json = (await response.json()) as { prototype: boolean; data: Array<{ name: string }> };
    expect(json.prototype).toBe(true);
    expect(json.data[0].name).toBe('New York City DSA');
  });
});
