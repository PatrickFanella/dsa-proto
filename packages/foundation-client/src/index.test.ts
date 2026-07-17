import { describe, expect, it, vi } from 'vitest';
import { FoundationClient, FoundationClientError } from './index.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-request-id': 'request-1' } });
}

describe('FoundationClient', () => {
  it('follows opaque entity cursors without exposing page mechanics to apps', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ entities: [{ entityUri: 'at://did:plc:a/us.dsaslate.temp.orgEntity/a' }], cursor: 'next-page' }))
      .mockResolvedValueOnce(jsonResponse({ entities: [{ entityUri: 'at://did:plc:b/us.dsaslate.temp.orgEntity/b' }] }));
    const client = new FoundationClient('https://api-staging.dsaslate.us', { fetch });

    await expect(client.listAllEntities({ limit: 50 })).resolves.toHaveLength(2);
    expect(String(fetch.mock.calls[0][0])).toBe('https://api-staging.dsaslate.us/xrpc/us.dsaslate.temp.listEntities?limit=50');
    expect(String(fetch.mock.calls[1][0])).toBe('https://api-staging.dsaslate.us/xrpc/us.dsaslate.temp.listEntities?limit=50&cursor=next-page');
  });

  it('rejects repeated cursors and exposes structured AppView errors', async () => {
    const looping = vi.fn().mockImplementation(async () => jsonResponse({ entities: [], cursor: 'same' }));
    const loopClient = new FoundationClient('https://api.example', { fetch: looping });
    await expect(loopClient.listAllEntities()).rejects.toMatchObject({ code: 'cursor_loop', retryable: true });

    const failed = new FoundationClient('https://api.example', { fetch: vi.fn().mockResolvedValue(jsonResponse({ error: 'InvalidCursor', message: 'bad cursor', retryable: false }, 400)) });
    await expect(failed.listEntities({ cursor: 'bad' })).rejects.toEqual(expect.objectContaining<Partial<FoundationClientError>>({ status: 400, code: 'InvalidCursor', message: 'bad cursor', requestId: 'request-1', retryable: false }));
  });

  it('sends review content to the canonical procedure with same-origin credentials', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ operation: { operationId: 'op-1', submitterDid: 'did:plc:test', collection: 'us.dsaslate.temp.publicEvent', status: 'pending', createdAt: '2026-07-09T00:00:00.000Z', updatedAt: '2026-07-09T00:00:00.000Z' } }));
    const client = new FoundationClient('https://app-staging.dsaslate.us', { fetch });
    await client.submitForReview({ collection: 'us.dsaslate.temp.publicEvent', record: { $type: 'us.dsaslate.temp.publicEvent' } });
    expect(fetch).toHaveBeenCalledWith(new URL('https://app-staging.dsaslate.us/xrpc/us.dsaslate.temp.submitForReview'), expect.objectContaining({ method: 'POST', credentials: 'same-origin' }));
  });

  it('discovers sessions, writes with credentials, and waits for AppView observation', async () => {
    const uri = 'at://did:plc:test/us.dsaslate.temp.publicEvent/event';
    const cid = 'bafyreig5n5cwqv6pqtdbikv7hqxwkehu3hrr5wwx7vme2m4rsvh5phq4qu';
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ contractVersion: 'v1', data: { oauthEnabled: true, authenticated: true, did: 'did:plc:test', capabilities: { selfWrite: true, reviewSubmission: true, registryReview: false, collections: ['us.dsaslate.temp.publicEvent'], actions: ['create', 'update', 'delete'] } } }))
      .mockResolvedValueOnce(jsonResponse({ contractVersion: 'v1', data: { action: 'create', uri, cid } }, 201))
      .mockResolvedValueOnce(jsonResponse({ uri, authority: { status: 'unresolved' } }))
      .mockResolvedValueOnce(jsonResponse({ uri, provenance: { cid }, authority: { status: 'selfAsserted' } }));
    const client = new FoundationClient('https://app-staging.dsaslate.us', { fetch, credentials: 'include' });
    await expect(client.getSession()).resolves.toMatchObject({ authenticated: true, capabilities: { selfWrite: true } });
    const record = { $type: 'us.dsaslate.temp.publicEvent' as const, hostEntity: 'at://did:plc:root/us.dsaslate.temp.orgEntity/entity' as const, title: 'Event', startsAt: '2026-07-20T00:00:00.000Z' as const, mode: 'online' as const, status: 'scheduled' as const, createdAt: '2026-07-09T00:00:00.000Z' as const };
    const write = await client.writeRecord({ action: 'create', collection: 'us.dsaslate.temp.publicEvent', record });
    await expect(client.waitForObservation(write, { intervalMs: 0, timeoutMs: 100 })).resolves.toMatchObject({ provenance: { cid } });
    expect(fetch.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'POST', credentials: 'include' }));
    expect(client.loginUrl('chapter.example').toString()).toBe('https://app-staging.dsaslate.us/oauth/login?handle=chapter.example');
  });

  it('observes deletions and times out cleanly when indexing stalls', async () => {
    const uri = 'at://did:plc:test/us.dsaslate.temp.publicEvent/event';
    const deleted = new FoundationClient('https://api.example', { fetch: vi.fn().mockResolvedValue(jsonResponse({ uri, deletedAt: '2026-07-09T00:00:00.000Z', authority: { status: 'unresolved' } })) });
    await expect(deleted.waitForObservation({ action: 'delete', uri }, { intervalMs: 0, timeoutMs: 10 })).resolves.toMatchObject({ deletedAt: '2026-07-09T00:00:00.000Z' });

    const stalled = new FoundationClient('https://api.example', { fetch: vi.fn().mockImplementation(async () => jsonResponse({ uri, authority: { status: 'unresolved' } })) });
    await expect(stalled.waitForObservation({ action: 'create', uri, cid: 'bafy-missing' }, { intervalMs: 0, timeoutMs: 1 })).rejects.toMatchObject({ code: 'observation_timeout', retryable: true });
  });

  it('generates a 128-bit state and S256 PKCE identity handoff, and validates exact exchange payloads', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ did: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa', audience: 'https://chat.example.test', authenticatedAt: '2026-07-16T00:00:00.000Z', expiresIn: 60 }))
      .mockResolvedValueOnce(jsonResponse({ did: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa', audience: 'https://chat.example.test', authenticatedAt: '2026-07-16T00:00:00.000Z', expiresIn: 60, accessToken: 'forbidden' }));
    const client = new FoundationClient('https://api.example', { fetch });
    const begin = await client.beginIdentityHandoff({ handle: 'chapter.example', audience: 'https://chat.example.test', returnUri: 'https://chat.example.test/callback' });
    expect(begin.state).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(begin.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(begin.state, 'base64url')).toHaveLength(16);
    expect(Buffer.from(begin.verifier, 'base64url')).toHaveLength(32);
    expect(begin.authorizationUrl.searchParams.get('code_challenge')).toBe(Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(begin.verifier))).toString('base64url'));
    await expect(client.exchangeIdentityHandoff({ code: 'c'.repeat(43), verifier: begin.verifier, audience: 'https://chat.example.test' })).resolves.toEqual(expect.objectContaining({ expiresIn: 60 }));
    await expect(client.exchangeIdentityHandoff({ code: 'c'.repeat(43), verifier: begin.verifier, audience: 'https://chat.example.test' })).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('validates identity handoff inputs before constructing its authorization URL', async () => {
    const client = new FoundationClient('https://api.example');
    await expect(client.beginIdentityHandoff({ handle: '', audience: 'https://chat.example.test', returnUri: 'https://chat.example.test/callback' })).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(client.beginIdentityHandoff({ handle: 'chapter.example', audience: 'http://chat.example.test', returnUri: 'https://chat.example.test/callback' })).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(client.beginIdentityHandoff({ handle: 'chapter.example', audience: 'https://chat.example.test/path', returnUri: 'https://chat.example.test/callback' })).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(client.beginIdentityHandoff({ handle: 'chapter.example', audience: 'https://chat.example.test', returnUri: 'https://other.example.test/callback' })).rejects.toMatchObject({ code: 'invalid_request' });

    const begin = await client.beginIdentityHandoff({ handle: ' chapter.example ', audience: 'https://chat.example.test', returnUri: 'https://chat.example.test/callback?next=home#discarded' });
    expect(begin.authorizationUrl.searchParams.get('handle')).toBe('chapter.example');
    expect(begin.authorizationUrl.searchParams.get('return_uri')).toBe('https://chat.example.test/callback?next=home');
  });

  it('rejects an identity response bound to a different audience', async () => {
    const client = new FoundationClient('https://api.example', { fetch: vi.fn().mockResolvedValue(jsonResponse({ did: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa', audience: 'https://other.example.test', authenticatedAt: '2026-07-16T00:00:00.000Z', expiresIn: 60 })) });
    await expect(client.exchangeIdentityHandoff({ code: 'c'.repeat(43), verifier: 'v'.repeat(43), audience: 'https://chat.example.test' })).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it.each([
    [{ code: 'short', verifier: 'v'.repeat(43), audience: 'https://chat.example.test' }],
    [{ code: 'c'.repeat(43), verifier: 'short', audience: 'https://chat.example.test' }],
    [{ code: 'c'.repeat(43), verifier: 'v'.repeat(43), audience: 'https://chat.example.test/path' }],
  ])('rejects invalid identity exchange input locally before fetch', async (input) => {
    const fetch = vi.fn();
    const client = new FoundationClient('https://api.example', { fetch });
    await expect(client.exchangeIdentityHandoff(input)).rejects.toMatchObject<Partial<FoundationClientError>>({ status: 400, code: 'invalid_request', retryable: false });
    expect(fetch).not.toHaveBeenCalled();
  });
});
