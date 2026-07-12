import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, createMemoryRepository } from './server.js';
import { OAuthService, PdsWriteError } from './oauth-service.js';

describe('foundation XRPC and REST contracts', () => {
  let server: ReturnType<typeof createApp> | undefined;

  afterEach(() => server?.close());

  async function start(options: Parameters<typeof createApp>[1] = {}, repository = createMemoryRepository()) {
    server = createApp(repository, options);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing port');
    return `http://127.0.0.1:${address.port}`;
  }

  it('keeps list output equivalent across XRPC and REST v1', async () => {
    const origin = await start({ DEMO_READ_ONLY: true });
    const xrpc = await fetch(`${origin}/xrpc/us.dsaslate.temp.listEntities?limit=2`).then((response) => response.json() as Promise<{ entities: unknown[]; cursor?: string }>);
    const rest = await fetch(`${origin}/api/v1/entities?limit=2`).then((response) => response.json() as Promise<{ contractVersion: string; data: unknown[]; cursor?: string }>);

    expect(rest.contractVersion).toBe('v1');
    const omitEvaluationTime = (value: unknown) => JSON.parse(JSON.stringify(value), (key, item) => key === 'evaluatedAt' ? undefined : item);
    expect(omitEvaluationTime(rest.data)).toEqual(omitEvaluationTime(xrpc.entities));
    expect(rest.cursor).toBe(xrpc.cursor);
  });

  it('keeps every public read handler equivalent across XRPC and REST v1', async () => {
    const origin = await start({ DEMO_READ_ONLY: true });
    const normalize = (value: unknown) => JSON.parse(JSON.stringify(value), (key, item) => key === 'evaluatedAt' ? undefined : item);
    const page = await fetch(`${origin}/xrpc/us.dsaslate.temp.listEntities?limit=1`).then((response) => response.json() as Promise<{ entities: Array<{ entityUri: string }> }>);
    const entityUri = page.entities[0].entityUri;
    const pairs = [
      [`/xrpc/us.dsaslate.temp.getEntity?entityUri=${encodeURIComponent(entityUri)}`, `/api/v1/entities/${encodeURIComponent(entityUri)}`, 'entity'],
      ['/xrpc/us.dsaslate.temp.getOrgGraph?limit=3', '/api/v1/org-graph?limit=3', 'graph'],
      [`/xrpc/us.dsaslate.temp.resolveAuthority?uri=${encodeURIComponent(entityUri)}`, `/api/v1/records/resolve?uri=${encodeURIComponent(entityUri)}`, 'direct'],
      ['/xrpc/us.dsaslate.temp.listActivity?limit=3', '/api/v1/activity?limit=3', 'items'],
      ['/xrpc/us.dsaslate.temp.getSyncStatus', '/api/v1/sync/status', 'sync'],
    ] as const;
    for (const [xrpcPath, restPath, shape] of pairs) {
      const [xrpc, rest] = await Promise.all([
        fetch(`${origin}${xrpcPath}`).then((response) => response.json() as Promise<Record<string, unknown>>),
        fetch(`${origin}${restPath}`).then((response) => response.json() as Promise<{ data: unknown }>),
      ]);
      const expected = shape === 'entity' ? xrpc.entity
        : shape === 'graph' ? { entities: xrpc.entities, relationships: xrpc.relationships }
          : shape === 'items' ? xrpc.items
            : shape === 'sync' ? xrpc.sync
              : xrpc;
      expect(normalize(rest.data)).toEqual(normalize(expected));
    }
  });

  it('returns opaque cursors and never promotes temporary records to official', async () => {
    const origin = await start({ DEMO_READ_ONLY: true });
    const first = await fetch(`${origin}/xrpc/us.dsaslate.temp.listEntities?limit=1`).then((response) => response.json() as Promise<{ entities: Array<{ authority: { status: string } }>; cursor?: string }>);

    expect(first.entities).toHaveLength(1);
    expect(first.entities[0].authority.status).toBe('provisional');
    expect(first.cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    const second = await fetch(`${origin}/xrpc/us.dsaslate.temp.listEntities?limit=1&cursor=${encodeURIComponent(first.cursor!)}`);
    expect(second.status).toBe(200);
  });

  it('enforces cursor, pagination, and rate-limit contracts', async () => {
    const origin = await start({ DEMO_READ_ONLY: true, PUBLIC_RATE_LIMIT_PER_MINUTE: 3 });
    const invalidCursor = await fetch(`${origin}/xrpc/us.dsaslate.temp.listEntities?cursor=not-a-cursor`);
    expect(invalidCursor.status).toBe(400);
    expect(await invalidCursor.json()).toMatchObject({ error: 'InvalidCursor', retryable: false });
    const invalidLimit = await fetch(`${origin}/api/v1/entities?limit=101`);
    expect(invalidLimit.status).toBe(400);
    const limited = await fetch(`${origin}/health`);
    expect(limited.status).toBe(200);
    const rateLimited = await fetch(`${origin}/health`);
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.headers.get('retry-after')).toBe('60');
  });

  it('fails closed when review OAuth verification is unavailable', async () => {
    const origin = await start({ ENABLE_REVIEW_SUBMISSIONS: true });
    const response = await fetch(`${origin}/xrpc/us.dsaslate.temp.submitForReview`, { method: 'POST' });
    expect(response.status).toBe(401);
  });

  it('reports OAuth availability and authenticated write capabilities', async () => {
    const disabledOrigin = await start();
    await expect(fetch(`${disabledOrigin}/api/v1/session`).then((response) => response.json())).resolves.toMatchObject({ data: { oauthEnabled: false, authenticated: false, capabilities: { selfWrite: false } } });
    server?.close();

    const repository = createMemoryRepository();
    repository.oauthService = {
      getBrowserSession: async () => ({ did: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa', expiresAt: '2026-07-10T00:00:00.000Z' }),
    } as unknown as OAuthService;
    const enabledOrigin = await start({}, repository);
    await expect(fetch(`${enabledOrigin}/api/v1/session`).then((response) => response.json())).resolves.toMatchObject({ data: { oauthEnabled: true, authenticated: true, did: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa', capabilities: { selfWrite: true, actions: ['create', 'update', 'delete'] } } });
  });

  it('routes CID-safe self writes and maps PDS swap failures to conflicts', async () => {
    const writeSelfAuthoredRecord = vi.fn().mockResolvedValue({ action: 'create', uri: 'at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/us.dsaslate.temp.publicEvent/event', cid: 'bafyreig5n5cwqv6pqtdbikv7hqxwkehu3hrr5wwx7vme2m4rsvh5phq4qu' });
    const repository = createMemoryRepository();
    repository.oauthService = {
      assertTrustedOrigin: vi.fn(),
      authenticateRequest: async () => 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa',
      writeSelfAuthoredRecord,
    } as unknown as OAuthService;
    const origin = await start({}, repository);
    const input = { action: 'create', collection: 'us.dsaslate.temp.publicEvent', record: { $type: 'us.dsaslate.temp.publicEvent', hostEntity: 'at://did:plc:dsaslatetempreg234567abc/us.dsaslate.temp.orgEntity/entity', title: 'Event', startsAt: '2026-07-20T00:00:00.000Z', mode: 'online', status: 'scheduled', createdAt: '2026-07-09T00:00:00.000Z' } };
    const created = await fetch(`${origin}/api/v1/self/records`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    expect(created.status).toBe(201);
    expect(writeSelfAuthoredRecord).toHaveBeenCalledWith('did:plc:aaaaaaaaaaaaaaaaaaaaaaaa', input);

    writeSelfAuthoredRecord.mockRejectedValueOnce(new PdsWriteError(400, 'InvalidSwap', 'update'));
    const conflicted = await fetch(`${origin}/api/v1/self/records`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update', uri: 'at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/us.dsaslate.temp.publicEvent/event', expectedCid: 'bafyreig5n5cwqv6pqtdbikv7hqxwkehu3hrr5wwx7vme2m4rsvh5phq4qu', record: input.record }) });
    expect(conflicted.status).toBe(409);
    await expect(conflicted.json()).resolves.toMatchObject({ error: 'record_conflict', retryable: false });
  });

  it('routes PKCE delegation handoff exchange and one-time writes', async () => {
    const begin = vi.fn().mockResolvedValue(new URL('https://pds.example.test/authorize'));
    const exchangeHandoff = vi.fn().mockResolvedValue({ accessToken: 'handoff-token', did: 'did:plc:chapter', expiresIn: 300, permissionSet: 'us.dsaslate.temp.authManageDelegations' });
    const writeHandoffDelegation = vi.fn().mockResolvedValue({ action: 'create', uri: 'at://did:plc:chapter/us.dsaslate.temp.authorityDelegation/organizer', cid: 'bafyreidelegation' });
    const repository = createMemoryRepository();
    repository.oauthService = { begin, exchangeHandoff, writeHandoffDelegation } as unknown as OAuthService;
    const origin = await start({}, repository);
    const login = await fetch(`${origin}/oauth/login?handle=chapter.example.test&mode=delegations&handoff_return_uri=${encodeURIComponent('https://organize.example.test/oauth/callback')}&handoff_state=client-state-1234&handoff_challenge=${'a'.repeat(43)}`, { redirect: 'manual' });
    expect(login.status).toBe(302);
    expect(begin).toHaveBeenCalledWith('chapter.example.test', 'delegations', {
      returnUri: 'https://organize.example.test/oauth/callback',
      clientState: 'client-state-1234',
      codeChallenge: 'a'.repeat(43),
    });

    const exchanged = await fetch(`${origin}/oauth/handoff/exchange`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'one-time-code', verifier: 'v'.repeat(43) }) });
    expect(exchanged.status).toBe(200);
    await expect(exchanged.json()).resolves.toMatchObject({ access_token: 'handoff-token', did: 'did:plc:chapter', scope: 'us.dsaslate.temp.authManageDelegations' });

    const input = { action: 'create', collection: 'us.dsaslate.temp.authorityDelegation', record: { $type: 'us.dsaslate.temp.authorityDelegation' } };
    const published = await fetch(`${origin}/api/v1/delegation-handoff/records`, { method: 'POST', headers: { authorization: 'Bearer handoff-token', 'content-type': 'application/json' }, body: JSON.stringify(input) });
    expect(published.status).toBe(201);
    expect(writeHandoffDelegation).toHaveBeenCalledWith('handoff-token', input);
  });

  it('routes a distinct one-time event publication handoff', async () => {
    const begin = vi.fn().mockResolvedValue(new URL('https://pds.example.test/authorize'));
    const exchangeHandoff = vi.fn().mockResolvedValue({ accessToken: 'event-token', did: 'did:plc:organizer', expiresIn: 300, permissionSet: 'us.dsaslate.temp.authPublishEvents' });
    const writeHandoffEvent = vi.fn().mockResolvedValue({ action: 'create', uri: 'at://did:plc:organizer/us.dsaslate.temp.publicEvent/event', cid: 'bafyreievent' });
    const repository = createMemoryRepository();
    repository.oauthService = { begin, exchangeHandoff, writeHandoffEvent } as unknown as OAuthService;
    const origin = await start({}, repository);
    const login = await fetch(`${origin}/oauth/login?handle=organizer.example.test&mode=events&handoff_return_uri=${encodeURIComponent('https://organize.example.test/oauth/events/callback')}&handoff_state=client-state-1234&handoff_challenge=${'a'.repeat(43)}`, { redirect: 'manual' });
    expect(login.status).toBe(302);
    expect(begin).toHaveBeenCalledWith('organizer.example.test', 'events', expect.objectContaining({ returnUri: 'https://organize.example.test/oauth/events/callback' }));
    const exchanged = await fetch(`${origin}/oauth/handoff/exchange`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'one-time-code', verifier: 'v'.repeat(43) }) });
    await expect(exchanged.json()).resolves.toMatchObject({ scope: 'us.dsaslate.temp.authPublishEvents' });
    const input = { action: 'create', collection: 'us.dsaslate.temp.publicEvent', record: { $type: 'us.dsaslate.temp.publicEvent' } };
    const published = await fetch(`${origin}/api/v1/event-handoff/records`, { method: 'POST', headers: { authorization: 'Bearer event-token', 'content-type': 'application/json' }, body: JSON.stringify(input) });
    expect(published.status).toBe(201);
    expect(writeHandoffEvent).toHaveBeenCalledWith('event-token', input);
  });

  it('routes an identity-only participant handoff without a record-write endpoint', async () => {
    const begin = vi.fn().mockResolvedValue(new URL('https://pds.example.test/oauth/authorize'));
    const exchangeHandoff = vi.fn().mockResolvedValue({ did: 'did:plc:participant', expiresIn: 300, permissionSet: 'atproto' });
    const repository = createMemoryRepository();
    repository.oauthService = { begin, exchangeHandoff } as unknown as OAuthService;
    const origin = await start({}, repository);
    const login = await fetch(`${origin}/oauth/login?handle=member.example.test&mode=participant&handoff_return_uri=${encodeURIComponent('https://organize.example.test/oauth/participant/callback')}&handoff_state=client-state-1234&handoff_challenge=${'a'.repeat(43)}`, { redirect: 'manual' });
    expect(login.status).toBe(302);
    expect(begin).toHaveBeenCalledWith('member.example.test', 'participant', expect.any(Object));
    const exchanged = await fetch(`${origin}/oauth/handoff/exchange`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'one-time-code', verifier: 'v'.repeat(43) }) });
    await expect(exchanged.json()).resolves.toEqual({ did: 'did:plc:participant', expires_in: 300, scope: 'atproto' });
  });

  it('accepts record content for private review and rejects client authority fields', async () => {
    const submitterDid = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
    const origin = await start({ ENABLE_REVIEW_SUBMISSIONS: true, authenticateReviewRequest: () => submitterDid });
    const record = {
      $type: 'us.dsaslate.temp.publicEvent',
      hostEntity: 'at://did:plc:dsaslatetempreg234567abc/us.dsaslate.temp.orgEntity/entity',
      title: 'Public meeting',
      startsAt: '2026-07-20T00:00:00.000Z',
      mode: 'online',
      status: 'scheduled',
      createdAt: '2026-07-09T00:00:00.000Z',
    };
    const accepted = await fetch(`${origin}/xrpc/us.dsaslate.temp.submitForReview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ collection: record.$type, record }),
    });
    const acceptedBody = await accepted.json() as { operation: { operationId: string; status: string; record: unknown } };
    expect(accepted.status).toBe(202);
    expect(acceptedBody.operation).toMatchObject({ status: 'pending', record });

    const fetched = await fetch(`${origin}/xrpc/us.dsaslate.temp.getReviewOperation?operationId=${acceptedBody.operation.operationId}`);
    expect(fetched.status).toBe(200);
    const xrpcOperation = await fetched.json() as { operation: unknown };
    const restOperation = await fetch(`${origin}/api/v1/review/operations?operationId=${acceptedBody.operation.operationId}`).then((response) => response.json() as Promise<{ data: unknown }>);
    expect(restOperation.data).toEqual(xrpcOperation.operation);

    const rejected = await fetch(`${origin}/api/v1/review/operations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ collection: record.$type, record: { ...record, trustLabel: 'official' } }),
    });
    expect(rejected.status).toBe(400);
    expect(await rejected.text()).toContain('client-controlled trustLabel');
  });

  it('rejects request bodies larger than one MiB', async () => {
    const origin = await start({ ENABLE_REVIEW_SUBMISSIONS: true, authenticateReviewRequest: () => 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa' });
    const response = await fetch(`${origin}/api/v1/review/operations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(1024 * 1024) }),
    });
    expect(response.status).toBe(413);
  });
});
