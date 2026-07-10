import { SimpleIndexer, Tap } from '@atproto/tap';
import { z } from 'zod';
import { FoundationTapProcessor, pdsEndpointFromDidDocument } from './foundation-tap.js';
import { createPostgresRepository, getConfig } from './server.js';

const tapConfig = z.object({
  TAP_URL: z.string().url().default('http://127.0.0.1:2480'),
  TAP_ADMIN_PASSWORD: z.string().min(1).optional(),
}).parse(process.env);

const appConfig = getConfig();
const repository = await createPostgresRepository(appConfig.DATABASE_URL, { rootDid: appConfig.PROVISIONAL_ROOT_DID });
const tap = new Tap(tapConfig.TAP_URL, { adminPassword: tapConfig.TAP_ADMIN_PASSWORD });
const pdsCache = new Map<string, { endpoint: string; expiresAt: number }>();

async function resolvePds(did: string) {
  const cached = pdsCache.get(did);
  if (cached && cached.expiresAt > Date.now()) return cached.endpoint;
  const document = await tap.resolveDid(did);
  if (!document) throw new Error(`Tap could not resolve ${did}`);
  const endpoint = pdsEndpointFromDidDocument(document);
  pdsCache.set(did, { endpoint, expiresAt: Date.now() + 5 * 60_000 });
  return endpoint;
}

const processor = new FoundationTapProcessor(repository.foundation, {
  resolvePds,
  persistence: repository.foundationPersistence,
  onRepoEnrolled: async (did) => tap.addRepos([did]),
});
const indexer = new SimpleIndexer()
  .record(async (event) => { await processor.processRecord(event); })
  .identity(async (event) => { await processor.processIdentity(event); })
  .error((error) => console.error(JSON.stringify({ level: 'error', message: 'tap worker error', error: error.message })));
const channel = tap.channel(indexer);

await tap.addRepos(repository.foundation.listEnrolledRepos());
process.once('SIGINT', () => { void channel.destroy(); });
process.once('SIGTERM', () => { void channel.destroy(); });
console.info(JSON.stringify({ level: 'info', message: 'foundation Tap worker started', tapUrl: tapConfig.TAP_URL, repos: repository.foundation.listEnrolledRepos().length }));
await channel.start();
