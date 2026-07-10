import type { IdentityEvent, RecordEvent } from '@atproto/tap';
import { isFoundationCollection, type FoundationRecord, type FoundationRecordValue } from './foundation-model.js';
import type { FoundationPostgresPersistence } from './foundation-postgres.js';
import { FoundationService, type RepoSyncState, type SyncApplyResult } from './foundation-service.js';

export type RepositorySnapshot = {
  repoRev: string;
  treeRoot?: string;
  cursor: number;
  records: FoundationRecord[];
};

export type FoundationTapProcessorOptions = {
  resolvePds: (did: string) => Promise<string>;
  persistence?: FoundationPostgresPersistence;
  recoverRepository?: (did: string, pds: string) => Promise<RepositorySnapshot>;
  onRepoEnrolled?: (did: string) => Promise<void>;
  now?: () => string;
};

export class FoundationTapProcessor {
  private repoQueues = new Map<string, Promise<SyncApplyResult>>();

  constructor(private readonly service: FoundationService, private readonly options: FoundationTapProcessorOptions) {}

  processRecord(event: RecordEvent) {
    if (!isFoundationCollection(event.collection)) return Promise.resolve('ignored' as const);
    return this.enqueue(event.did, () => this.processRecordSequentially(event));
  }

  processIdentity(event: IdentityEvent) {
    return this.enqueue(event.did, async () => {
      const observedAt = this.now();
      const pds = await this.options.resolvePds(event.did);
      this.service.applySyncEvent({ kind: 'identity', did: event.did, handle: event.handle, pds, sequence: event.id, cursor: event.id, observedAt });
      this.service.applySyncEvent({ kind: 'account', did: event.did, active: event.isActive, status: event.status, sequence: event.id, cursor: event.id, observedAt });
      const identity = this.service.getIdentityState(event.did);
      const state = this.service.getRepoState(event.did);
      if (identity && state) await this.options.persistence?.persistTapIdentity(identity, state);
      return 'accepted';
    });
  }

  private async processRecordSequentially(event: RecordEvent): Promise<SyncApplyResult> {
    const observedAt = this.now();
    const pds = await this.options.resolvePds(event.did);
    const uri = `at://${event.did}/${event.collection}/${event.rkey}`;
    let result: SyncApplyResult;
    if (event.action === 'delete') {
      result = this.service.applySyncEvent({ kind: 'record', action: 'delete', repoDid: event.did, pds, repoRev: event.rev, sequence: event.id, cursor: event.id, uri, observedAt, verified: true });
    } else {
      if (!event.cid || !event.record) throw new Error(`Tap ${event.action} event for ${uri} is missing cid or record`);
      result = this.service.applySyncEvent({
        kind: 'record',
        action: event.action,
        repoDid: event.did,
        pds,
        repoRev: event.rev,
        sequence: event.id,
        cursor: event.id,
        uri,
        cid: event.cid,
        record: event.record as FoundationRecordValue,
        observedAt,
        verified: true,
      });
    }

    const state = this.service.getRepoState(event.did);
    if (state) {
      const record = event.action === 'delete' ? this.service.getLatestRecordVersion(uri) : this.service.getCurrentRecord(uri);
      if (record) await this.options.persistence?.persistTapRecord(record, event.action, state);
      else await this.options.persistence?.persistRepoState(state);
    }
    if (result === 'desynchronized' && this.options.recoverRepository) await this.recover(event.did, pds, observedAt);
    if (result === 'accepted' && event.action !== 'delete' && event.record?.$type === 'us.dsaslate.temp.authorityDelegation') {
      const delegateDid = event.record.delegateDid;
      if (typeof delegateDid === 'string' && this.service.isEnrolled(delegateDid)) await this.options.onRepoEnrolled?.(delegateDid);
    }
    return result;
  }

  private async recover(did: string, pds: string, observedAt: string) {
    const snapshot = await this.options.recoverRepository!(did, pds);
    const state: RepoSyncState = {
      did,
      pds,
      rev: snapshot.repoRev,
      revSequence: snapshot.cursor,
      treeRoot: snapshot.treeRoot,
      lastSequence: snapshot.cursor,
      cursor: snapshot.cursor,
      status: 'active',
      updatedAt: observedAt,
    };
    const disposition = this.service.isEnrolled(did) ? 'primary' as const : 'candidate' as const;
    const records = snapshot.records.map((record) => ({ ...record, disposition }));
    this.service.replaceRepoSnapshot(did, records, state);
    await this.options.persistence?.replaceRepoSnapshot(did, records, state);
  }

  private enqueue(did: string, work: () => Promise<SyncApplyResult>) {
    const previous = this.repoQueues.get(did) ?? Promise.resolve('ignored' as const);
    const next = previous.catch(() => 'ignored' as const).then(work);
    this.repoQueues.set(did, next);
    void next.finally(() => {
      if (this.repoQueues.get(did) === next) this.repoQueues.delete(did);
    });
    return next;
  }

  private now() {
    return this.options.now?.() ?? new Date().toISOString();
  }
}

export function pdsEndpointFromDidDocument(document: unknown) {
  const services = document && typeof document === 'object' && Array.isArray((document as { service?: unknown }).service)
    ? (document as { service: Array<{ id?: unknown; type?: unknown; serviceEndpoint?: unknown }> }).service
    : [];
  const service = services.find((candidate) => candidate.type === 'AtprotoPersonalDataServer' || (typeof candidate.id === 'string' && candidate.id.endsWith('#atproto_pds')));
  if (!service || typeof service.serviceEndpoint !== 'string') throw new Error('DID document does not declare an AtprotoPersonalDataServer');
  const endpoint = new URL(service.serviceEndpoint);
  const isLoopback = endpoint.hostname === 'localhost' || endpoint.hostname === '127.0.0.1' || endpoint.hostname === '[::1]';
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && isLoopback)) throw new Error('DID document PDS endpoint must use HTTPS outside loopback development');
  return endpoint.toString().replace(/\/$/, '');
}
