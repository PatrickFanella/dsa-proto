import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EventDraft, FoundationEventsSnapshot } from './FoundationEventsApp';
import { buildEventWriteInput, FoundationEventsView } from './FoundationEventsApp';

const authority = { status: 'provisional' as const, policyUri: 'at://did:plc:root/us.dsaslate.temp.dsaPolicy/policy', policyVersion: 'temp-v1', rootDid: 'did:plc:root', chain: [], reasons: ['complete chain to provisional staging root'], evaluatedAt: '2026-07-09T00:00:00.000Z' };
const provenance = { uri: 'at://did:plc:root/us.dsaslate.temp.orgEntity/entity', cid: 'bafyreig5n5cwqv6pqtdbikv7hqxwkehu3hrr5wwx7vme2m4rsvh5phq4qu', repoDid: 'did:plc:root', repoRev: '3jzfcijpj2z2a', sequence: 1, observedAt: '2026-07-09T00:00:00.000Z', status: 'verified' as const };
const snapshot = {
  entities: [{ entityUri: provenance.uri, profile: { $type: 'us.dsaslate.temp.orgProfile', entity: { uri: provenance.uri, cid: provenance.cid }, displayName: 'Example Chapter', createdAt: '2026-07-09T00:00:00.000Z' }, dsaUnit: { $type: 'us.dsaslate.temp.dsaUnit', entity: { uri: provenance.uri, cid: provenance.cid }, unitKind: 'chapter', createdAt: '2026-07-09T00:00:00.000Z' }, profileProvenance: provenance, profileAuthority: authority, provenance, authority, lifecycle: 'active' }],
  activity: [{ uri: 'at://did:plc:root/us.dsaslate.temp.publicEvent/event', collection: 'us.dsaslate.temp.publicEvent', record: { $type: 'us.dsaslate.temp.publicEvent', hostEntity: provenance.uri, title: 'Public organizing meeting', description: 'A deliberately public event.', startsAt: '2026-07-20T18:00:00.000Z', mode: 'online', status: 'scheduled', createdAt: '2026-07-09T00:00:00.000Z' }, provenance: { ...provenance, uri: 'at://did:plc:root/us.dsaslate.temp.publicEvent/event' }, authority }],
  sync: { status: 'ready', enrolledRepoCount: 1, desynchronizedRepoCount: 0, lastSequence: 2, updatedAt: '2026-07-09T00:00:00.000Z' },
} as unknown as FoundationEventsSnapshot;

describe('FoundationEventsView', () => {
  it('renders the first app without collapsing authority, provenance, and lifecycle', () => {
    const html = renderToString(<FoundationEventsView snapshot={snapshot} />);
    expect(html).toContain('DSA Slate Events');
    expect(html).toContain('Provisional staging');
    expect(html).toContain('Public organizing meeting');
    expect(html).toContain('Example Chapter');
    expect(html).toContain('Provenance');
    expect(html).toContain('Authority reason');
    expect(html).toContain('Profile authority:');
    expect(html).toContain('Lifecycle');
    expect(html).not.toContain('Registry Health');
    expect(html).not.toContain('member affiliation');
    expect(html).not.toContain('Local Publisher Workbench');
  });

  it('renders explicit empty results instead of fixture fallbacks', () => {
    const html = renderToString(<FoundationEventsView snapshot={{ ...snapshot, entities: [], activity: [] }} initialSearch="missing" />);
    expect(html).toContain('No public events match this search');
    expect(html).toContain('No organizations match this search');
    expect(html).not.toContain('Example Chapter');
  });

  it('renders OAuth publishing and ownership controls for the signed-in repository', () => {
    const html = renderToString(<FoundationEventsView snapshot={snapshot} session={{ oauthEnabled: true, authenticated: true, did: 'did:plc:root', expiresAt: '2026-07-10T00:00:00.000Z', capabilities: { selfWrite: true, reviewSubmission: true, registryReview: false, collections: ['us.dsaslate.temp.orgProfile', 'us.dsaslate.temp.publicEvent'], actions: ['create', 'update', 'delete'] } }} />);
    expect(html).toContain('Organization publishing');
    expect(html).toContain('Signed in');
    expect(html).toContain('Publish event');
    expect(html).toContain('Edit');
    expect(html).toContain('Delete');
  });

  it('builds create and CID-guarded update operations without accepting identifiers for creates', () => {
    const draft: EventDraft = { hostEntity: provenance.uri, title: '  Organizer training  ', description: '', startsAt: '2026-07-20T18:00', endsAt: '', mode: 'hybrid', publicUrl: '', locationLabel: '', status: 'scheduled' };
    const create = buildEventWriteInput(draft, '2026-07-09T00:00:00.000Z');
    expect(create).toMatchObject({ action: 'create', collection: 'us.dsaslate.temp.publicEvent', record: { title: 'Organizer training', mode: 'hybrid', createdAt: '2026-07-09T00:00:00.000Z' } });
    expect(create).not.toHaveProperty('uri');
    expect(create).not.toHaveProperty('expectedCid');

    const update = buildEventWriteInput({ ...draft, uri: snapshot.activity[0]!.uri, expectedCid: provenance.cid, createdAt: '2026-07-08T00:00:00.000Z' });
    expect(update).toMatchObject({ action: 'update', uri: snapshot.activity[0]!.uri, expectedCid: provenance.cid, record: { createdAt: '2026-07-08T00:00:00.000Z' } });
  });
});
