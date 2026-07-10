import { IdResolver } from '@atproto/identity';
import { Firehose } from '@atproto/sync';
import { getLiveAtprotoIngestionConfig, ingestLiveAtprotoEvent, type LiveAtprotoIngestionStats, type LiveAtprotoRecordEvent } from './atproto-live.js';
import { createPostgresRepository, getConfig } from './server.js';

const config = getLiveAtprotoIngestionConfig();

if (!config.enabled) {
  console.log('Live ATProto ingestion is disabled. Set ATPROTO_LIVE_INGESTION=true to run this opt-in script.');
  process.exit(0);
}

const appConfig = getConfig();
const repository = await createPostgresRepository(appConfig.DATABASE_URL, { rootDid: appConfig.PROVISIONAL_ROOT_DID });
const stats: LiveAtprotoIngestionStats = { accepted: 0, rejected: 0, ignored: 0 };
const collectionFilter = new Set<string>(config.collections);

console.log(`Starting live ATProto ingestion from ${config.relayUrl}`);
console.log(`Filtering collections: ${config.collections.join(', ')}`);

const firehose = new Firehose({
  idResolver: new IdResolver(),
  service: config.relayUrl,
  filterCollections: config.collections,
  async handleEvt(event: LiveAtprotoRecordEvent) {
    if (!collectionFilter.has(event.collection)) {
      stats.ignored += 1;
      return;
    }
    const result = await ingestLiveAtprotoEvent(event, repository);
    stats[result] += 1;
    if (result !== 'ignored') {
      console.log(`ATProto ${result}: ${event.uri ?? `${event.did}/${event.collection}/${event.rkey ?? ''}`} (${stats.accepted} accepted, ${stats.rejected} rejected)`);
    }
  },
  onError(error: unknown) {
    console.error('ATProto firehose error', error);
  },
});

process.once('SIGINT', () => {
  console.log(`Stopping live ATProto ingestion (${stats.accepted} accepted, ${stats.rejected} rejected, ${stats.ignored} ignored).`);
  process.exit(0);
});

firehose.start();
