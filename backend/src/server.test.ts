import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { chapterSeedRecords, caucusSeedRecords, memberAffiliationSeedRecords, verificationAssertionSeedRecords, publicStatementSeedRecords, publicationSeedRecords, endorsementSeedRecords, publicEventSeedRecords, orgChartSeedRecords, governanceRelationshipSeedRecords, lifecycleStatusSchema, recordEnvelopeSchema, trustLabelSchema, identityContinuitySeedRecords, projectCurrentIdentity } from './domain.js';
import { createApp, createMemoryRepository, getConfig } from './server.js';
import { replayFixtureRecords } from './fixture-replay.js';
import { loadFixtureFile } from './fixture-files.js';

describe('getConfig', () => {
  it('parses a port from env', () => {
    expect(getConfig({ PORT: '9090' }).PORT).toBe(9090);
  });
});

describe('record validation', () => {
  it('keeps lifecycle and trust label vocabularies separate', () => {
    expect(lifecycleStatusSchema.options).toEqual(expect.arrayContaining(['deprecated', 'tombstoned']));
    expect(trustLabelSchema.options).toEqual(expect.arrayContaining(['official', 'uncertain']));
    expect(trustLabelSchema.options).not.toEqual(expect.arrayContaining(['revoked', 'disputed', 'archived']));
  });

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
    expect(recordEnvelopeSchema.parse(identityContinuitySeedRecords[0]).collection).toBe('org.dsa.identity.continuity');
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

  it('projects identity continuity without replacing the stable identity', () => {
    const rename = projectCurrentIdentity(identityContinuitySeedRecords, 'caucus:climate-justice');
    const superseded = projectCurrentIdentity(identityContinuitySeedRecords, 'org-unit:metro-dsa');
    const tombstoned = projectCurrentIdentity(identityContinuitySeedRecords, 'org-unit:metro-dsa-east');

    expect(rename).toMatchObject({ stableId: 'caucus:climate-justice', displayName: 'DSA Climate Caucus', handle: 'climate.dsausa.org', status: 'active' });
    expect(rename?.recordUri).toBe('at://did:plc:climatecaucus/org.dsa.identity.continuity/rename-marker');
    expect(superseded).toMatchObject({ stableId: 'org-unit:metro-dsa', displayName: 'Metro DSA', handle: 'metrodsa.example', status: 'superseded', successorUri: 'at://did:plc:metrodsa-east/org.dsa.profile.orgUnit/self' });
    expect(tombstoned).toMatchObject({ stableId: 'org-unit:metro-dsa-east', displayName: 'Metro DSA East', handle: 'metrodsa-east.example', status: 'tombstoned', archivedByUri: 'at://did:plc:metrodsa/org.dsa.profile.orgUnit/self' });
    expect(rename?.subjectUri).not.toBe(rename?.recordUri);
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

  it('loads the canonical fixture dataset file and exposes ready metadata', async () => {
    const fixture = await loadFixtureFile(fileURLToPath(new URL('../fixtures/records.json', import.meta.url)));
    server = createApp(createMemoryRepository(fixture.records as Parameters<typeof createMemoryRepository>[0], fixture.metadata), { DEMO_READ_ONLY: true });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const ready = await fetch(`http://127.0.0.1:${address.port}/ready`).then((res) => res.json() as Promise<{ status: string; dataset: { dataset: string; schema: string } }>);
    const entity = await fetch(`http://127.0.0.1:${address.port}/api/entities`).then((res) => res.json() as Promise<{ data: unknown[] }>);

    expect(ready.status).toBe('ready');
    expect(ready.dataset).toMatchObject({ dataset: 'canonical-fixture', schema: 'records.v1' });
    expect(entity.data.length).toBeGreaterThan(0);
  });

  it('keeps admin fixture ingest disabled in read-only demo mode', async () => {
    server = createApp(createMemoryRepository(), { DEMO_READ_ONLY: true });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/fixtures/ingest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ records: [] }) });
    expect(response.status).toBe(404);
  });

  it('rejects out-of-scope families during fixture replay', async () => {
    const repository = createMemoryRepository();
    const report = await replayFixtureRecords([
      {
        uri: 'at://did:plc:vote/org.dsa.localVoting.tally/self',
        cid: 'bafy-mock-local-vote',
        did: 'did:plc:vote',
        handle: 'vote.example',
        collection: 'org.dsa.localVoting.tally',
        indexedAt: '2026-07-01T00:00:00.000Z',
        trustLabel: 'community-submitted',
        record: { $type: 'org.dsa.localVoting.tally', sourceUrl: 'https://example.org/public-vote' },
      },
      {
        uri: 'at://did:plc:clean/org.dsa.statement.public/self',
        cid: 'bafy-clean',
        did: 'did:plc:clean',
        handle: 'clean.example',
        collection: 'org.dsa.statement.public',
        indexedAt: '2026-07-01T00:00:00.000Z',
        trustLabel: 'community-submitted',
        record: { $type: 'org.dsa.statement.public', title: 'ok', summary: 'ok', bodyMarkdown: 'ok', issuerUri: 'at://did:plc:clean/org.dsa.profile.chapter/self', issuerName: 'Clean', publishedAt: '2026-07-01T00:00:00.000Z', topics: [], relatedEntityUris: [], status: 'published' },
      },
    ], repository);

    expect(report.acceptedCount).toBe(1);
    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0].reason).toContain('out-of-scope collection family');
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

  it('surfaces lifecycle and conflict context for disputed, revoked, archived, and superseded records', async () => {
    server = createApp(createMemoryRepository(), { DEMO_READ_ONLY: true });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const dispute = await fetch(`http://127.0.0.1:${address.port}/api/records/resolve?uri=${encodeURIComponent(caucusSeedRecords[0].uri)}`).then((res) => res.json() as Promise<{ data: { status: string; activeDisputes: unknown[]; lifecycleState?: string } }>);
    const revoked = await fetch(`http://127.0.0.1:${address.port}/api/records/resolve?uri=${encodeURIComponent(chapterSeedRecords[0].uri)}`).then((res) => res.json() as Promise<{ data: { status: string; activeRevocations: unknown[]; trustLabel?: string } }>);
    const archived = await fetch(`http://127.0.0.1:${address.port}/api/records/resolve?uri=${encodeURIComponent('at://did:plc:demleft/org.dsa.profile.orgUnit/self')}`).then((res) => res.json() as Promise<{ data: { archiveMarkers: unknown[]; status: string } }>);
    const superseded = await fetch(`http://127.0.0.1:${address.port}/api/records/resolve?uri=${encodeURIComponent(identityContinuitySeedRecords[2].uri)}`).then((res) => res.json() as Promise<{ data: { lifecycleState?: string; status: string } }>);

    expect(dispute.data.status).toBe('disputed');
    expect(dispute.data.activeDisputes.length).toBeGreaterThan(0);
    expect(revoked.data.status).toBe('revoked');
    expect(revoked.data.activeRevocations.length).toBeGreaterThan(0);
    expect(archived.data.archiveMarkers.length).toBeGreaterThan(0);
    expect(archived.data.status).toBe('archived');
    expect(superseded.data.lifecycleState).toBe('superseded');
    expect(superseded.data.status).toBe('superseded');
  });

  it('keeps active records valid while exposing the shared resolver contract for public records', async () => {
    server = createApp(createMemoryRepository(), { DEMO_READ_ONLY: true });
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');

    const response = await fetch(`http://127.0.0.1:${address.port}/api/records/resolve?uri=${encodeURIComponent(publicStatementSeedRecords[0].uri)}`);
    const json = await response.json() as { data: { status: string; trustLabel?: string; supportingAuthorityRecords: unknown[]; fixtureSourceOfTruthCaveat: string } };
    expect(response.status).toBe(200);
    expect(json.data.status).toBe('valid');
    expect(json.data.trustLabel).toBeDefined();
    expect(json.data.supportingAuthorityRecords).toBeDefined();
    expect(json.data.fixtureSourceOfTruthCaveat).toContain('fixture source of truth');
  });
});
