import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { authoritySeedRecords, chapterSeedRecords, caucusSeedRecords, governanceRelationshipSeedRecords, memberAffiliationSeedRecords, orgChartSeedRecords, verificationAssertionSeedRecords } from './domain.js';
import { loadRegistryHealthReport } from './registry-health.js';

async function writeFixture(records: unknown[]) {
  const dir = await mkdtemp(join(tmpdir(), 'registry-health-'));
  const file = join(dir, 'records.json');
  await writeFile(file, `${JSON.stringify(records, null, 2)}\n`);
  return file;
}

describe('registry health', () => {
  const firstGovernanceRelationship = governanceRelationshipSeedRecords[0].record as { subjectUri: string; objectUri: string };

  it('accepts a healthy canonical fixture set and ignores non-directory duplicate checks', async () => {
    const file = await writeFixture([...chapterSeedRecords, ...caucusSeedRecords, ...authoritySeedRecords, ...memberAffiliationSeedRecords, ...verificationAssertionSeedRecords]);
    const report = await loadRegistryHealthReport(file);

    expect(report.totalRecords).toBeGreaterThan(0);
    expect(report.validRecords).toBe(report.totalRecords);
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

  it('keeps the canonical fixture file valid', async () => {
    const report = await loadRegistryHealthReport('fixtures/records.json');

    expect(report.invalidRecords).toHaveLength(0);
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

  it('accepts a valid governance graph', async () => {
    const file = await writeFixture([...orgChartSeedRecords, ...governanceRelationshipSeedRecords]);
    const report = await loadRegistryHealthReport(file);

    expect(report.invalidRecords).toHaveLength(0);
  });

  it('rejects governance relationships with missing references', async () => {
    const file = await writeFixture([
      ...orgChartSeedRecords,
      { ...governanceRelationshipSeedRecords[0], record: { ...governanceRelationshipSeedRecords[0].record, objectUri: 'at://did:plc:missing/org.dsa.profile.orgUnit/self' } },
    ]);
    const report = await loadRegistryHealthReport(file);

    expect(report.invalidRecords).toHaveLength(1);
    expect(report.invalidRecords[0].reason).toContain('unknown source/target');
  });

  it('rejects invalid governance source/target pairs', async () => {
    const file = await writeFixture([
      ...orgChartSeedRecords,
      { ...governanceRelationshipSeedRecords[0], record: { ...governanceRelationshipSeedRecords[0].record, relationship: 'appoints' } },
    ]);
    const report = await loadRegistryHealthReport(file);

    expect(report.invalidRecords).toHaveLength(1);
    expect(report.invalidRecords[0].reason).toContain('does not allow');
  });

  it('flags hierarchy cycles but allows non-hierarchical cross-affiliations', async () => {
    const cycleRecords = [
      governanceRelationshipSeedRecords[0],
      { ...governanceRelationshipSeedRecords[0], uri: 'at://did:plc:npc/org.dsa.relationship.governance/cycle-back', record: { ...governanceRelationshipSeedRecords[0].record, subjectUri: firstGovernanceRelationship.objectUri, objectUri: firstGovernanceRelationship.subjectUri } },
      governanceRelationshipSeedRecords[2],
    ];
    const file = await writeFixture([...orgChartSeedRecords, ...cycleRecords]);
    const report = await loadRegistryHealthReport(file);

    expect(report.invalidRecords.some((issue) => issue.reason.includes('cycle'))).toBe(true);
  });

  it('rejects out-of-scope publication boundary families and private-data-shaped payloads', async () => {
    const file = await writeFixture([
      {
        uri: 'at://did:plc:vote/org.dsa.voting.ballot/self',
        cid: 'bafy-mock-vote',
        did: 'did:plc:vote',
        handle: 'vote.example',
        collection: 'org.dsa.voting.ballot',
        indexedAt: '2026-07-01T00:00:00.000Z',
        trustLabel: 'community-submitted',
        record: { $type: 'org.dsa.voting.ballot', sourceUrl: 'https://example.org/public-ballot' },
      },
      {
        uri: 'at://did:plc:chain/org.dsa.sourceChain.entry/self',
        cid: 'bafy-mock-chain',
        did: 'did:plc:chain',
        handle: 'chain.example',
        collection: 'org.dsa.sourceChain.entry',
        indexedAt: '2026-07-01T00:00:00.000Z',
        trustLabel: 'community-submitted',
        record: { $type: 'org.dsa.sourceChain.entry', sourceUrl: 'https://example.org/public-source' },
      },
      {
        uri: 'at://did:plc:safe/org.dsa.statement.public/private-shaped',
        cid: 'bafy-mock-private',
        did: 'did:plc:safe',
        handle: 'safe.example',
        collection: 'org.dsa.statement.public',
        indexedAt: '2026-07-01T00:00:00.000Z',
        trustLabel: 'community-submitted',
        record: { $type: 'org.dsa.statement.public', title: 'x', summary: 'y', bodyMarkdown: 'z', issuerUri: 'at://did:plc:safe/org.dsa.profile.chapter/self', issuerName: 'Safe', publishedAt: '2026-07-01T00:00:00.000Z', topics: [], relatedEntityUris: [], status: 'published', contact: { email: 'hidden@example.org' } },
      },
    ]);

    const report = await loadRegistryHealthReport(file);
    expect(report.invalidRecords).toHaveLength(3);
    expect(report.invalidRecords.map((issue) => issue.reason).join(' ')).toContain('out-of-scope collection family');
    expect(report.invalidRecords.map((issue) => issue.reason).join(' ')).toContain('unsafe private-data-shaped field');
    expect(report.invalidRecords.map((issue) => issue.reason).join(' ')).not.toContain('sourceUrl');
  });
});
