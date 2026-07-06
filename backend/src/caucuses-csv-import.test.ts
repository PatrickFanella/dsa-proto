import { describe, expect, it } from 'vitest';
import { chapterSeedRecords, caucusSeedRecords, verificationAssertionSeedRecords } from './domain.js';
import { importCaucusFixturesFromCsvText } from './caucuses-csv-import.js';

describe('caucus CSV import', () => {
  it('parses quoted CSV rows, normalizes websites, and excludes extra columns', () => {
    const csv = [
      'Name,Short Name,Focus Area,Website,Status,Handle,DID,Trust Label,Source,Notes',
      '"North Star Caucus","North Star","Organizational strategy","northstar.example.org,https://backup.example.org",active,,did:plc:dsa-caucus-north-star,uncertain,article,public',
      '"Mass","Mass","Political education",,active,dsa_mass,,community-submitted,article,commentary'
    ].join('\n');

    const { records, rowsRead } = importCaucusFixturesFromCsvText(csv, []);
    expect(rowsRead).toBe(2);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      collection: 'org.dsa.profile.caucus',
      did: 'did:plc:dsa-caucus-north-star',
      handle: 'northstar.example.org',
      record: {
        name: 'North Star Caucus',
        shortName: 'North Star',
        focusArea: 'Organizational strategy',
        website: 'https://northstar.example.org/',
        status: 'active',
      },
    });
    expect('website' in records[1].record ? records[1].record.website : undefined).toBe('https://dsausa.org/');
    expect(JSON.stringify(records)).not.toContain('backup.example.org');
    expect(JSON.stringify(records)).not.toContain('Source');
  });

  it('builds deterministic caucus envelopes with neutral fields', () => {
    const csv = 'Name,Short Name,Focus Area,Website,Status,Handle,DID,Trust Label\nBread & Roses,B&R,Chapter organizing and labor strategy,https://breadandrosesdsa.org/,active,breadrosesDSA,did:plc:dsa-caucus-bread-and-roses,uncertain';
    const { records } = importCaucusFixturesFromCsvText(csv, []);

    expect(records[0]).toMatchObject({
      uri: 'at://did:plc:dsa-caucus-bread-and-roses/org.dsa.profile.caucus/self',
      cid: 'bafy-dsa-caucus-bread-roses',
      trustLabel: 'uncertain',
      record: { $type: 'org.dsa.profile.caucus', name: 'Bread & Roses', shortName: 'B&R', focusArea: 'Chapter organizing and labor strategy' },
    });
  });

  it('preserves non-caucus fixtures and replaces stale generated caucus imports', () => {
    const csv = 'Name,Short Name,Focus Area,Website,Status,Handle,DID,Trust Label\nClimate Caucus,Climate,Caucus work,https://example.org,active,climate.example,did:plc:dsa-caucus-climate-caucus,community-submitted';
    const staleGenerated = { ...caucusSeedRecords[0], did: 'did:plc:dsa-caucus-old-climate', cid: 'bafy-dsa-caucus-old-climate', uri: 'at://did:plc:dsa-caucus-old-climate/org.dsa.profile.caucus/self' };
    const imported = importCaucusFixturesFromCsvText(csv, [staleGenerated, chapterSeedRecords[0], verificationAssertionSeedRecords[0]]);

    expect(imported.records.some((record) => record.uri === staleGenerated.uri)).toBe(false);
    expect(imported.records.some((record) => record.uri === chapterSeedRecords[0].uri)).toBe(true);
    expect(imported.records.some((record) => record.collection === 'org.dsa.verification.assertion')).toBe(true);
  });
});
