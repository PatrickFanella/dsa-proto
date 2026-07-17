import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { computeRecordCid, type FoundationRecordValue } from './foundation-model.js';
import { buildOAuthScopes, createNonPersistentIdentitySessionStore, createOAuthFetch, createPkceChallenge, decryptJson, EncryptedPostgresStore, encryptJson, OAuthService, parseEncryptionKey, PdsWriteError, validateHandoffReturnUri, validateIdentityHandoff, writeDelegationRecord, writeSelfAuthoredRecord } from './oauth-service.js';
import type { Pool } from 'pg';

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

  it('bounds identity authorization state with TTL filtering and cleanup without changing normal stores', async () => {
    const identityQuery = vi.fn().mockResolvedValue({ rows: [] });
    const identityStore = new EncryptedPostgresStore({ query: identityQuery } as unknown as Pool, 'identity-state', randomBytes(32), 5 * 60 * 1000);
    await identityStore.set('pending', { dpop: 'transient' });
    await identityStore.get('pending');
    expect(identityQuery.mock.calls[0]).toEqual([expect.stringContaining("delete from oauth_encrypted_store_v1 where namespace = $1 and updated_at <= now() - ($2 * interval '1 millisecond')"), ['identity-state', 5 * 60 * 1000]]);
    expect(identityQuery.mock.calls[3]).toEqual([expect.stringContaining("updated_at > now() - ($3 * interval '1 millisecond')"), expect.any(Array)]);
    expect(identityQuery.mock.calls[3][1][2]).toBe(5 * 60 * 1000);

    const normalQuery = vi.fn().mockResolvedValue({ rows: [] });
    const normalStore = new EncryptedPostgresStore({ query: normalQuery } as unknown as Pool, 'state', randomBytes(32));
    await normalStore.get('ordinary-login');
    expect(normalQuery).toHaveBeenCalledOnce();
    expect(normalQuery.mock.calls[0][0]).not.toContain('updated_at');
  });

  it('binds handoff returns to an allowlisted HTTPS origin and PKCE verifier', () => {
    expect(validateHandoffReturnUri('https://organize.example.test/oauth/callback', ['https://organize.example.test'])).toBe('https://organize.example.test/oauth/callback');
    expect(() => validateHandoffReturnUri('https://evil.example.test/oauth/callback', ['https://organize.example.test'])).toThrow('allowlisted');
    expect(() => validateHandoffReturnUri('http://organize.example.test/oauth/callback', ['https://organize.example.test'])).toThrow('HTTPS');
    expect(createPkceChallenge('a'.repeat(43))).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('keeps identity handoffs HTTPS, allowlisted, origin-bound, and S256-bound', () => {
    expect(validateIdentityHandoff({ audience: 'https://chat.example.test', returnUri: 'https://chat.example.test/oauth/callback#discarded', clientState: 'a'.repeat(22), codeChallenge: createPkceChallenge('v'.repeat(43)) }, ['https://chat.example.test'])).toEqual({ audience: 'https://chat.example.test', returnUri: 'https://chat.example.test/oauth/callback' });
    expect(() => validateIdentityHandoff({ audience: 'https://chat.example.test/path', returnUri: 'https://chat.example.test/callback', clientState: 'a'.repeat(22), codeChallenge: 'a'.repeat(43) }, ['https://chat.example.test'])).toThrow('invalid_request');
    expect(() => validateIdentityHandoff({ audience: 'https://chat.example.test', returnUri: 'http://chat.example.test/callback', clientState: 'a'.repeat(22), codeChallenge: 'a'.repeat(43) }, ['https://chat.example.test'])).toThrow('invalid_request');
    expect(() => validateIdentityHandoff({ audience: 'https://chat.example.test', returnUri: 'https://evil.example.test/callback', clientState: 'a'.repeat(22), codeChallenge: 'a'.repeat(43) }, ['https://chat.example.test'])).toThrow('invalid_request');
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

describe('identity handoff persistence', () => {
  function identityClient(state?: string) {
    return { authorize: vi.fn(), callback: vi.fn().mockResolvedValue({ state, session: { did } }) };
  }

  function transactionPool(query: ReturnType<typeof vi.fn>) {
    const client = { query, release: vi.fn() };
    return { pool: { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool, client };
  }

  it('uses callback.result.state and atomically consumes the request and issues a credential-free code', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] }) // begin
      .mockResolvedValueOnce({ rows: [] }) // expired code cleanup
      .mockResolvedValueOnce({ rows: [{ return_uri: 'https://chat.example.test/callback', client_state: 'a'.repeat(22) }] })
      .mockResolvedValueOnce({ rows: [] }); // commit
    const { pool, client } = transactionPool(query);
    const oauthClient = identityClient('callback-state');
    const service = OAuthService.forIdentityTesting(pool, oauthClient);
    const location = await service.completeIdentity(new URLSearchParams({ state: 'attacker-state' }));

    expect(oauthClient.callback).toHaveBeenCalledWith(expect.any(URLSearchParams));
    expect(query.mock.calls[2][1][0]).not.toContain('attacker-state');
    expect(query.mock.calls[1][0]).toMatch(/delete from oauth_identity_codes_v1 where expires_at <= now\(\)/i);
    expect(query.mock.calls[2][0]).toContain('delete from oauth_identity_requests_v1');
    expect(query.mock.calls[2][0]).toContain('insert into oauth_identity_codes_v1');
    expect(query.mock.calls[2][0]).toContain("now() + interval '60 seconds'");
    expect(query.mock.calls[2][0]).not.toMatch(/access_token|refresh_token|dpop|cookie|session/i);
    expect(query.mock.calls.map((call) => call[0])).toEqual(['begin', expect.any(String), expect.any(String), 'commit']);
    expect(client.release).toHaveBeenCalledOnce();
    expect(new URL(location).searchParams.get('state')).toBe('a'.repeat(22));
  });

  it.each([
    ['missing correlation', { rows: [] }],
    ['failed code insertion', new Error('database failed')],
  ])('rolls back and releases on %s', async (_name, outcome) => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] });
    if (outcome instanceof Error) query.mockRejectedValueOnce(outcome);
    else query.mockResolvedValueOnce(outcome);
    const { pool, client } = transactionPool(query);
    await expect(OAuthService.forIdentityTesting(pool, identityClient('callback-state')).completeIdentity(new URLSearchParams())).rejects.toBeInstanceOf(Error);
    expect(query.mock.calls.map((call) => call[0])).toContain('rollback');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('fails closed before opening a transaction without callback correlation', async () => {
    const query = vi.fn(); const { pool, client } = transactionPool(query);
    await expect(OAuthService.forIdentityTesting(pool, identityClient()).completeIdentity(new URLSearchParams())).rejects.toMatchObject({ code: 'invalid_correlation' });
    expect(query).not.toHaveBeenCalled(); expect(client.release).not.toHaveBeenCalled();
  });

  it('cleans expired rows, locks, validates S256 and canonical audience, deletes before commit, and returns only four fields', async () => {
    const verifier = 'v'.repeat(43);
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ account_did: did, audience: 'https://chat.example.test', code_challenge: createPkceChallenge(verifier), authenticated_at: '2026-07-16T00:00:00.000Z' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const { pool, client } = transactionPool(query);
    const result = await OAuthService.forIdentityTesting(pool, identityClient()).exchangeIdentity('c'.repeat(43), verifier, 'https://chat.example.test');
    expect(query.mock.calls[1][0]).toMatch(/delete from oauth_identity_codes_v1 where expires_at <= now\(\)/i);
    expect(query.mock.calls[2][0]).toMatch(/for update/i);
    expect(query.mock.calls[3][0]).toMatch(/delete from oauth_identity_codes_v1 where code_hash=\$1/i);
    expect(query.mock.calls.map((call) => call[0])).toEqual(['begin', expect.any(String), expect.any(String), expect.any(String), 'commit']);
    expect(Object.keys(result).sort()).toEqual(['audience', 'authenticatedAt', 'did', 'expiresIn']);
    expect(result.expiresIn).toBe(60); expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects noncanonical audiences before lookup and rolls back invalid or replayed codes', async () => {
    const query = vi.fn(); const first = transactionPool(query);
    await expect(OAuthService.forIdentityTesting(first.pool, identityClient()).exchangeIdentity('c'.repeat(43), 'v'.repeat(43), 'https://chat.example.test/path')).rejects.toMatchObject({ code: 'invalid_request' });
    expect(first.pool.connect).not.toHaveBeenCalled();

    const replayQuery = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    const replay = transactionPool(replayQuery);
    await expect(OAuthService.forIdentityTesting(replay.pool, identityClient()).exchangeIdentity('c'.repeat(43), 'v'.repeat(43), 'https://chat.example.test')).rejects.toMatchObject({ code: 'invalid_code' });
    expect(replayQuery.mock.calls.map((call) => call[0])).toEqual(['begin', expect.any(String), expect.any(String), 'rollback']);
  });

  it('never persists identity OAuth sessions', async () => {
    const store = createNonPersistentIdentitySessionStore();
    await expect(store.get('identity')).resolves.toBeUndefined();
    await store.set('identity', { accessToken: 'forbidden' } as never);
    await store.del('identity');
    await expect(store.get('identity')).resolves.toBeUndefined();
  });
});
