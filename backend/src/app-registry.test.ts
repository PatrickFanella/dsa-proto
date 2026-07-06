import { describe, expect, it } from 'vitest';
import type { RecordEnvelope } from './domain.js';
import { authenticateAppFromToken, appRegistryFixture, validateRecordEnvelopeAgainstAppScope } from './app-registry.js';

const app = appRegistryFixture[0];

function eventRecord(overrides: Partial<RecordEnvelope> = {}): RecordEnvelope {
  return {
    uri: 'at://did:plc:nycdsa/org.dsa.event.public/test-event',
    cid: 'bafy-event-test',
    did: 'did:plc:nycdsa',
    handle: 'nyc.dsausa.org',
    collection: 'org.dsa.event.public',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'community-submitted' as const,
    record: {
      $type: 'org.dsa.event.public' as const,
      title: 'Staging Demo Event',
      hostEntityUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
      hostEntityName: 'New York City DSA',
      startsAt: '2026-07-10T18:00:00.000Z',
      mode: 'online' as const,
      status: 'scheduled' as const,
      topics: ['test'],
      relatedEntityUris: [],
    },
    ...overrides,
  } as RecordEnvelope;
}

describe('app registry', () => {
  it('authenticates the staging demo token', () => {
    expect(authenticateAppFromToken(app.token)?.app.appId).toBe(app.appId);
  });

  it('allows the staging event scope', () => {
    expect(validateRecordEnvelopeAgainstAppScope(eventRecord(), app)).toEqual([]);
  });

  it('blocks foundation families', () => {
    const issues = validateRecordEnvelopeAgainstAppScope({
      ...eventRecord(),
      collection: 'org.dsa.profile.chapter',
      record: { $type: 'org.dsa.profile.chapter', name: 'Test', shortName: 'Test', jurisdiction: { type: 'city', name: 'Test', state: 'TS', country: 'US' }, website: 'https://example.org', status: 'active' },
    } as RecordEnvelope, app);
    expect(issues.some((issue) => issue.reason.includes('foundation family blocked'))).toBe(true);
  });

  it('blocks official trust labels', () => {
    const issues = validateRecordEnvelopeAgainstAppScope({ ...eventRecord(), trustLabel: 'official' }, app);
    expect(issues.some((issue) => issue.reason.includes('trust label official not allowed'))).toBe(true);
  });

  it('blocks wrong host entity', () => {
    const issues = validateRecordEnvelopeAgainstAppScope({ ...eventRecord(), record: { ...eventRecord().record, hostEntityUri: 'at://did:plc:other/org.dsa.profile.chapter/self' } } as RecordEnvelope, app);
    expect(issues.some((issue) => issue.reason.includes('host at://did:plc:other'))).toBe(true);
  });

  it('rejects unknown token and disabled apps', () => {
    expect(authenticateAppFromToken('missing-token')).toBeUndefined();
    const issues = validateRecordEnvelopeAgainstAppScope(eventRecord(), { ...app, enabled: false });
    expect(issues.some((issue) => issue.reason.includes('disabled'))).toBe(true);
  });
});
