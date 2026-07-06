import { afterEach, describe, expect, it } from 'vitest';
import { chapterSeedRecords, caucusSeedRecords, memberAffiliationSeedRecords, verificationAssertionSeedRecords, publicStatementSeedRecords, publicationSeedRecords, endorsementSeedRecords, publicEventSeedRecords, orgChartSeedRecords, governanceRelationshipSeedRecords, recordEnvelopeSchema } from './domain.js';
import { createApp, createMemoryRepository, getConfig } from './server.js';

describe('getConfig', () => {
  it('parses a port from env', () => {
    expect(getConfig({ PORT: '9090' }).PORT).toBe(9090);
  });
});

describe('record validation', () => {
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
});
