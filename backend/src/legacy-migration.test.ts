import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadFixtureRecordsFromFile } from './fixture-files.js';
import { migrateLegacyRecords } from './legacy-migration.js';

describe('legacy v0 migration', () => {
  it('converts the canonical fixture deterministically without carrying trust labels', async () => {
    const path = fileURLToPath(new URL('../fixtures/records.json', import.meta.url));
    const legacy = await loadFixtureRecordsFromFile(path);
    const first = migrateLegacyRecords(legacy);
    const second = migrateLegacyRecords(legacy);
    expect(first.records.length).toBeGreaterThan(legacy.length);
    expect(first.records.map((record) => record.cid)).toEqual(second.records.map((record) => record.cid));
    expect(first.records.every((record) => record.status === 'unverified')).toBe(true);
    expect(first.records.some((record) => 'trustLabel' in record.record)).toBe(false);
    expect(first.records.some((record) => record.record.$type === 'us.dsaslate.temp.orgEntity')).toBe(true);
    expect(first.records.some((record) => record.record.$type === 'us.dsaslate.temp.dsaUnit')).toBe(true);
    expect(first.records.some((record) => record.record.$type === 'us.dsaslate.temp.authorityDelegation' && record.record.delegateDid === 'did:plc:npc')).toBe(false);
    expect(first.warnings.some((warning) => warning.reason.includes('valid delegate DID'))).toBe(true);
    const transition = first.records.find((record) => record.record.$type === 'us.dsaslate.temp.identityTransition');
    expect(transition?.record).toMatchObject({
      fromDid: 'did:plc:climateproject',
      toDid: 'did:plc:climatecaucus',
    });
  });

  it('drops public member affiliations', async () => {
    const legacy = await loadFixtureRecordsFromFile(fileURLToPath(new URL('../fixtures/records.json', import.meta.url)));
    const withMember = [...legacy, {
      uri: 'at://did:plc:memberalpha/org.dsa.affiliation.member/self', cid: 'bafy-member', did: 'did:plc:memberalpha', handle: 'member.example', collection: 'org.dsa.affiliation.member', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'self-declared',
      record: { $type: 'org.dsa.affiliation.member', displayName: 'Member', memberDid: 'did:plc:memberalpha', memberHandle: 'member.example', organizationDid: 'did:plc:organization', organizationHandle: 'organization.example', relationship: 'self-declared-member', trustTag: 'self-declared', visibility: 'public', interests: [], createdAt: '2026-07-01T00:00:00.000Z' },
    } as typeof legacy[number]];
    const result = migrateLegacyRecords(withMember);
    expect(result.dropped.some((entry) => entry.collection === 'org.dsa.affiliation.member')).toBe(true);
    expect(result.records.some((record) => record.record.$type.includes('affiliation'))).toBe(false);
  });
});
