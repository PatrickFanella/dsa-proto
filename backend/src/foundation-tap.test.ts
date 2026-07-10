import type { IdentityEvent, RecordEvent } from '@atproto/tap';
import { describe, expect, it, vi } from 'vitest';
import { createFoundationRecord, DEFAULT_BOOTSTRAP_REPO_REV, DEFAULT_POLICY_VERSION, DEFAULT_PROVISIONAL_ROOT_DID } from './foundation-model.js';
import type { FoundationPostgresPersistence } from './foundation-postgres.js';
import { FoundationService } from './foundation-service.js';
import { FoundationTapProcessor, pdsEndpointFromDidDocument } from './foundation-tap.js';

function setup() {
  const policy = createFoundationRecord({
    uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.dsaPolicy/bootstrap-policy`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: DEFAULT_BOOTSTRAP_REPO_REV, sequence: 1, observedAt: '2026-07-09T00:00:00.000Z', status: 'unverified',
    record: { $type: 'us.dsaslate.temp.dsaPolicy', policyVersion: DEFAULT_POLICY_VERSION, rootDid: DEFAULT_PROVISIONAL_ROOT_DID, mode: 'provisional', permittedUnitKinds: ['chapter'], createdAt: '2026-07-09T00:00:00.000Z' },
  });
  return new FoundationService([policy], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });
}

function event(id: number, rev: string, rkey: string): RecordEvent {
  return {
    id,
    type: 'record',
    action: 'create',
    did: DEFAULT_PROVISIONAL_ROOT_DID,
    rev,
    collection: 'us.dsaslate.temp.orgEntity',
    rkey,
    cid: createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgEntity/${rkey}`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: rev, sequence: id, observedAt: '2026-07-09T00:00:01.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.orgEntity', displayName: rkey, entityType: 'organization', createdAt: '2026-07-09T00:00:01.000Z' },
    }).cid,
    record: { $type: 'us.dsaslate.temp.orgEntity', displayName: rkey, entityType: 'organization', createdAt: '2026-07-09T00:00:01.000Z' },
    live: true,
  } as RecordEvent;
}

describe('Tap-backed foundation sync', () => {
  it('processes each repository sequentially without treating global cursor gaps as repo gaps', async () => {
    const service = setup();
    const persistTapRecord = vi.fn(async () => undefined);
    const processor = new FoundationTapProcessor(service, {
      resolvePds: async () => 'https://pds-staging.dsaslate.us',
      persistence: { persistTapRecord } as unknown as FoundationPostgresPersistence,
      now: () => '2026-07-09T00:00:01.000Z',
    });

    expect(await processor.processRecord(event(100, '3jzfcijpj2z2b', 'one'))).toBe('accepted');
    expect(await processor.processRecord(event(500, '3jzfcijpj2z2c', 'two'))).toBe('accepted');
    expect(service.getRepoState(DEFAULT_PROVISIONAL_ROOT_DID)).toMatchObject({ cursor: 3, revSequence: 500, status: 'active' });
    expect(persistTapRecord).toHaveBeenCalledTimes(2);
  });

  it('accepts every operation from a multi-record commit with one repository revision', async () => {
    const service = setup();
    const processor = new FoundationTapProcessor(service, {
      resolvePds: async () => 'https://pds-staging.dsaslate.us',
      now: () => '2026-07-09T00:00:01.000Z',
    });
    expect(await processor.processRecord(event(100, '3jzfcijpj2z2b', 'one'))).toBe('accepted');
    expect(await processor.processRecord(event(101, '3jzfcijpj2z2b', 'two'))).toBe('accepted');
    expect(service.listEntities().entities.map((entity) => entity.entityUri)).toEqual([
      `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgEntity/one`,
      `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgEntity/two`,
    ]);
  });

  it('keeps its durable cursor monotonic when Tap reuses delivery IDs after draining', async () => {
    const service = setup();
    service.restoreRepoStates([{ did: DEFAULT_PROVISIONAL_ROOT_DID, rev: '3jzfcijpj2z2b', revSequence: 766, lastSequence: 767, cursor: 767, status: 'active', updatedAt: '2026-07-09T00:00:00.000Z' }]);
    const processor = new FoundationTapProcessor(service, { resolvePds: async () => 'https://pds-staging.dsaslate.us', now: () => '2026-07-09T00:00:01.000Z' });
    expect(await processor.processRecord(event(1, '3jzfcijpj2z2c', 'reused-one'))).toBe('accepted');
    expect(await processor.processRecord(event(2, '3jzfcijpj2z2c', 'reused-two'))).toBe('accepted');
    expect(service.getRepoState(DEFAULT_PROVISIONAL_ROOT_DID)).toMatchObject({ cursor: 769, lastSequence: 769, revSequence: 2 });
  });

  it('persists identity and account status before acknowledging the handler', async () => {
    const service = setup();
    const persistTapIdentity = vi.fn(async () => undefined);
    const processor = new FoundationTapProcessor(service, {
      resolvePds: async () => 'https://pds-staging.dsaslate.us',
      persistence: { persistTapIdentity } as unknown as FoundationPostgresPersistence,
      now: () => '2026-07-09T00:00:02.000Z',
    });
    const identity = { id: 12, type: 'identity', did: DEFAULT_PROVISIONAL_ROOT_DID, handle: 'registry.pds-staging.dsaslate.us', isActive: false, status: 'deactivated' } as IdentityEvent;

    expect(await processor.processIdentity(identity)).toBe('accepted');
    expect(service.getIdentityState(DEFAULT_PROVISIONAL_ROOT_DID)).toMatchObject({ active: false, pds: 'https://pds-staging.dsaslate.us' });
    expect(persistTapIdentity).toHaveBeenCalledOnce();
  });

  it('extracts only an HTTPS authoritative PDS service', () => {
    expect(pdsEndpointFromDidDocument({ service: [{ id: `${DEFAULT_PROVISIONAL_ROOT_DID}#atproto_pds`, type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example/' }] })).toBe('https://pds.example');
    expect(pdsEndpointFromDidDocument({ service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: 'http://127.0.0.1:3000' }] })).toBe('http://127.0.0.1:3000');
    expect(() => pdsEndpointFromDidDocument({ service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: 'http://pds.example' }] })).toThrow('HTTPS');
  });
});
