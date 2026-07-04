import { describe, expect, it } from 'vitest';
import { chapterSeedRecords, verificationAssertionSeedRecords } from './domain.js';
import { importChapterFixturesFromCsvText } from './chapters-csv-import.js';

describe('chapter CSV import', () => {
  it('parses quoted CSV rows, normalizes websites, and excludes private columns', () => {
    const csv = [
      'State,Name,Status,Group Email,Website,Linktree,Facebook,Twitter,Bluesky,Instagram,Blog,Event Calendar,Email list',
      'CA,"Central Coast, California",Chapter,hello@example.org,centralcoastdsa.org,https://linktr.ee/ccdsa,,,,,,,',
      'NY,East Harlem,Organizing Committee,organize@example.org,,https://linktr.ee/ehdsa,,,,,,,'
    ].join('\n');

    const { records, rowsRead } = importChapterFixturesFromCsvText(csv, []);
    expect(rowsRead).toBe(2);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      collection: 'org.dsa.profile.chapter',
      did: 'did:plc:dsa-ca-central-coast-california',
      handle: 'centralcoastdsa.org',
      record: {
        name: 'Central Coast, California',
        shortName: 'Central Coast, California',
        jurisdiction: { type: 'chapter', name: 'Central Coast, California', state: 'CA', country: 'US' },
        website: 'https://centralcoastdsa.org/',
        status: 'active',
      },
    });
    expect('website' in records[1].record ? records[1].record.website : undefined).toBe('https://dsausa.org/chapters/');
    expect(records[1].handle).toBe('ny-east-harlem.chapters.dsa.example');
    expect(JSON.stringify(records)).not.toContain('hello@example.org');
    expect(JSON.stringify(records)).not.toContain('linktr.ee');
  });

  it('preserves non-import fixtures when replacing imported chapter records', () => {
    const csv = 'State,Name,Status,Group Email,Website\nNY,New York City,Chapter,info@example.org,nyc.example.org';
    const staleImportedChapter = { ...chapterSeedRecords[0], did: 'did:plc:dsa-old-record', cid: 'bafy-dsa-old-record', uri: 'at://did:plc:dsa-old-record/org.dsa.profile.chapter/self' };
    const imported = importChapterFixturesFromCsvText(csv, [staleImportedChapter, verificationAssertionSeedRecords[0]]);

    expect(imported.records).toHaveLength(2);
    expect(imported.records.some((record) => record.collection === 'org.dsa.verification.assertion')).toBe(true);
    expect(imported.records.some((record) => record.uri === staleImportedChapter.uri)).toBe(false);
  });
});
