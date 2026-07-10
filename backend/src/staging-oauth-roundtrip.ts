import { bootstrapRepository, getConfig } from './server.js';

const config = getConfig();
const entityUri = process.env.CANARY_ENTITY_URI;
const apiUrl = process.env.APPVIEW_PUBLIC_URL ?? 'https://api-staging.dsaslate.us';
if (!entityUri) throw new Error('CANARY_ENTITY_URI is required');

const repository = await bootstrapRepository(config.DATABASE_URL, { ...config, AUTO_REPLAY_FIXTURES: false, REQUIRE_POSTGRES: true });
if (!repository.oauthService) throw new Error('OAuth service is unavailable');

const waitFor = async (uri: string, expectedCid?: string, deleted = false) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(`${apiUrl}/xrpc/us.dsaslate.temp.resolveAuthority?uri=${encodeURIComponent(uri)}`);
    if (response.ok) {
      const current = await response.json() as { provenance?: { cid?: string }; authority?: { status?: string }; deletedAt?: string };
      if (deleted ? !!current.deletedAt : current.provenance?.cid === expectedCid && current.authority?.status === 'provisional') return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(deleted ? `AppView did not observe deletion for ${uri}` : `AppView did not observe ${uri}#${expectedCid}`);
};

const createdAt = new Date().toISOString();
const baseRecord = {
  $type: 'us.dsaslate.temp.publicEvent' as const,
  hostEntity: entityUri,
  title: 'Staging OAuth canary',
  startsAt: new Date(Date.now() + 86_400_000).toISOString(),
  mode: 'online' as const,
  status: 'scheduled' as const,
  createdAt,
};

let current: { uri: string; cid: string } | undefined;
try {
  const created = await repository.oauthService.writeSelfAuthoredRecord(config.PROVISIONAL_ROOT_DID, { action: 'create', collection: 'us.dsaslate.temp.publicEvent', record: baseRecord });
  if (!created.cid) throw new Error('PDS create response omitted CID');
  current = { uri: created.uri, cid: created.cid };
  await waitFor(current.uri, current.cid);

  const updated = await repository.oauthService.writeSelfAuthoredRecord(config.PROVISIONAL_ROOT_DID, { action: 'update', uri: current.uri, expectedCid: current.cid, record: { ...baseRecord, title: 'Updated staging OAuth canary' } });
  if (!updated.cid) throw new Error('PDS update response omitted CID');
  current = { uri: updated.uri, cid: updated.cid };
  await waitFor(current.uri, current.cid);

  await repository.oauthService.writeSelfAuthoredRecord(config.PROVISIONAL_ROOT_DID, { action: 'delete', uri: current.uri, expectedCid: current.cid });
  const completedUri = current.uri;
  current = undefined;
  await waitFor(completedUri, undefined, true);
  console.info(JSON.stringify({ status: 'passed', uri: completedUri }));
} finally {
  if (current) await repository.oauthService.writeSelfAuthoredRecord(config.PROVISIONAL_ROOT_DID, { action: 'delete', uri: current.uri, expectedCid: current.cid }).catch(() => undefined);
}
