import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chapterSeedRecords, caucusSeedRecords, memberAffiliationSeedRecords, verificationAssertionSeedRecords } from './domain.js';
import { loadRegistryHealthReport } from './registry-health.js';

async function writeFixture(records: unknown[]) {
  const dir = await mkdtemp(join(tmpdir(), 'registry-health-'));
  const file = join(dir, 'records.json');
  await writeFile(file, `${JSON.stringify(records, null, 2)}\n`);
  return file;
}

describe('registry health', () => {
  it('accepts a healthy canonical fixture set and ignores non-directory duplicate checks', async () => {
    const file = await writeFixture([...chapterSeedRecords, ...caucusSeedRecords, ...memberAffiliationSeedRecords, ...verificationAssertionSeedRecords]);
    const report = await loadRegistryHealthReport(file);

    expect(report.invalidRecords).toHaveLength(0);
    expect(report.duplicates.uri).toHaveLength(0);
    expect(report.duplicates.did).toHaveLength(0);
    expect(report.duplicates.handle).toHaveLength(0);
    expect(report.duplicates.name).toHaveLength(0);
    expect(report.directoryCountsByCollection).toMatchObject({
      'org.dsa.affiliation.member': 3,
      'org.dsa.profile.chapter': 2,
      'org.dsa.profile.caucus': 2,
    });
    expect(report.directoryCountsByType).toMatchObject({ chapter: 2, caucus: 2, 'member-affiliation': 3 });
  });

  it('reports invalid records', async () => {
    const file = await writeFixture([{ uri: 'nope' }, chapterSeedRecords[0]]);
    const report = await loadRegistryHealthReport(file);

    expect(report.invalidRecords).toHaveLength(1);
    expect(report.invalidRecords[0].index).toBe(0);
    expect(report.invalidRecords[0].reason).toContain('uri');
  });

  it('detects duplicate directory identifiers and normalized names within type', async () => {
    const duplicateChapter = {
      ...chapterSeedRecords[0],
      uri: 'at://did:plc:nycdsa-dup/org.dsa.profile.chapter/self',
      did: 'did:plc:nycdsa-dup',
      handle: 'nyc.dsausa.org',
      record: { ...chapterSeedRecords[0].record, name: ' new york city dsa ' },
    };
    const duplicateMember = {
      ...memberAffiliationSeedRecords[0],
      uri: 'at://did:plc:memberalpha-dup/org.dsa.affiliation.member/self',
      did: 'did:plc:memberalpha-dup',
      handle: 'member.alpha.example',
      record: { ...memberAffiliationSeedRecords[0].record, displayName: 'Alex   Rivera' },
    };
    const file = await writeFixture([chapterSeedRecords[0], duplicateChapter, memberAffiliationSeedRecords[0], duplicateMember]);
    const report = await loadRegistryHealthReport(file);

    expect(report.duplicates.uri).toHaveLength(0);
    expect(report.duplicates.did).toHaveLength(0);
    expect(report.duplicates.handle).toHaveLength(2);
    expect(report.duplicates.name).toHaveLength(2);
    expect(report.duplicates.handle.map((entry) => entry.value)).toEqual(['member.alpha.example', 'nyc.dsausa.org']);
  });

  it('leaves non-directory records out of directory duplicate checks', async () => {
    const duplicateVerification = { ...verificationAssertionSeedRecords[0], uri: 'at://did:plc:duplicate/org.dsa.verification.assertion/self' };
    const file = await writeFixture([verificationAssertionSeedRecords[0], duplicateVerification]);
    const report = await loadRegistryHealthReport(file);

    expect(report.directoryCountsByCollection).toEqual({});
    expect(report.duplicates.uri).toHaveLength(0);
    expect(report.duplicates.did).toHaveLength(0);
    expect(report.duplicates.handle).toHaveLength(0);
    expect(report.duplicates.name).toHaveLength(0);
  });
});
