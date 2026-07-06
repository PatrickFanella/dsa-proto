import { recordEnvelopeSchema, type RecordEnvelope, validatePublicationBoundary } from './domain.js';
import type { DirectoryRepository } from './server.js';

export const supportedAtprotoCollections = [
  'org.dsa.profile.chapter',
  'org.dsa.profile.caucus',
  'org.dsa.affiliation.member',
] as const satisfies ReadonlyArray<RecordEnvelope['collection']>;

export type SupportedAtprotoCollection = typeof supportedAtprotoCollections[number];

export type LiveAtprotoIngestionConfig = {
  enabled: boolean;
  relayUrl: string;
  collections: SupportedAtprotoCollection[];
};

export type LiveAtprotoRecordEvent = {
  event: string;
  uri?: string;
  cid?: unknown;
  did: string;
  handle?: string;
  collection: string;
  rkey?: string;
  indexedAt?: string;
  record?: unknown;
};

export type LiveAtprotoIngestionStats = {
  accepted: number;
  rejected: number;
  ignored: number;
};

export function getLiveAtprotoIngestionConfig(env: NodeJS.ProcessEnv = process.env): LiveAtprotoIngestionConfig {
  const requestedCollections = (env.ATPROTO_COLLECTIONS ?? supportedAtprotoCollections.join(','))
    .split(',')
    .map((collection) => collection.trim())
    .filter(Boolean);
  const supported = new Set<string>(supportedAtprotoCollections);
  const collections = requestedCollections.filter((collection): collection is SupportedAtprotoCollection => supported.has(collection));

  return {
    enabled: env.ATPROTO_LIVE_INGESTION === 'true',
    relayUrl: env.ATPROTO_RELAY_URL ?? 'wss://bsky.network',
    collections: collections.length ? collections : [...supportedAtprotoCollections],
  };
}

export function mapLiveAtprotoEventToEnvelope(event: LiveAtprotoRecordEvent, now: () => Date = () => new Date()) {
  if (event.event !== 'create' && event.event !== 'update') return undefined;
  if (!supportedAtprotoCollections.includes(event.collection as SupportedAtprotoCollection)) return undefined;
  if (!event.record || event.cid === undefined) return undefined;

  return {
    uri: event.uri ?? `at://${event.did}/${event.collection}/${event.rkey ?? 'self'}`,
    cid: String(event.cid),
    did: event.did,
    handle: event.handle ?? event.did,
    collection: event.collection,
    indexedAt: event.indexedAt ?? now().toISOString(),
    trustLabel: 'uncertain',
    record: event.record,
  };
}

export async function ingestLiveAtprotoEvent(event: LiveAtprotoRecordEvent, repository: Pick<DirectoryRepository, 'ingestRecordEnvelopes'>): Promise<'accepted' | 'rejected' | 'ignored'> {
  const envelope = mapLiveAtprotoEventToEnvelope(event);
  if (!envelope) return 'ignored';
  const parsed = recordEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) return 'rejected';
  if (validatePublicationBoundary(parsed.data).length > 0) return 'rejected';
  await repository.ingestRecordEnvelopes([parsed.data]);
  return 'accepted';
}
