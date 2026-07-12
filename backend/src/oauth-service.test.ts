import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { computeRecordCid, type FoundationRecordValue } from './foundation-model.js';
import { buildOAuthScopes, createOAuthFetch, createPkceChallenge, decryptJson, encryptJson, parseEncryptionKey, PdsWriteError, validateHandoffReturnUri, writeDelegationRecord, writeSelfAuthoredRecord } from './oauth-service.js';

const did = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
const uri = `at://${did}/us.dsaslate.temp.publicEvent/event`;
const record: FoundationRecordValue = { $type: 'us.dsaslate.temp.publicEvent', hostEntity: 'at://did:plc:dsaslatetempreg234567abc/us.dsaslate.temp.orgEntity/entity', title: 'Public event', startsAt: '2026-07-20T00:00:00.000Z', mode: 'online', status: 'scheduled', createdAt: '2026-07-09T00:00:00.000Z' };
const cid = computeRecordCid(record);

describe('encrypted OAuth state', () => {
  it('declares registry permission without requesting it for ordinary user login', () => {
    const scopes = buildOAuthScopes('did:web:api.staging.dsaslate.us');
    expect(scopes.declaredScope).toContain('include:us.dsaslate.temp.authRegistryPublish');
    expect(scopes.declaredScope).toContain('include:us.dsaslate.temp.authManageDelegations');
    expect(scopes.userScope).not.toContain('authRegistryPublish');
    expect(scopes.userScope).not.toContain('authManageDelegations');
    expect(scopes.registryScope).toBe('atproto include:us.dsaslate.temp.authRegistryPublish');
    expect(scopes.delegationScope).toBe('atproto include:us.dsaslate.temp.authManageDelegations');
    expect(scopes.eventScope).toBe('atproto include:us.dsaslate.temp.authPublishEvents');
    expect(scopes.participantScope).toBe('atproto');
  });

  it('routes only the configured public PDS origin over the private service network', async () => {
    const baseFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const oauthFetch = createOAuthFetch('https://pds-staging.dsaslate.us', 'http://pds:3000', baseFetch);

    await oauthFetch('https://pds-staging.dsaslate.us/.well-known/oauth-protected-resource?test=1');
    const privateRequest = baseFetch.mock.calls[0][0] as Request;
    expect(privateRequest.url).toBe('http://pds:3000/.well-known/oauth-protected-resource?test=1');
    expect(privateRequest.headers.get('x-forwarded-host')).toBe('pds-staging.dsaslate.us');
    expect(privateRequest.headers.get('x-forwarded-proto')).toBe('https');

    await oauthFetch('https://plc.directory/did:plc:aaaaaaaaaaaaaaaaaaaaaaaa');
    expect((baseFetch.mock.calls[1][0] as Request).url).toBe('https://plc.directory/did:plc:aaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('round trips state with authenticated encryption', () => {
    const key = randomBytes(32);
    const encrypted = encryptJson({ access: 'secret', nested: { dpop: true } }, key, 'session:key');
    expect(encrypted.ciphertext.toString('utf8')).not.toContain('secret');
    expect(decryptJson(encrypted, key, 'session:key')).toEqual({ access: 'secret', nested: { dpop: true } });
    expect(() => decryptJson(encrypted, key, 'state:other')).toThrow();
  });

  it('requires a 256-bit encryption key', () => {
    expect(() => parseEncryptionKey(randomBytes(31))).toThrow('32 bytes');
    expect(parseEncryptionKey(randomBytes(32))).toHaveLength(32);
  });

  it('binds handoff returns to an allowlisted HTTPS origin and PKCE verifier', () => {
    expect(validateHandoffReturnUri('https://organize.example.test/oauth/callback', ['https://organize.example.test'])).toBe('https://organize.example.test/oauth/callback');
    expect(() => validateHandoffReturnUri('https://evil.example.test/oauth/callback', ['https://organize.example.test'])).toThrow('allowlisted');
    expect(() => validateHandoffReturnUri('http://organize.example.test/oauth/callback', ['https://organize.example.test'])).toThrow('HTTPS');
    expect(createPkceChallenge('a'.repeat(43))).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('creates, updates, and deletes through the PDS with CID concurrency', async () => {
    const updated = { ...record, title: 'Updated public event' };
    const updatedCid = computeRecordCid(updated);
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ uri, cid, commit: { rev: 'one' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ uri, cid: updatedCid, commit: { rev: 'two' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ commit: { rev: 'three' } }), { status: 200 }));

    await expect(writeSelfAuthoredRecord(fetch, did, { action: 'create', collection: 'us.dsaslate.temp.publicEvent', record })).resolves.toMatchObject({ action: 'create', uri, cid });
    await expect(writeSelfAuthoredRecord(fetch, did, { action: 'update', uri, expectedCid: cid, record: updated })).resolves.toMatchObject({ action: 'update', uri, cid: updatedCid });
    await expect(writeSelfAuthoredRecord(fetch, did, { action: 'delete', uri, expectedCid: updatedCid })).resolves.toMatchObject({ action: 'delete', uri });

    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ repo: did, collection: 'us.dsaslate.temp.publicEvent', record });
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ repo: did, collection: 'us.dsaslate.temp.publicEvent', rkey: 'event', record: updated, swapRecord: cid });
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toEqual({ repo: did, collection: 'us.dsaslate.temp.publicEvent', rkey: 'event', swapRecord: updatedCid });
  });

  it('limits handoff writes to authority delegations', async () => {
    const delegation = { $type: 'us.dsaslate.temp.authorityDelegation' as const, delegateDid: 'did:plc:bbbbbbbbbbbbbbbbbbbbbbbb', entityUris: ['at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/us.dsaslate.temp.orgEntity/chapter'], collections: ['us.dsaslate.temp.publicEvent'], actions: ['create'], effectiveFrom: '2026-07-10T00:00:00.000Z', createdAt: '2026-07-10T00:00:00.000Z' };
    const delegationCid = computeRecordCid(delegation);
    const delegationUri = `at://${did}/us.dsaslate.temp.authorityDelegation/delegation`;
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ uri: delegationUri, cid: delegationCid }), { status: 200 }));

    await expect(writeDelegationRecord(fetch, did, { action: 'create', collection: 'us.dsaslate.temp.authorityDelegation', record: delegation })).resolves.toMatchObject({ uri: delegationUri, cid: delegationCid });
    await expect(writeDelegationRecord(fetch, did, { action: 'create', collection: 'us.dsaslate.temp.publicEvent', record })).rejects.toThrow('not writable for this authorization');
  });

  it('rejects envelope fields, foreign targets, and PDS swap conflicts', async () => {
    const fetch = vi.fn();
    await expect(writeSelfAuthoredRecord(fetch, did, { action: 'create', collection: 'us.dsaslate.temp.publicEvent', record: { ...record, trustLabel: 'official' } })).rejects.toThrow('client-controlled trustLabel');
    await expect(writeSelfAuthoredRecord(fetch, did, { action: 'delete', uri: `at://did:plc:bbbbbbbbbbbbbbbbbbbbbbbb/us.dsaslate.temp.publicEvent/event`, expectedCid: cid })).rejects.toThrow('authenticated DID');

    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'InvalidSwap' }), { status: 400 }));
    await expect(writeSelfAuthoredRecord(fetch, did, { action: 'delete', uri, expectedCid: cid })).rejects.toEqual(expect.objectContaining<Partial<PdsWriteError>>({ status: 400, code: 'InvalidSwap' }));
  });
});
