import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  createFoundationRecord,
  assertFoundationRecord,
  decodeCursor,
  encodeCursor,
  isFoundationCollection,
  normalizePageLimit,
  toProvenance,
  validateFoundationRecordValue,
  type ActivityView,
  type AuthorityDecision,
  type EntityView,
  type FoundationCollection,
  type FoundationRecord,
  type FoundationRecordValue,
  type LifecycleStatusV1,
  type StrongRef,
  TEMP_NAMESPACE,
} from './foundation-model.js';

export type FoundationPolicyConfig = {
  rootDid: string;
  policyUri: string;
  policyCid: string;
  policyVersion: string;
  officialActivation?: {
    enabled: boolean;
    adoptionDigest?: string;
    stableNamespace?: string;
  };
};

export type RepoSyncState = {
  did: string;
  pds?: string;
  rev?: string;
  revSequence?: number;
  treeRoot?: string;
  lastSequence: number;
  cursor: number;
  status: 'active' | 'inactive' | 'desynchronized';
  updatedAt: string;
};

export type IdentityState = {
  did: string;
  handle?: string;
  pds?: string;
  active: boolean;
  status?: string;
  resolvedAt: string;
};

export type FoundationSyncEvent =
  | { kind: 'record'; action: 'create' | 'update'; repoDid: string; pds: string; repoRev: string; expectedPrevRev?: string; treeRoot?: string; sequence: number; cursor: number; uri: string; cid: string; record: FoundationRecordValue; rawCbor?: Uint8Array; observedAt: string; verified: boolean }
  | { kind: 'record'; action: 'delete'; repoDid: string; pds: string; repoRev: string; expectedPrevRev?: string; treeRoot?: string; sequence: number; cursor: number; uri: string; cid?: string; observedAt: string; verified: boolean }
  | { kind: 'identity'; did: string; handle?: string; pds?: string; sequence: number; cursor: number; observedAt: string }
  | { kind: 'account'; did: string; active: boolean; status?: string; sequence: number; cursor: number; observedAt: string }
  | { kind: 'sync'; did: string; repoRev: string; treeRoot?: string; sequence: number; cursor: number; observedAt: string };

export type SyncApplyResult = 'accepted' | 'ignored' | 'quarantined' | 'desynchronized';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'published' | 'failed';
export type ReviewAuditEvent = {
  eventId: string;
  actorDid: string;
  status: ReviewStatus;
  message: string;
  decision?: 'approve' | 'reject';
  reason?: string;
  target?: StrongRef;
  policyVersion?: string;
  createdAt: string;
};
export type ReviewOperation = {
  operationId: string;
  submitterDid: string;
  collection: FoundationCollection;
  status: ReviewStatus;
  record: FoundationRecordValue;
  reason?: string;
  createdAt: string;
  updatedAt: string;
  auditEvents: ReviewAuditEvent[];
};

export class InvalidCursorError extends Error {}

function latest(records: FoundationRecord[]) {
  return [...records].sort((left, right) => left.repoRev.localeCompare(right.repoRev) || left.sequence - right.sequence).at(-1);
}

function ref(record: FoundationRecord): StrongRef {
  return { uri: record.uri, cid: record.cid };
}

function recordRefMatches(target: unknown, record: FoundationRecord) {
  return !!target && typeof target === 'object'
    && (target as { uri?: unknown }).uri === record.uri
    && (target as { cid?: unknown }).cid === record.cid;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function entityScopeUris(record: FoundationRecord) {
  if (record.record.$type === 'us.dsaslate.temp.orgEntity') return [record.uri];
  if (record.record.$type === 'us.dsaslate.temp.orgProfile' || record.record.$type === 'us.dsaslate.temp.dsaUnit') {
    const uri = (record.record.entity as StrongRef | undefined)?.uri;
    return uri ? [uri] : [];
  }
  if (record.record.$type === 'us.dsaslate.temp.publicEvent') return typeof record.record.hostEntity === 'string' ? [record.record.hostEntity] : [];
  if (record.record.$type === 'us.dsaslate.temp.orgRelationship') return [record.record.subject, record.record.object].filter((value): value is string => typeof value === 'string');
  if (record.record.$type === 'us.dsaslate.temp.authorityDelegation') return stringArray(record.record.entityUris);
  if (record.record.$type === 'us.dsaslate.temp.authorityAttestation') {
    const uri = (record.record.subject as StrongRef | undefined)?.uri;
    return uri ? [uri] : [];
  }
  return [];
}

function recordDelegationActions(record: FoundationRecord) {
  if (record.record.$type === 'us.dsaslate.temp.authorityDelegation') return ['delegate'];
  if (record.record.$type === 'us.dsaslate.temp.authorityAttestation') return ['attest'];
  return ['create', 'update'];
}

function containsAll(parent: string[], child: string[]) {
  return child.every((value) => parent.includes(value));
}

const projectionAuthorityRank: Record<AuthorityDecision['status'], number> = {
  official: 7,
  provisional: 6,
  attested: 5,
  selfAsserted: 4,
  unresolved: 1,
  expired: 0,
  disputed: 0,
  revoked: 0,
};

const projectionProvenanceRank: Record<FoundationRecord['status'], number> = {
  verified: 2,
  unverified: 1,
  invalid: 0,
  desynchronized: 0,
};

export class FoundationService {
  private currentRecords = new Map<string, FoundationRecord>();
  private recordVersions = new Map<string, FoundationRecord[]>();
  private candidateRecords = new Map<string, FoundationRecord>();
  private repoStates = new Map<string, RepoSyncState>();
  private identities = new Map<string, IdentityState>();
  private enrolledRepos = new Set<string>();
  private reviews = new Map<string, ReviewOperation>();

  constructor(records: FoundationRecord[], readonly policy: FoundationPolicyConfig) {
    this.enrolledRepos.add(policy.rootDid);
    for (const record of records) {
      if (record.disposition === 'candidate') {
        const copy = assertFoundationRecord(record);
        this.candidateRecords.set(copy.uri, copy);
        this.recordVersions.set(copy.uri, [...(this.recordVersions.get(copy.uri) ?? []), copy]);
      } else {
        this.storeRecord(record, false);
      }
    }
    this.refreshEnrollment();
  }

  replaceBootstrap(records: FoundationRecord[]) {
    for (const [uri, record] of this.currentRecords) if (record.bootstrap) this.currentRecords.delete(uri);
    for (const [uri, versions] of this.recordVersions) {
      const retained = versions.filter((record) => !record.bootstrap);
      if (retained.length) this.recordVersions.set(uri, retained);
      else this.recordVersions.delete(uri);
    }
    for (const record of records) this.storeRecord(record, false);
    this.refreshEnrollment();
  }

  restoreRepoStates(states: RepoSyncState[]) {
    for (const state of states) this.repoStates.set(state.did, structuredClone(state));
  }

  restoreIdentityStates(states: IdentityState[]) {
    for (const state of states) this.identities.set(state.did, structuredClone(state));
  }

  restoreReviewOperations(operations: ReviewOperation[]) {
    for (const operation of operations) this.reviews.set(operation.operationId, structuredClone(operation));
  }

  getRepoState(did: string) {
    const state = this.repoStates.get(did);
    return state ? structuredClone(state) : undefined;
  }

  getIdentityState(did: string) {
    const state = this.identities.get(did);
    return state ? structuredClone(state) : undefined;
  }

  getCurrentRecord(uri: string) {
    const record = this.currentRecords.get(uri) ?? this.candidateRecords.get(uri);
    return record ? structuredClone(record) : undefined;
  }

  getLatestRecordVersion(uri: string) {
    const record = latest(this.recordVersions.get(uri) ?? []);
    return record ? structuredClone(record) : undefined;
  }

  isEnrolled(did: string) {
    return this.enrolledRepos.has(did);
  }

  listEnrolledRepos() {
    return [...this.enrolledRepos].sort();
  }

  replaceRepoSnapshot(did: string, records: FoundationRecord[], state: RepoSyncState) {
    if (state.did !== did || state.status !== 'active') throw new Error('recovered repository state must be active and match the repository DID');
    for (const record of records) {
      if (record.repoDid !== did) throw new Error(`snapshot record ${record.uri} belongs to a different repository`);
      if (record.status !== 'verified') throw new Error(`snapshot record ${record.uri} is not verified`);
    }
    for (const [uri, record] of this.currentRecords) if (record.repoDid === did) this.currentRecords.delete(uri);
    for (const [uri, record] of this.candidateRecords) if (record.repoDid === did) this.candidateRecords.delete(uri);
    this.repoStates.set(did, structuredClone(state));
    for (const record of records) {
      if (this.enrolledRepos.has(did)) this.storeRecord({ ...record, disposition: 'primary' }, true);
      else {
        const candidate = { ...structuredClone(record), disposition: 'candidate' as const };
        this.candidateRecords.set(candidate.uri, candidate);
        if (!(this.recordVersions.get(candidate.uri) ?? []).some((version) => version.cid === candidate.cid)) this.recordVersions.set(candidate.uri, [...(this.recordVersions.get(candidate.uri) ?? []), candidate]);
      }
    }
    this.refreshEnrollment();
  }

  listRecordVersions(uri: string, asOf?: string) {
    const cutoff = asOf ? Date.parse(asOf) : undefined;
    return (this.recordVersions.get(uri) ?? [])
      .filter((record) => cutoff === undefined || Date.parse(record.observedAt) <= cutoff)
      .sort((left, right) => left.repoRev.localeCompare(right.repoRev) || left.sequence - right.sequence)
      .map((record) => structuredClone(record));
  }

  resolve(uri: string, options: { asOf?: string; depth?: number } = {}) {
    const depth = Math.min(32, Math.max(0, options.depth ?? 16));
    const latestVersion = latest(this.listRecordVersions(uri, options.asOf));
    const record = latestVersion?.deletedAt ? undefined : latestVersion;
    return {
      uri,
      provenance: latestVersion ? toProvenance(latestVersion) : undefined,
      deletedAt: latestVersion?.deletedAt,
      authority: this.evaluateAuthority(record, { asOf: options.asOf, depth }),
    };
  }

  listEntities(input: { cursor?: string; limit?: number; q?: string; unitKind?: string } = {}) {
    const cursor = decodeCursor(input.cursor);
    if (input.cursor && !cursor) throw new InvalidCursorError('invalid cursor');
    const limit = normalizePageLimit(input.limit);
    const watermark = this.watermark();
    const query = input.q?.trim().toLowerCase();
    const all = this.primaryRecords('us.dsaslate.temp.orgEntity')
      .map((record) => this.toEntityView(record))
      .filter((entity): entity is EntityView => !!entity)
      .filter((entity) => !query || JSON.stringify([entity.entityUri, entity.profile, entity.dsaUnit]).toLowerCase().includes(query))
      .filter((entity) => !input.unitKind || (entity.dsaUnit as { unitKind?: string } | undefined)?.unitKind === input.unitKind)
      .sort((left, right) => left.entityUri.localeCompare(right.entityUri));
    const start = cursor ? all.findIndex((entity) => entity.entityUri > cursor.after) : 0;
    const normalizedStart = start < 0 ? all.length : start;
    const entities = all.slice(normalizedStart, normalizedStart + limit);
    const hasMore = normalizedStart + entities.length < all.length;
    return { entities, cursor: hasMore && entities.length ? encodeCursor({ after: entities.at(-1)!.entityUri, watermark }) : undefined };
  }

  getEntity(entityUri: string) {
    const record = this.currentRecords.get(entityUri);
    if (!record || record.record.$type !== 'us.dsaslate.temp.orgEntity' || !this.isPrimary(record)) return undefined;
    return this.toEntityView(record);
  }

  getOrgGraph(input: { cursor?: string; limit?: number } = {}) {
    const page = this.listEntities(input);
    const included = new Set(page.entities.map((entity) => entity.entityUri));
    const relationships = this.primaryRecords('us.dsaslate.temp.orgRelationship')
      .filter((record) => included.has(String(record.record.subject)) || included.has(String(record.record.object)))
      .map((record) => ({ uri: record.uri, cid: record.cid, record: structuredClone(record.record), provenance: toProvenance(record), authority: this.evaluateAuthority(record) }));
    return { entities: page.entities, relationships, cursor: page.cursor };
  }

  listActivity(input: { cursor?: string; limit?: number; entity?: string } = {}) {
    const cursor = decodeCursor(input.cursor);
    if (input.cursor && !cursor) throw new InvalidCursorError('invalid cursor');
    const limit = normalizePageLimit(input.limit);
    const all = this.primaryRecords('us.dsaslate.temp.publicEvent')
      .filter((record) => !input.entity || record.record.hostEntity === input.entity)
      .map<ActivityView>((record) => ({ uri: record.uri, collection: record.record.$type, record: structuredClone(record.record), provenance: toProvenance(record), authority: this.evaluateAuthority(record) }))
      .sort((left, right) => left.uri.localeCompare(right.uri));
    const start = cursor ? all.findIndex((item) => item.uri > cursor.after) : 0;
    const normalizedStart = start < 0 ? all.length : start;
    const items = all.slice(normalizedStart, normalizedStart + limit);
    return { items, cursor: normalizedStart + items.length < all.length && items.length ? encodeCursor({ after: items.at(-1)!.uri, watermark: this.watermark() }) : undefined };
  }

  getSyncStatus(did?: string) {
    const states = did ? [...this.repoStates.values()].filter((state) => state.did === did) : [...this.repoStates.values()].filter((state) => this.enrolledRepos.has(state.did));
    const desynchronizedRepoCount = states.filter((state) => state.status === 'desynchronized').length;
    return {
      ...(did ? { did } : {}),
      status: desynchronizedRepoCount ? 'desynchronized' as const : states.some((state) => state.status !== 'active') ? 'degraded' as const : 'ready' as const,
      enrolledRepoCount: did ? Number(this.enrolledRepos.has(did)) : this.enrolledRepos.size,
      desynchronizedRepoCount,
      lastSequence: Math.max(0, ...states.map((state) => state.lastSequence)),
      updatedAt: states.map((state) => state.updatedAt).sort().at(-1) ?? new Date(0).toISOString(),
    };
  }

  applySyncEvent(event: FoundationSyncEvent): SyncApplyResult {
    if (event.kind === 'identity') {
      this.identities.set(event.did, { did: event.did, handle: event.handle, pds: event.pds, active: true, resolvedAt: event.observedAt });
      const state = this.advanceGlobalEvent(event.did, event.sequence, event.cursor, event.observedAt);
      state.pds = event.pds;
      return 'accepted';
    }
    if (event.kind === 'account') {
      const identity = this.identities.get(event.did);
      this.identities.set(event.did, { did: event.did, handle: identity?.handle, pds: identity?.pds, active: event.active, status: event.status, resolvedAt: event.observedAt });
      const state = this.advanceGlobalEvent(event.did, event.sequence, event.cursor, event.observedAt);
      state.status = event.active ? 'active' : 'inactive';
      return 'accepted';
    }
    if (event.kind === 'sync') {
      const state = this.advanceGlobalEvent(event.did, event.sequence, event.cursor, event.observedAt);
      state.rev = event.repoRev;
      state.treeRoot = event.treeRoot;
      state.status = 'desynchronized';
      return 'desynchronized';
    }

    const state = this.repoStates.get(event.repoDid);
    if (state?.pds && state.pds !== event.pds) return 'ignored';
    if (state?.rev && event.expectedPrevRev && state.rev !== event.expectedPrevRev) {
      state.status = 'desynchronized';
      state.updatedAt = event.observedAt;
      return 'desynchronized';
    }
    if (state?.rev && (event.repoRev < state.rev || (event.repoRev === state.rev && event.sequence <= (state.revSequence ?? -1)))) return 'ignored';
    const observationSequence = (state?.lastSequence ?? 0) + 1;
    const nextState: RepoSyncState = { did: event.repoDid, pds: event.pds, rev: event.repoRev, revSequence: event.sequence, treeRoot: event.treeRoot, lastSequence: observationSequence, cursor: observationSequence, status: 'active', updatedAt: event.observedAt };
    this.repoStates.set(event.repoDid, nextState);

    if (event.action === 'delete') {
      const current = this.currentRecords.get(event.uri) ?? this.candidateRecords.get(event.uri);
      if (current) {
        const deleted = { ...current, repoRev: event.repoRev, sequence: event.sequence, observedAt: event.observedAt, deletedAt: event.observedAt };
        this.recordVersions.set(event.uri, [...(this.recordVersions.get(event.uri) ?? []), deleted]);
        this.currentRecords.delete(event.uri);
        this.candidateRecords.delete(event.uri);
      }
      return this.enrolledRepos.has(event.repoDid) ? 'accepted' : 'quarantined';
    }
    const record = createFoundationRecord({
      uri: event.uri,
      cid: event.cid,
      repoDid: event.repoDid,
      repoRev: event.repoRev,
      sequence: event.sequence,
      observedAt: event.observedAt,
      status: event.verified ? 'verified' : 'unverified',
      record: event.record,
      rawCbor: event.rawCbor,
    });
    if (!this.enrolledRepos.has(event.repoDid)) {
      const candidate = { ...record, disposition: 'candidate' as const };
      this.candidateRecords.set(candidate.uri, candidate);
      this.recordVersions.set(candidate.uri, [...(this.recordVersions.get(candidate.uri) ?? []), candidate]);
      return 'quarantined';
    }
    this.storeRecord(record, true);
    this.refreshEnrollment();
    return 'accepted';
  }

  submitForReview(input: { submitterDid: string; collection: string; record: unknown; reason?: string; now?: string }) {
    if (!isFoundationCollection(input.collection)) throw new Error(`unsupported review collection ${input.collection}`);
    const record = input.record as FoundationRecordValue;
    if (record?.$type !== input.collection) throw new Error('collection must match record $type');
    const forbidden = ['uri', 'cid', 'repoDid', 'repoRev', 'sequence', 'trustLabel', 'authority', 'provenance', 'official'];
    for (const key of forbidden) if (record && Object.prototype.hasOwnProperty.call(record, key)) throw new Error(`client-controlled ${key} is not accepted`);
    const issues = validateFoundationRecordValue(record);
    if (issues.length) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    const now = input.now ?? new Date().toISOString();
    const operationId = randomUUID();
    const operation: ReviewOperation = {
      operationId,
      submitterDid: input.submitterDid,
      collection: input.collection,
      status: 'pending',
      record: structuredClone(record),
      reason: input.reason,
      createdAt: now,
      updatedAt: now,
      auditEvents: [{ eventId: randomUUID(), actorDid: input.submitterDid, status: 'pending', message: 'submitted for private review', createdAt: now }],
    };
    this.reviews.set(operationId, operation);
    return structuredClone(operation);
  }

  getReviewOperation(operationId: string, submitterDid?: string) {
    const operation = this.reviews.get(operationId);
    if (!operation || (submitterDid && operation.submitterDid !== submitterDid)) return undefined;
    return structuredClone(operation);
  }

  listReviewOperations(submitterDid?: string) {
    return [...this.reviews.values()].filter((operation) => !submitterDid || operation.submitterDid === submitterDid).map((operation) => structuredClone(operation));
  }

  updateReviewOperation(operationId: string, input: { actorDid: string; status: ReviewStatus; message: string; decision?: 'approve' | 'reject'; reason?: string; target?: StrongRef; policyVersion?: string; now?: string }) {
    const current = this.reviews.get(operationId);
    if (!current) throw new Error(`unknown review operation ${operationId}`);
    const now = input.now ?? new Date().toISOString();
    const next = { ...current, status: input.status, updatedAt: now, auditEvents: [...current.auditEvents, {
      eventId: randomUUID(), actorDid: input.actorDid, status: input.status, message: input.message,
      ...(input.decision ? { decision: input.decision } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.target ? { target: structuredClone(input.target) } : {}),
      ...(input.policyVersion ? { policyVersion: input.policyVersion } : {}),
      createdAt: now,
    }] };
    this.reviews.set(operationId, next);
    return structuredClone(next);
  }

  candidateCount() {
    return this.candidateRecords.size;
  }

  private storeRecord(record: FoundationRecord, enforceCurrentOrder: boolean) {
    const copy = assertFoundationRecord(record);
    const versions = this.recordVersions.get(copy.uri) ?? [];
    const contentMatch = versions.find((version) => version.cid === copy.cid);
    if (contentMatch && !isDeepStrictEqual(contentMatch.record, copy.record)) throw new Error(`CID ${copy.cid} reused with different record content`);
    const duplicate = versions.find((version) => version.cid === copy.cid && version.repoRev === copy.repoRev && version.sequence === copy.sequence && version.deletedAt === copy.deletedAt);
    if (!duplicate) this.recordVersions.set(copy.uri, [...versions, copy]);
    if (copy.deletedAt) {
      const current = this.currentRecords.get(copy.uri);
      if (!current || !enforceCurrentOrder || copy.repoRev.localeCompare(current.repoRev) > 0 || (copy.repoRev === current.repoRev && copy.sequence >= current.sequence)) this.currentRecords.delete(copy.uri);
      const state = this.repoStates.get(copy.repoDid);
      if (!state || !state.rev || copy.repoRev > state.rev || (copy.repoRev === state.rev && copy.sequence > (state.revSequence ?? -1))) {
        const observationSequence = (state?.lastSequence ?? 0) + 1;
        this.repoStates.set(copy.repoDid, { did: copy.repoDid, rev: copy.repoRev, revSequence: copy.sequence, lastSequence: observationSequence, cursor: observationSequence, status: copy.status === 'desynchronized' ? 'desynchronized' : 'active', updatedAt: copy.observedAt });
      }
      return;
    }
    const current = this.currentRecords.get(copy.uri);
    if (!current || !enforceCurrentOrder || copy.repoRev.localeCompare(current.repoRev) > 0 || (copy.repoRev === current.repoRev && copy.sequence > current.sequence)) this.currentRecords.set(copy.uri, copy);
    const state = this.repoStates.get(copy.repoDid);
    if (!state || !state.rev || copy.repoRev > state.rev || (copy.repoRev === state.rev && copy.sequence > (state.revSequence ?? -1))) {
      const observationSequence = (state?.lastSequence ?? 0) + 1;
      this.repoStates.set(copy.repoDid, { did: copy.repoDid, rev: copy.repoRev, revSequence: copy.sequence, lastSequence: observationSequence, cursor: observationSequence, status: copy.status === 'desynchronized' ? 'desynchronized' : 'active', updatedAt: copy.observedAt });
    }
  }

  private primaryRecords(collection?: FoundationCollection) {
    return [...this.currentRecords.values()].filter((record) => !record.deletedAt && this.isPrimary(record) && (!collection || record.record.$type === collection));
  }

  private isPrimary(record: FoundationRecord) {
    const repo = this.repoStates.get(record.repoDid);
    return this.enrolledRepos.has(record.repoDid) && record.status !== 'invalid' && record.status !== 'desynchronized' && repo?.status !== 'desynchronized' && repo?.status !== 'inactive';
  }

  private toEntityView(entity: FoundationRecord): EntityView | undefined {
    if (entity.record.$type !== 'us.dsaslate.temp.orgEntity') return undefined;
    const profile = this.selectEntityProjection(entity, 'us.dsaslate.temp.orgProfile');
    const unit = this.selectEntityProjection(entity, 'us.dsaslate.temp.dsaUnit');
    return {
      entityUri: entity.uri,
      profile: profile ? structuredClone(profile.record.record) : undefined,
      profileProvenance: profile ? toProvenance(profile.record) : undefined,
      profileAuthority: profile ? profile.authority : undefined,
      dsaUnit: unit ? structuredClone(unit.record.record) : undefined,
      dsaUnitProvenance: unit ? toProvenance(unit.record) : undefined,
      dsaUnitAuthority: unit ? unit.authority : undefined,
      provenance: toProvenance(entity),
      authority: this.evaluateAuthority(entity),
      lifecycle: this.lifecycleFor(entity),
    };
  }

  private selectEntityProjection(entity: FoundationRecord, collection: 'us.dsaslate.temp.orgProfile' | 'us.dsaslate.temp.dsaUnit') {
    return this.primaryRecords(collection)
      .filter((record) => recordRefMatches(record.record.entity, entity))
      .map((record) => ({ record, authority: this.evaluateAuthority(record) }))
      .filter(({ authority }) => projectionAuthorityRank[authority.status] > 0)
      .sort((left, right) => {
        const authority = projectionAuthorityRank[right.authority.status] - projectionAuthorityRank[left.authority.status];
        if (authority) return authority;
        const provenance = projectionProvenanceRank[right.record.status] - projectionProvenanceRank[left.record.status];
        if (provenance) return provenance;
        const observed = right.record.observedAt.localeCompare(left.record.observedAt);
        if (observed) return observed;
        if (left.record.repoDid === right.record.repoDid) {
          const revision = right.record.repoRev.localeCompare(left.record.repoRev);
          if (revision) return revision;
          const sequence = right.record.sequence - left.record.sequence;
          if (sequence) return sequence;
        }
        return left.record.repoDid.localeCompare(right.record.repoDid)
          || left.record.uri.localeCompare(right.record.uri)
          || left.record.cid.localeCompare(right.record.cid);
      })[0];
  }

  private evaluateAuthority(record: FoundationRecord | undefined, options: { asOf?: string; depth?: number } = {}): AuthorityDecision {
    const evaluatedAt = options.asOf ?? new Date().toISOString();
    const unresolved = (reason: string, extra: Partial<Pick<AuthorityDecision, 'chain' | 'failedChecks' | 'activeDisputes' | 'activeRevocations'>> = {}): AuthorityDecision => ({ status: 'unresolved', policyUri: this.policy.policyUri, policyVersion: this.policy.policyVersion, rootDid: this.policy.rootDid, chain: extra.chain ?? [], reasons: [reason], ...(extra.failedChecks ? { failedChecks: extra.failedChecks } : {}), ...(extra.activeDisputes ? { activeDisputes: extra.activeDisputes } : {}), ...(extra.activeRevocations ? { activeRevocations: extra.activeRevocations } : {}), evaluatedAt });
    if (!record) return unresolved('record is not indexed');
    if (record.status === 'invalid' || record.status === 'desynchronized' || this.repoStates.get(record.repoDid)?.status === 'desynchronized') return unresolved(`record provenance is ${record.status}`);
    const asOf = Date.parse(evaluatedAt);
    const authorityRecords = this.primaryRecordsAt(evaluatedAt);
    const actions = authorityRecords.filter((candidate) => candidate.record.$type === 'us.dsaslate.temp.authorityAction' && candidate.repoDid === this.policy.rootDid && recordRefMatches(candidate.record.target, record));
    const activeAction = (action: string) => latest(actions.filter((candidate) => candidate.record.action === action && Date.parse(String(candidate.record.effectiveAt)) <= asOf));
    const revoked = activeAction('revoke');
    const disputed = activeAction('dispute');
    const activeRevocations = revoked ? [ref(revoked)] : [];
    const activeDisputes = disputed ? [ref(disputed)] : [];
    if (revoked) return { status: 'revoked', policyUri: this.policy.policyUri, policyVersion: this.policy.policyVersion, rootDid: this.policy.rootDid, chain: [ref(revoked)], reasons: ['active root-issued revocation'], activeDisputes, activeRevocations, evaluatedAt };
    if (disputed) return { status: 'disputed', policyUri: this.policy.policyUri, policyVersion: this.policy.policyVersion, rootDid: this.policy.rootDid, chain: [ref(disputed)], reasons: ['active root-issued dispute'], activeDisputes, activeRevocations, evaluatedAt };

    const attestation = latest(authorityRecords.filter((candidate) => candidate.record.$type === 'us.dsaslate.temp.authorityAttestation'
      && recordRefMatches(candidate.record.subject, record)
      && Date.parse(String(candidate.record.issuedAt)) <= asOf));
    if (attestation) {
      const expiresAt = typeof attestation.record.expiresAt === 'string' ? Date.parse(attestation.record.expiresAt) : undefined;
      if (expiresAt !== undefined && expiresAt <= asOf) return { status: 'expired', policyUri: this.policy.policyUri, policyVersion: this.policy.policyVersion, rootDid: this.policy.rootDid, chain: [ref(attestation)], reasons: ['authority attestation expired'], evaluatedAt };
      const followed = this.followAuthorityChain(attestation, Math.min(32, Math.max(0, options.depth ?? 16)));
      if (followed.cycle) return unresolved('authority chain contains a cycle', { chain: followed.chain, failedChecks: ['cycle detected'], activeDisputes, activeRevocations });
      if (followed.depthExceeded) return unresolved('authority chain exceeds resolver depth', { chain: followed.chain, failedChecks: ['maximum resolver depth reached'], activeDisputes, activeRevocations });
      if (followed.missingParent) {
        const failure = `missing parent authority record ${followed.missingParent.uri}#${followed.missingParent.cid}`;
        return unresolved('authority chain is incomplete', { chain: followed.chain, failedChecks: [failure], activeDisputes, activeRevocations });
      }
      if (attestation.repoDid === this.policy.rootDid) return { status: this.officialAllowed(record) ? 'official' : 'provisional', policyUri: this.policy.policyUri, policyVersion: this.policy.policyVersion, rootDid: this.policy.rootDid, chain: followed.chain, reasons: [this.officialAllowed(record) ? 'complete chain to formally activated root' : 'complete chain to provisional staging root'], activeDisputes, activeRevocations, evaluatedAt };
      return { status: 'attested', policyUri: this.policy.policyUri, policyVersion: this.policy.policyVersion, rootDid: this.policy.rootDid, chain: followed.chain, reasons: ['attestation issued by an enrolled non-root repository'], activeDisputes, activeRevocations, evaluatedAt };
    }

    const delegations = authorityRecords.filter((candidate) => candidate.record.$type === 'us.dsaslate.temp.authorityDelegation'
      && candidate.record.delegateDid === record.repoDid
      && stringArray(candidate.record.collections).includes(record.record.$type)
      && recordDelegationActions(record).some((action) => stringArray(candidate.record.actions).includes(action))
      && entityScopeUris(record).length > 0
      && entityScopeUris(record).every((uri) => stringArray(candidate.record.entityUris).includes(uri))
      && Date.parse(String(candidate.record.effectiveFrom)) <= asOf);
    const activeDelegations = delegations.filter((candidate) => typeof candidate.record.effectiveUntil !== 'string' || Date.parse(candidate.record.effectiveUntil) > asOf)
      .sort((left, right) => right.repoRev.localeCompare(left.repoRev) || right.sequence - left.sequence);
    for (const delegation of activeDelegations) {
      const followed = this.followDelegationChain(delegation, authorityRecords, asOf, Math.min(32, Math.max(0, options.depth ?? 16)));
      if (followed.valid) return { status: this.officialAllowed(record) ? 'official' : 'provisional', policyUri: this.policy.policyUri, policyVersion: this.policy.policyVersion, rootDid: this.policy.rootDid, chain: followed.chain, reasons: [this.officialAllowed(record) ? 'complete delegated chain to formally activated root' : 'complete delegated chain to provisional staging root'], activeDisputes, activeRevocations, evaluatedAt };
      if (followed.cycle) return unresolved('delegation chain contains a cycle', { chain: followed.chain, failedChecks: ['cycle detected'], activeDisputes, activeRevocations });
      if (followed.depthExceeded) return unresolved('delegation chain exceeds resolver depth', { chain: followed.chain, failedChecks: ['maximum resolver depth reached'], activeDisputes, activeRevocations });
      if (followed.failure) return unresolved('delegation chain is invalid', { chain: followed.chain, failedChecks: [followed.failure], activeDisputes, activeRevocations });
    }
    const expiredDelegation = latest(delegations.filter((candidate) => typeof candidate.record.effectiveUntil === 'string' && Date.parse(candidate.record.effectiveUntil) <= asOf));
    if (expiredDelegation) return { status: 'expired', policyUri: this.policy.policyUri, policyVersion: this.policy.policyVersion, rootDid: this.policy.rootDid, chain: [ref(expiredDelegation)], reasons: ['delegation expired'], activeDisputes, activeRevocations, evaluatedAt };
    if (record.repoDid === this.policy.rootDid) return { status: 'provisional', policyUri: this.policy.policyUri, policyVersion: this.policy.policyVersion, rootDid: this.policy.rootDid, chain: [ref(record)], reasons: ['record published by provisional staging root'], evaluatedAt };
    if (record.record.$type === 'us.dsaslate.temp.orgProfile' || record.record.$type === 'us.dsaslate.temp.publicEvent') return { status: 'selfAsserted', policyUri: this.policy.policyUri, policyVersion: this.policy.policyVersion, rootDid: this.policy.rootDid, chain: [ref(record)], reasons: ['repository controller self-authored the record without higher attestation'], evaluatedAt };
    return unresolved('no valid authority path to the provisional root');
  }

  private followAuthorityChain(start: FoundationRecord, depth: number) {
    const chain: StrongRef[] = [];
    const seen = new Set<string>();
    let current: FoundationRecord | undefined = start;
    for (let index = 0; current; index += 1) {
      const key = `${current.uri}#${current.cid}`;
      if (seen.has(key)) return { chain, cycle: true, depthExceeded: false, missingParent: undefined };
      seen.add(key);
      chain.push(ref(current));
      const parent = current.record.delegation ?? current.record.parent;
      if (!parent || typeof parent !== 'object') return { chain, cycle: false, depthExceeded: false, missingParent: undefined };
      if (index >= depth) return { chain, cycle: false, depthExceeded: true, missingParent: undefined };
      const target = parent as StrongRef;
      current = (this.recordVersions.get(target.uri) ?? []).find((record) => record.cid === target.cid);
      if (!current) return { chain, cycle: false, depthExceeded: false, missingParent: target };
    }
    return { chain, cycle: false, depthExceeded: false, missingParent: undefined };
  }

  private followDelegationChain(start: FoundationRecord, authorityRecords: FoundationRecord[], asOf: number, depth: number) {
    const chain: StrongRef[] = [];
    const seen = new Set<string>();
    let current: FoundationRecord | undefined = start;
    for (let index = 0; current; index += 1) {
      const key = `${current.uri}#${current.cid}`;
      if (seen.has(key)) return { valid: false, chain, cycle: true, depthExceeded: false, failure: undefined };
      seen.add(key);
      chain.push(ref(current));
      if (current.record.$type !== 'us.dsaslate.temp.authorityDelegation') return { valid: false, chain, cycle: false, depthExceeded: false, failure: 'parent authority record is not a delegation' };
      if (Date.parse(String(current.record.effectiveFrom)) > asOf) return { valid: false, chain, cycle: false, depthExceeded: false, failure: `delegation ${current.uri} is not yet active` };
      if (typeof current.record.effectiveUntil === 'string' && Date.parse(current.record.effectiveUntil) <= asOf) return { valid: false, chain, cycle: false, depthExceeded: false, failure: `delegation ${current.uri} expired` };
      const revoked = authorityRecords.some((candidate) => candidate.record.$type === 'us.dsaslate.temp.authorityAction'
        && candidate.repoDid === this.policy.rootDid
        && candidate.record.action === 'revoke'
        && Date.parse(String(candidate.record.effectiveAt)) <= asOf
        && recordRefMatches(candidate.record.target, current!));
      if (revoked) return { valid: false, chain, cycle: false, depthExceeded: false, failure: `delegation ${current.uri} was revoked` };
      if (current.repoDid === this.policy.rootDid) return { valid: true, chain, cycle: false, depthExceeded: false, failure: undefined };
      if (index >= depth) return { valid: false, chain, cycle: false, depthExceeded: true, failure: undefined };
      const parentRef = current.record.parent as StrongRef | undefined;
      if (!parentRef?.uri || !parentRef.cid) return { valid: false, chain, cycle: false, depthExceeded: false, failure: `delegation ${current.uri} has no parent strong reference` };
      const parent = authorityRecords.find((candidate) => candidate.uri === parentRef.uri && candidate.cid === parentRef.cid);
      if (!parent) return { valid: false, chain, cycle: false, depthExceeded: false, failure: `missing parent delegation ${parentRef.uri}#${parentRef.cid}` };
      if (parent.record.$type !== 'us.dsaslate.temp.authorityDelegation') return { valid: false, chain, cycle: false, depthExceeded: false, failure: `parent ${parent.uri} is not a delegation` };
      if (parent.record.delegateDid !== current.repoDid) return { valid: false, chain, cycle: false, depthExceeded: false, failure: `parent delegate DID does not authorize ${current.repoDid}` };
      const parentActions = stringArray(parent.record.actions);
      if (!parentActions.includes('delegate')) return { valid: false, chain, cycle: false, depthExceeded: false, failure: `parent ${parent.uri} does not grant delegation management` };
      if (!stringArray(parent.record.collections).includes('us.dsaslate.temp.authorityDelegation')) return { valid: false, chain, cycle: false, depthExceeded: false, failure: `parent ${parent.uri} does not authorize delegation records` };
      if (!containsAll(stringArray(parent.record.entityUris), stringArray(current.record.entityUris))) return { valid: false, chain, cycle: false, depthExceeded: false, failure: `delegation ${current.uri} expands its parent entity scope` };
      if (!containsAll(parentActions, stringArray(current.record.actions))) return { valid: false, chain, cycle: false, depthExceeded: false, failure: `delegation ${current.uri} expands its parent action scope` };
      const delegatedCollections = stringArray(current.record.collections).filter((collection) => collection !== 'us.dsaslate.temp.authorityDelegation');
      if (!containsAll(stringArray(parent.record.collections), delegatedCollections)) return { valid: false, chain, cycle: false, depthExceeded: false, failure: `delegation ${current.uri} expands its parent collection scope` };
      current = parent;
    }
    return { valid: false, chain, cycle: false, depthExceeded: false, failure: 'delegation chain is incomplete' };
  }

  private primaryRecordsAt(evaluatedAt: string) {
    const cutoff = Date.parse(evaluatedAt);
    return [...this.recordVersions.values()]
      .map((versions) => latest(versions.filter((record) => Date.parse(record.observedAt) <= cutoff)))
      .filter((record): record is FoundationRecord => !!record && !record.deletedAt && this.isPrimary(record));
  }

  private lifecycleFor(record: FoundationRecord): LifecycleStatusV1 {
    const actions = this.primaryRecords('us.dsaslate.temp.authorityAction').filter((candidate) => candidate.repoDid === this.policy.rootDid && recordRefMatches(candidate.record.target, record));
    if (actions.some((candidate) => candidate.record.action === 'supersede')) return 'superseded';
    if (actions.some((candidate) => candidate.record.action === 'archive')) return 'archived';
    return 'active';
  }

  private officialAllowed(record: FoundationRecord) {
    const activation = this.policy.officialActivation;
    return !!activation?.enabled && !!activation.adoptionDigest && !!activation.stableNamespace && !activation.stableNamespace.includes('.temp') && !this.policy.policyUri.includes('.temp.') && !record.record.$type.startsWith(`${TEMP_NAMESPACE}.`);
  }

  private refreshEnrollment() {
    this.enrolledRepos = new Set([this.policy.rootDid]);
    const now = Date.now();
    const rootActions = [...this.currentRecords.values()].filter((record) => record.repoDid === this.policy.rootDid
      && record.record.$type === 'us.dsaslate.temp.authorityAction'
      && record.record.action === 'revoke'
      && Date.parse(String(record.record.effectiveAt)) <= now);
    const revoked = (record: FoundationRecord) => rootActions.some((action) => recordRefMatches(action.record.target, record));
    const authorityRecords = [...this.currentRecords.values()].filter((record) => !record.deletedAt);
    let changed = true;
    while (changed) {
      changed = false;
      for (const record of authorityRecords) {
        if (record.record.$type !== 'us.dsaslate.temp.authorityDelegation' || !this.enrolledRepos.has(record.repoDid) || revoked(record)) continue;
        const followed = this.followDelegationChain(record, authorityRecords, now, 32);
        if (!followed.valid || typeof record.record.delegateDid !== 'string' || this.enrolledRepos.has(record.record.delegateDid)) continue;
        this.enrolledRepos.add(record.record.delegateDid);
        changed = true;
      }
    }
    for (const record of this.currentRecords.values()) {
      if (record.repoDid !== this.policy.rootDid || revoked(record)) continue;
      if (record.record.$type === 'us.dsaslate.temp.authorityAttestation' && record.record.claim === 'recognizesController') {
        if (typeof record.record.expiresAt === 'string' && Date.parse(record.record.expiresAt) <= now) continue;
        const subject = record.record.subject as StrongRef;
        const subjectRecord = (this.recordVersions.get(subject.uri) ?? []).find((candidate) => candidate.cid === subject.cid);
        if (subjectRecord) this.enrolledRepos.add(subjectRecord.repoDid);
      }
    }
  }

  private watermark() {
    return Math.max(0, ...[...this.currentRecords.values()].map((record) => record.sequence));
  }

  private advanceGlobalEvent(did: string, sequence: number, cursor: number, updatedAt: string) {
    const current = this.repoStates.get(did);
    const next: RepoSyncState = { did, pds: current?.pds, rev: current?.rev, treeRoot: current?.treeRoot, lastSequence: Math.max(current?.lastSequence ?? 0, sequence), cursor: Math.max(current?.cursor ?? 0, cursor), status: current?.status ?? 'active', updatedAt };
    this.repoStates.set(did, next);
    return next;
  }
}
