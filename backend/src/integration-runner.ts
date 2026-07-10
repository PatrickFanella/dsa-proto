import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const config = z.object({
  INTEGRATION_API_URL: z.string().url().default('http://api:8080'),
  INTEGRATION_PDS_URL: z.string().url().default('http://pds:3000'),
  INTEGRATION_TAP_URL: z.string().url().default('http://pds:2480'),
  INTEGRATION_TAP_ADMIN_PASSWORD: z.string().min(1),
  INTEGRATION_ROOT_STATE_FILE: z.string().default('/run/local-root/root.json'),
}).parse(process.env);

type RootSession = { accessJwt: string; did: string; handle: string };
type WriteResult = { uri: string; cid: string; commit?: { rev?: string } };
type Resolution = { uri: string; provenance?: { cid?: string }; deletedAt?: string; authority?: { status?: string } };

async function waitFor(url: string, init?: RequestInit, attempts = 90) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      lastStatus = response.status;
      if (response.ok) return response;
    } catch {
      // The networked stack may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${url} did not become ready; last status ${lastStatus}`);
}

async function pdsWrite(session: RootSession, method: string, body: unknown) {
  const response = await fetch(`${config.INTEGRATION_PDS_URL}/xrpc/${method}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${session.accessJwt}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} failed with HTTP ${response.status}: ${await response.text()}`);
  return response.json() as Promise<WriteResult>;
}

async function waitForResolution(uri: string, predicate: (resolution: Resolution) => boolean, attempts = 90) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(`${config.INTEGRATION_API_URL}/xrpc/us.dsaslate.temp.resolveAuthority?uri=${encodeURIComponent(uri)}`);
    if (response.ok) {
      const resolution = await response.json() as Resolution;
      if (predicate(resolution)) return resolution;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`AppView did not observe the expected state for ${uri}`);
}

const tapAuthorization = `Basic ${Buffer.from(`admin:${config.INTEGRATION_TAP_ADMIN_PASSWORD}`).toString('base64')}`;
await Promise.all([
  waitFor(`${config.INTEGRATION_API_URL}/ready`),
  waitFor(`${config.INTEGRATION_PDS_URL}/xrpc/_health`),
  waitFor(`${config.INTEGRATION_TAP_URL}/health`, { headers: { authorization: tapAuthorization } }),
]);

const session = z.object({ accessJwt: z.string(), did: z.string(), handle: z.string() }).parse(JSON.parse(await readFile(config.INTEGRATION_ROOT_STATE_FILE, 'utf8'))) as RootSession;
const createdAt = new Date().toISOString();
const entity = await pdsWrite(session, 'com.atproto.repo.createRecord', {
  repo: session.did,
  collection: 'us.dsaslate.temp.orgEntity',
  validate: false,
  record: { $type: 'us.dsaslate.temp.orgEntity', displayName: 'Local Integration Chapter', entityType: 'organization', createdAt },
});
const entityResolution = await waitForResolution(entity.uri, (value) => value.provenance?.cid === entity.cid && value.authority?.status === 'provisional');

const eventRecord = {
  $type: 'us.dsaslate.temp.publicEvent',
  hostEntity: entity.uri,
  title: 'Local integration event',
  startsAt: new Date(Date.now() + 86_400_000).toISOString(),
  mode: 'online',
  status: 'scheduled',
  createdAt,
};
const event = await pdsWrite(session, 'com.atproto.repo.createRecord', {
  repo: session.did,
  collection: 'us.dsaslate.temp.publicEvent',
  validate: false,
  record: eventRecord,
});
await waitForResolution(event.uri, (value) => value.provenance?.cid === event.cid && value.authority?.status === 'provisional');

const eventSegments = event.uri.split('/');
const collection = eventSegments.at(-2);
const rkey = eventSegments.at(-1);
if (!collection || !rkey) throw new Error(`PDS returned malformed event URI ${event.uri}`);
const updated = await pdsWrite(session, 'com.atproto.repo.putRecord', {
  repo: session.did,
  collection,
  rkey,
  validate: false,
  swapRecord: event.cid,
  record: { ...eventRecord, title: 'Updated local integration event' },
});
await waitForResolution(event.uri, (value) => value.provenance?.cid === updated.cid && !value.deletedAt);

await pdsWrite(session, 'com.atproto.repo.deleteRecord', {
  repo: session.did,
  collection,
  rkey,
  swapRecord: updated.cid,
});
await waitForResolution(event.uri, (value) => Boolean(value.deletedAt));

const entities = await fetch(`${config.INTEGRATION_API_URL}/xrpc/us.dsaslate.temp.listEntities?limit=100`).then((response) => response.json() as Promise<{ entities?: Array<{ entityUri?: string; authority?: { status?: string } }> }>);
if (!(entities.entities ?? []).some((item) => item.entityUri === entity.uri && item.authority?.status === 'provisional')) throw new Error('root-authored entity did not appear in the primary directory');
if ((entities.entities ?? []).some((item) => item.authority?.status === 'official')) throw new Error('temporary integration stack returned official authority');
const sync = await fetch(`${config.INTEGRATION_API_URL}/xrpc/us.dsaslate.temp.getSyncStatus`).then((response) => response.json() as Promise<{ sync?: { status?: string; lastSequence?: number } }>);
if (!sync.sync) throw new Error('AppView did not return sync status');

console.info(JSON.stringify({
  status: 'passed',
  rootDid: session.did,
  entityUri: entityResolution.uri,
  eventLifecycle: ['created', 'updated', 'deleted'],
  syncStatus: sync.sync.status,
  lastSequence: sync.sync.lastSequence,
}));
