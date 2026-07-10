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
});
