import { describe, expect, it, vi } from 'vitest';
import { createFoundationRecord, DEFAULT_BOOTSTRAP_REPO_REV, DEFAULT_PROVISIONAL_ROOT_DID } from './foundation-model.js';
import { publishFoundationRecords } from './foundation-publisher.js';

describe('canonical PDS publisher', () => {
  it('submits record content and lets the PDS return the envelope', async () => {
    const source = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgEntity/entity`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: DEFAULT_BOOTSTRAP_REPO_REV, sequence: 1, observedAt: '2026-07-09T00:00:00.000Z', status: 'unverified',
      record: { $type: 'us.dsaslate.temp.orgEntity', displayName: 'Entity', entityType: 'organization', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const fetchHandler = vi.fn(async (_pathname: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).not.toHaveProperty('cid');
      expect(body).not.toHaveProperty('trustLabel');
      expect(body).toEqual({ repo: DEFAULT_PROVISIONAL_ROOT_DID, collection: 'us.dsaslate.temp.orgEntity', rkey: 'entity', record: source.record });
      return new Response(JSON.stringify({ uri: source.uri, cid: source.cid, commit: { rev: 'next' } }), { status: 200 });
    });

    await expect(publishFoundationRecords(fetchHandler, DEFAULT_PROVISIONAL_ROOT_DID, [source])).resolves.toEqual([{ uri: source.uri, cid: source.cid, commit: { rev: 'next' } }]);
    expect(fetchHandler).toHaveBeenCalledOnce();
  });
});
