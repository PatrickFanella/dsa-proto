import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { z } from 'zod';
import { ensureValidAtUri, ensureValidDid } from '@atproto/syntax';
import { allSeedRecords, authorityDisputeRecordSchema, authorityRevocationRecordSchema, recordArchiveRecordSchema, endorsementPublicRecordSchema, governanceRelationshipRecordSchema, isDirectoryEntityRecord, matchesDirectoryEntity, orgUnitRecordSchema, publicEventRecordSchema, publicStatementRecordSchema, publicationArticleRecordSchema, publicationProfileRecordSchema, recordEnvelopeSchema, normalizeDirectoryEntity, type AuthorityResolverStatus, type DirectoryEntity, type DirectoryEntityFilters, type EndorsementPublicRecord, type GovernanceRelationshipRecord, type OrgUnitRecord, type PublicEventRecord, type PublicStatementRecord, type PublicationArticleRecord, type PublicationProfileRecord, type RecordEnvelope, type ResolvedRecordAuthority } from './domain.js';
import { loadFixtureFile, type FixtureDatasetMetadata } from './fixture-files.js';
import { replayFixtureRecords } from './fixture-replay.js';
import { authenticateAppFromToken, validateRecordEnvelopeAgainstAppScope, type AppRegistryEntry } from './app-registry.js';
import { getRegistryHealthSummary, loadRegistryHealthReport } from './registry-health.js';
import { InMemoryWriteOperationStore, writeOperationSchema, type WriteOperation } from './write-operations.js';
import { applyMigrations } from './migrations.js';
import { migrateLegacyRecords } from './legacy-migration.js';
import { DEFAULT_POLICY_VERSION, DEFAULT_PROVISIONAL_ROOT_DID } from './foundation-model.js';
import { FoundationService, InvalidCursorError } from './foundation-service.js';
import { FoundationPostgresPersistence } from './foundation-postgres.js';
import { OAuthService, PdsWriteError, type OAuthServiceConfig, type SelfRecordWriteInput } from './oauth-service.js';

const envFlagSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().default('postgres://dsa_proto:change-me@localhost:5432/dsa_proto?sslmode=disable'),
  CORS_ORIGIN: z.string().default('*'),
  DEMO_READ_ONLY: envFlagSchema.default(false),
  ENABLE_ADMIN_INGEST: envFlagSchema.default(false),
  ENABLE_WRITE_GATEWAY: envFlagSchema.default(false),
  ENABLE_WRITE_PUBLISH: envFlagSchema.default(false),
  ENABLE_REVIEW_SUBMISSIONS: envFlagSchema.default(false),
  ENABLE_OAUTH: envFlagSchema.default(false),
  AUTO_REPLAY_FIXTURES: envFlagSchema.default(true),
  REQUIRE_POSTGRES: envFlagSchema.default(false),
  PROVISIONAL_ROOT_DID: z.string().default(DEFAULT_PROVISIONAL_ROOT_DID),
  PROVISIONAL_ROOT_DID_FILE: z.string().optional(),
  PUBLIC_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
  WRITE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
  APP_PUBLIC_URL: z.string().url().default('https://app-staging.dsaslate.us'),
  OAUTH_HANDLE_RESOLVER: z.string().url().default('https://pds-staging.dsaslate.us'),
  OAUTH_PDS_INTERNAL_URL: z.string().url().optional(),
  OAUTH_SERVICE_DID: z.string().default('did:web:api-staging.dsaslate.us'),
  OAUTH_ENCRYPTION_KEY_FILE: z.string().optional(),
  OAUTH_PRIVATE_KEY_FILE: z.string().optional(),
  OAUTH_PRIVATE_KEY_ALG: z.enum(['ES256', 'ES256K']).default('ES256'),
  OAUTH_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('dsaslate_oauth'),
  OAUTH_HANDOFF_RETURN_ORIGINS: z.string().default(''),
});

export type AppConfig = z.infer<typeof envSchema>;

export type DirectoryRepository = {
  foundation: FoundationService;
  foundationPersistence?: FoundationPostgresPersistence;
  oauthService?: OAuthService;
  listEntities(filters?: DirectoryEntityFilters): Promise<DirectoryEntity[]>;
  getEntity(id: string): Promise<DirectoryEntity | undefined>;
  listStatements(entityUri?: string): Promise<Array<ReturnType<typeof normalizeStatementEnvelope>>>;
  getStatement(id: string): Promise<ReturnType<typeof normalizeStatementEnvelope> | undefined>;
  listPublications(): Promise<Array<ReturnType<typeof normalizePublicationProfileEnvelope>>>;
  getPublication(id: string): Promise<ReturnType<typeof normalizePublicationProfileEnvelope> | undefined>;
  listArticles(publicationUri?: string, entityUri?: string): Promise<Array<ReturnType<typeof normalizePublicationArticleEnvelope>>>;
  getArticle(id: string): Promise<ReturnType<typeof normalizePublicationArticleEnvelope> | undefined>;
  listEndorsements(entityUri?: string, status?: EndorsementPublicRecord['status']): Promise<Array<ReturnType<typeof normalizeEndorsementEnvelope>>>;
  getEndorsement(id: string): Promise<ReturnType<typeof normalizeEndorsementEnvelope> | undefined>;
  listEvents(entityUri?: string, status?: PublicEventRecord['status']): Promise<Array<ReturnType<typeof normalizeEventEnvelope>>>;
  getEvent(id: string): Promise<ReturnType<typeof normalizeEventEnvelope> | undefined>;
  listActivity(filters?: { entityUri?: string; type?: ActivityType }): Promise<Array<ReturnType<typeof normalizeActivityEnvelope>>>;
  ingestRecordEnvelopes(records: RecordEnvelope[]): Promise<void>;
  getOrgChart(filters?: { kind?: OrgUnitRecord['kind']; unit?: string }): Promise<{ prototype: true; sourceUrl: string; updatedLabel: string; units: Array<{ uri: string; name: string; shortName: string; kind: OrgUnitRecord['kind']; description: string; status: string; website?: string }>; relationships: Array<{ uri: string; subjectUri: string; relationship: GovernanceRelationshipRecord['relationship']; objectUri: string; description: string; sourceUrl: string; status: string; createdAt: string }> }>;
  listRecordRevisions(uri: string): Promise<RecordEnvelope[]>;
  resolveRecordAuthority(uri: string, options?: { asOf?: string; depth?: number }): Promise<ResolvedRecordAuthority>;
  datasetMetadata?: FixtureDatasetMetadata;
};

export type ActivityType = 'statement' | 'article' | 'endorsement' | 'event';

export function getConfig(env: NodeJS.ProcessEnv = process.env) {
  const rootDid = env.PROVISIONAL_ROOT_DID_FILE
    ? readFileSync(env.PROVISIONAL_ROOT_DID_FILE, 'utf8').trim()
    : env.PROVISIONAL_ROOT_DID;
  return envSchema.parse({ ...env, ...(rootDid ? { PROVISIONAL_ROOT_DID: rootDid } : {}) });
}

function toJson(res: ServerResponse<IncomingMessage>, statusCode: number, body: unknown) {
  res.writeHead(statusCode, {
    'content-type': 'application/json',
  });
  res.end(JSON.stringify(body));
}

function applyCors(req: IncomingMessage, res: ServerResponse<IncomingMessage>, corsOrigin: string, allowedMethods: string) {
  if (corsOrigin === '*') {
    res.setHeader('access-control-allow-origin', '*');
  } else if (req.headers.origin === corsOrigin) {
    res.setHeader('access-control-allow-origin', corsOrigin);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('vary', 'Origin');
  }
  res.setHeader('access-control-allow-headers', 'content-type, authorization, dpop, x-request-id, x-dsa-app-token, idempotency-key, if-match, if-none-match');
  res.setHeader('access-control-allow-methods', allowedMethods);
}

function routeDisabled() {
  return { error: 'not_found' };
}

function apiError(res: ServerResponse<IncomingMessage>, statusCode: number, error: string, message: string) {
  return toJson(res, statusCode, {
    error,
    message,
    requestId: String(res.getHeader('x-request-id') ?? ''),
    retryable: statusCode === 429 || statusCode >= 500,
  });
}

function requestIdentity(req: IncomingMessage) {
  return req.socket.remoteAddress ?? 'unknown';
}

function consumeRateLimit(store: Map<string, { window: number; count: number }>, key: string, limit: number) {
  const window = Math.floor(Date.now() / 60_000);
  const current = store.get(key);
  if (!current || current.window !== window) {
    store.set(key, { window, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function getRequestHeader(req: IncomingMessage, name: string) {
  const value = req.headers[name.toLowerCase() as keyof IncomingMessage['headers']];
  return Array.isArray(value) ? value[0] : value;
}

function getAppToken(req: IncomingMessage) {
  const authorization = getRequestHeader(req, 'authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim();
  const token = getRequestHeader(req, 'x-dsa-app-token');
  return typeof token === 'string' ? token.trim() : undefined;
}

function validateWriteHeaders(req: IncomingMessage) {
  const idempotencyKey = getRequestHeader(req, 'idempotency-key');
  if (!idempotencyKey) return ['missing Idempotency-Key'];
  const ifNoneMatch = getRequestHeader(req, 'if-none-match');
  const ifMatch = getRequestHeader(req, 'if-match');
  if (ifNoneMatch === '*' || (typeof ifMatch === 'string' && ifMatch.trim().length > 0)) return [];
  return ['missing optimistic concurrency header: use If-None-Match: * or If-Match: <cid>'];
}

function normalizeWriteOperation(operation: WriteOperation) {
  return writeOperationSchema.parse(operation);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashWriteRequest(input: { mode: 'dry_run' | 'publish'; record: unknown; dryRun: boolean }) {
  return `sha256:${createHash('sha256').update(stableStringify(input)).digest('hex')}`;
}

async function readJsonBody(req: IncomingMessage) {
  const declaredLength = Number(getRequestHeader(req, 'content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 1024 * 1024) {
    req.resume();
    return Symbol.for('body-too-large');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1024 * 1024) return Symbol.for('body-too-large');
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return Symbol.for('invalid-json');
  }
}

function parseIntegerParam(url: URL, name: string, minimum: number, maximum: number) {
  const value = url.searchParams.get(name);
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  return parsed;
}

function validateAtUri(value: string, field: string) {
  try {
    ensureValidAtUri(value);
  } catch {
    throw new Error(`${field} must be a normalized AT URI`);
  }
  return value;
}

function publicReviewOperation(operation: ReturnType<FoundationService['submitForReview']>) {
  return {
    operationId: operation.operationId,
    submitterDid: operation.submitterDid,
    collection: operation.collection,
    status: operation.status,
    record: operation.record,
    ...(operation.reason ? { reason: operation.reason } : {}),
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
  };
}

type FoundationRouteOptions = {
  enableReviewSubmissions: boolean;
  authenticateReviewRequest?: (req: IncomingMessage) => string | Promise<string>;
};

async function refreshFoundationFromDurableStore(repository: DirectoryRepository) {
  if (!repository.foundationPersistence) return;
  const policy = repository.foundation.policy;
  const refreshed = new FoundationService(await repository.foundationPersistence.loadRecords(), policy);
  refreshed.restoreRepoStates(await repository.foundationPersistence.loadRepoStates());
  refreshed.restoreIdentityStates(await repository.foundationPersistence.loadIdentityStates());
  await repository.foundationPersistence.purgeExpiredReviewOperations();
  refreshed.restoreReviewOperations(await repository.foundationPersistence.loadReviewOperations());
  repository.foundation = refreshed;
}

async function handleFoundationRoute(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  repository: DirectoryRepository,
  options: FoundationRouteOptions,
) {
  if (!req.url) return false;
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/xrpc/us.dsaslate.temp.') && !url.pathname.startsWith('/api/v1/')) return false;
  await refreshFoundationFromDurableStore(repository);
  const xrpc = url.pathname.startsWith('/xrpc/') ? url.pathname.slice('/xrpc/'.length) : undefined;

  const listEntities = () => repository.foundation.listEntities({
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: parseIntegerParam(url, 'limit', 1, 100),
    q: url.searchParams.get('q') ?? undefined,
    unitKind: url.searchParams.get('unitKind') ?? undefined,
  });
  const getOrgGraph = () => repository.foundation.getOrgGraph({
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: parseIntegerParam(url, 'limit', 1, 100),
  });
  const listActivity = () => repository.foundation.listActivity({
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: parseIntegerParam(url, 'limit', 1, 100),
    entity: url.searchParams.get('entity') ? validateAtUri(url.searchParams.get('entity')!, 'entity') : undefined,
  });
  const resolveAuthority = () => {
    const uri = url.searchParams.get('uri');
    if (!uri) throw new Error('uri is required');
    const asOf = url.searchParams.get('asOf') ?? undefined;
    if (asOf && Number.isNaN(Date.parse(asOf))) throw new Error('asOf must be an ISO datetime');
    return repository.foundation.resolve(validateAtUri(uri, 'uri'), { asOf, depth: parseIntegerParam(url, 'depth', 0, 32) });
  };
  const syncStatus = () => {
    const did = url.searchParams.get('did') ?? undefined;
    if (did) ensureValidDid(did);
    return repository.foundation.getSyncStatus(did);
  };

  try {
    if (req.method === 'GET' && xrpc === 'us.dsaslate.temp.listEntities') return toJson(res, 200, listEntities()), true;
    if (req.method === 'GET' && xrpc === 'us.dsaslate.temp.getEntity') {
      const entityUri = url.searchParams.get('entityUri');
      if (!entityUri) throw new Error('entityUri is required');
      const entity = repository.foundation.getEntity(validateAtUri(entityUri, 'entityUri'));
      if (!entity) return apiError(res, 404, 'NotFound', 'entity not found'), true;
      return toJson(res, 200, { entity }), true;
    }
    if (req.method === 'GET' && xrpc === 'us.dsaslate.temp.getOrgGraph') return toJson(res, 200, getOrgGraph()), true;
    if (req.method === 'GET' && xrpc === 'us.dsaslate.temp.resolveAuthority') return toJson(res, 200, resolveAuthority()), true;
    if (req.method === 'GET' && xrpc === 'us.dsaslate.temp.listActivity') return toJson(res, 200, listActivity()), true;
    if (req.method === 'GET' && xrpc === 'us.dsaslate.temp.getSyncStatus') return toJson(res, 200, { sync: syncStatus() }), true;

    if (req.method === 'GET' && url.pathname === '/api/v1/entities') {
      const page = listEntities();
      return toJson(res, 200, { contractVersion: 'v1', data: page.entities, ...(page.cursor ? { cursor: page.cursor } : {}) }), true;
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/v1/entities/')) {
      const entityUri = validateAtUri(decodeURIComponent(url.pathname.slice('/api/v1/entities/'.length)), 'entityUri');
      const entity = repository.foundation.getEntity(entityUri);
      if (!entity) return apiError(res, 404, 'not_found', 'entity not found'), true;
      return toJson(res, 200, { contractVersion: 'v1', data: entity }), true;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/org-graph') {
      const graph = getOrgGraph();
      return toJson(res, 200, { contractVersion: 'v1', data: { entities: graph.entities, relationships: graph.relationships }, ...(graph.cursor ? { cursor: graph.cursor } : {}) }), true;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/records/resolve') return toJson(res, 200, { contractVersion: 'v1', data: resolveAuthority() }), true;
    if (req.method === 'GET' && url.pathname === '/api/v1/activity') {
      const page = listActivity();
      return toJson(res, 200, { contractVersion: 'v1', data: page.items, ...(page.cursor ? { cursor: page.cursor } : {}) }), true;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/sync/status') return toJson(res, 200, { contractVersion: 'v1', data: syncStatus() }), true;

    const isReviewSubmit = req.method === 'POST' && (xrpc === 'us.dsaslate.temp.submitForReview' || url.pathname === '/api/v1/review/operations');
    const isReviewGet = req.method === 'GET' && (xrpc === 'us.dsaslate.temp.getReviewOperation' || url.pathname === '/api/v1/review/operations');
    const decisionMatch = req.method === 'POST' ? url.pathname.match(/^\/api\/v1\/review\/operations\/([^/]+)\/decision$/) : null;
    if (decisionMatch) {
      if (!options.enableReviewSubmissions) return apiError(res, 404, 'not_found', 'review API is disabled'), true;
      if (!options.authenticateReviewRequest || !repository.oauthService) return apiError(res, 401, 'unauthorized', 'registry OAuth authentication is required'), true;
      const actorDid = await options.authenticateReviewRequest(req);
      if (actorDid !== repository.foundation.policy.rootDid) return apiError(res, 403, 'forbidden', 'only the provisional registry root may decide review operations'), true;
      const operationId = decodeURIComponent(decisionMatch[1]);
      const current = repository.foundation.getReviewOperation(operationId);
      if (!current) return apiError(res, 404, 'not_found', 'review operation not found'), true;
      if (current.status !== 'pending') throw new Error(`review operation is already ${current.status}`);
      const body = await readJsonBody(req);
      if (body === Symbol.for('body-too-large')) return apiError(res, 413, 'payload_too_large', 'request body exceeds 1 MiB'), true;
      if (body === Symbol.for('invalid-json') || !body || typeof body !== 'object' || Array.isArray(body)) throw new Error('decision body must be valid JSON');
      const input = body as { decision?: unknown; reason?: unknown };
      if ((input.decision !== 'approve' && input.decision !== 'reject') || typeof input.reason !== 'string' || !input.reason.trim()) throw new Error('decision must be approve or reject and reason is required');
      const targetRef = current.record.target && typeof current.record.target === 'object'
        && typeof (current.record.target as { uri?: unknown }).uri === 'string'
        && typeof (current.record.target as { cid?: unknown }).cid === 'string'
        ? current.record.target as { uri: string; cid: string }
        : undefined;
      const target = targetRef ? `${targetRef.uri}#${targetRef.cid}` : 'record content';
      if (input.decision === 'reject') {
        const rejected = repository.foundation.updateReviewOperation(operationId, { actorDid, status: 'rejected', decision: 'reject', reason: input.reason, target: targetRef, policyVersion: repository.foundation.policy.policyVersion, message: `${input.reason}; policy ${repository.foundation.policy.policyVersion}; target ${target}` });
        await repository.foundationPersistence?.persistReviewOperation(rejected);
        return toJson(res, 200, { contractVersion: 'v1', data: publicReviewOperation(rejected) }), true;
      }
      const approved = repository.foundation.updateReviewOperation(operationId, { actorDid, status: 'approved', decision: 'approve', reason: input.reason, target: targetRef, policyVersion: repository.foundation.policy.policyVersion, message: `${input.reason}; policy ${repository.foundation.policy.policyVersion}; target ${target}` });
      await repository.foundationPersistence?.persistReviewOperation(approved);
      try {
        const publication = await repository.oauthService.publishRegistryRecord(actorDid, current.collection, current.record);
        const published = repository.foundation.updateReviewOperation(operationId, { actorDid, status: 'published', message: `published ${publication.uri}#${publication.cid} under policy ${repository.foundation.policy.policyVersion}` });
        await repository.foundationPersistence?.persistReviewOperation(published);
        return toJson(res, 200, { contractVersion: 'v1', data: publicReviewOperation(published) }), true;
      } catch (error) {
        const failed = repository.foundation.updateReviewOperation(operationId, { actorDid, status: 'failed', message: error instanceof Error ? error.message : 'registry publication failed' });
        await repository.foundationPersistence?.persistReviewOperation(failed);
        return apiError(res, 502, 'registry_publication_failed', 'approved review could not be published'), true;
      }
    }
    if (isReviewSubmit || isReviewGet) {
      if (!options.enableReviewSubmissions) return apiError(res, 404, 'not_found', 'review API is disabled'), true;
      if (!options.authenticateReviewRequest) return apiError(res, 401, 'unauthorized', 'OAuth DPoP authentication is required'), true;
      let submitterDid: string;
      try {
        submitterDid = await options.authenticateReviewRequest(req);
        ensureValidDid(submitterDid);
      } catch {
        return apiError(res, 401, 'unauthorized', 'OAuth DPoP authentication failed'), true;
      }
      if (isReviewSubmit) {
        const body = await readJsonBody(req);
        if (body === Symbol.for('body-too-large')) return apiError(res, 413, 'payload_too_large', 'request body exceeds 1 MiB'), true;
        if (body === Symbol.for('invalid-json')) return apiError(res, 400, 'invalid_json', 'request body must be valid JSON'), true;
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object');
        const input = body as { collection?: unknown; record?: unknown; reason?: unknown };
        if (typeof input.collection !== 'string' || !input.record || typeof input.record !== 'object') throw new Error('collection and record are required');
        if (input.reason !== undefined && typeof input.reason !== 'string') throw new Error('reason must be a string');
        const operation = repository.foundation.submitForReview({ submitterDid, collection: input.collection, record: input.record, reason: input.reason });
        await repository.foundationPersistence?.persistReviewOperation(operation);
        const output = { operation: publicReviewOperation(operation) };
        return toJson(res, 202, xrpc ? output : { contractVersion: 'v1', data: output.operation }), true;
      }
      const operationId = url.searchParams.get('operationId');
      if (!operationId) throw new Error('operationId is required');
      const operation = repository.foundation.getReviewOperation(operationId, submitterDid);
      if (!operation) return apiError(res, 404, xrpc ? 'NotFound' : 'not_found', 'review operation not found'), true;
      const output = { operation: publicReviewOperation(operation) };
      return toJson(res, 200, xrpc ? output : { contractVersion: 'v1', data: output.operation }), true;
    }
  } catch (error) {
    if (error instanceof InvalidCursorError) return apiError(res, 400, 'InvalidCursor', error.message), true;
    return apiError(res, 400, xrpc ? 'InvalidRequest' : 'invalid_request', error instanceof Error ? error.message : 'invalid request'), true;
  }
  return false;
}

export function createMemoryRepository(seed: RecordEnvelope[] = allSeedRecords, datasetMetadata?: FixtureDatasetMetadata): DirectoryRepository {
  const rawRecords = seed.map((record) => recordEnvelopeSchema.parse(record));
  const records = dedupeEntities(rawRecords);
  const recordRevisions = dedupeRecordRevisions(rawRecords);
  const migration = migrateLegacyRecords(rawRecords);
  const policyRecord = migration.records.find((record) => record.record.$type === 'us.dsaslate.temp.dsaPolicy');
  if (!policyRecord) throw new Error('foundation migration did not produce a policy record');
  const foundation = new FoundationService(migration.records, { rootDid: policyRecord.repoDid, policyUri: policyRecord.uri, policyCid: policyRecord.cid, policyVersion: String(policyRecord.record.policyVersion ?? DEFAULT_POLICY_VERSION) });
  return {
    foundation,
    datasetMetadata,
    async listEntities(filters: DirectoryEntityFilters = {}) {
      const limited = records.filter((entity) => matchesDirectoryEntity(entity, filters));
      return typeof filters.limit === 'number' ? limited.slice(0, Math.max(0, filters.limit)) : limited;
    },
    async getEntity(id: string) {
      return records.find((record) => record.id === id);
    },
    async listStatements(entityUri?: string) {
      return listStatementEnvelopes(rawRecords, entityUri);
    },
    async getStatement(id: string) {
      return listStatementEnvelopes(rawRecords).find((record) => record.uri === id);
    },
    async listPublications() { return listPublicationProfileEnvelopes(rawRecords); },
    async getPublication(id: string) { return listPublicationProfileEnvelopes(rawRecords).find((record) => record.uri === id); },
    async listArticles(publicationUri?: string, entityUri?: string) { return listPublicationArticleEnvelopes(rawRecords, publicationUri, entityUri); },
    async getArticle(id: string) { return listPublicationArticleEnvelopes(rawRecords).find((record) => record.uri === id); },
    async listEndorsements(entityUri?: string, status?: EndorsementPublicRecord['status']) { return listEndorsementEnvelopes(rawRecords, entityUri, status); },
    async getEndorsement(id: string) { return listEndorsementEnvelopes(rawRecords).find((record) => record.uri === id); },
    async listEvents(entityUri?: string, status?: PublicEventRecord['status']) { return listEventEnvelopes(rawRecords, entityUri, status); },
    async getEvent(id: string) { return listEventEnvelopes(rawRecords).find((record) => record.uri === id); },
    async listActivity(filters = {}) { return listActivityEnvelopes(rawRecords, filters); },
    async ingestRecordEnvelopes(nextRecords) {
      const parsed = nextRecords.map((item) => recordEnvelopeSchema.parse(item));
      for (const record of parsed) {
        const existingRevision = recordRevisions.find((item) => item.uri === record.uri && item.cid === record.cid);
        if (existingRevision && !sameImmutableRecord(existingRevision, record)) {
          throw new Error(`refusing to overwrite immutable record contents for ${record.uri} with same cid ${record.cid}`);
        }
        if (!existingRevision) recordRevisions.push(record);
        const existingCurrentIndex = rawRecords.findIndex((item) => item.uri === record.uri);
        if (existingCurrentIndex >= 0) rawRecords[existingCurrentIndex] = record;
        else rawRecords.push(record);
      }
      const nextDirectoryRecords = dedupeEntities(rawRecords);
      records.splice(0, records.length, ...nextDirectoryRecords);
    },
    async getOrgChart(filters = {}) {
      return buildOrgChartFromRecords(rawRecords, filters);
    },
    async listRecordRevisions(uri: string) {
      return recordRevisions.filter((record) => record.uri === uri).sort((a, b) => a.indexedAt.localeCompare(b.indexedAt));
    },
    async resolveRecordAuthority(uri: string, options?: { asOf?: string; depth?: number }) {
      return resolveRecordAuthorityFromRecords(uri, recordRevisions, options);
    },
  };
}

function dedupeEntities(rawRecords: RecordEnvelope[]) {
  return rawRecords.filter(isDirectoryEntityRecord).map((item) => normalizeDirectoryEntity(item, rawRecords)).filter((item): item is DirectoryEntity => Boolean(item)).reduce<DirectoryEntity[]>((acc, entity) => {
    const existingIndex = acc.findIndex((entry) => entry.id === entity.id);
    if (existingIndex >= 0) acc[existingIndex] = entity;
    else acc.push(entity);
    return acc;
  }, []);
}

export async function createPostgresRepository(databaseUrl: string, options: { rootDid?: string; oauth?: OAuthServiceConfig } = {}): Promise<DirectoryRepository> {
  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query('select 1');
  await applyMigrations(pool);
  await ensurePrototypeSchema(pool);
  const foundationPersistence = new FoundationPostgresPersistence(pool);
  let foundationRecords = await foundationPersistence.loadRecords();
  if (!foundationRecords.length) {
    foundationRecords = migrateLegacyRecords([], { rootDid: options.rootDid }).records;
    await foundationPersistence.replaceBootstrap(foundationRecords);
  }
  const policyRecord = foundationRecords.find((record) => record.record.$type === 'us.dsaslate.temp.dsaPolicy');
  if (!policyRecord) throw new Error('foundation store does not contain a policy record');
  const foundation = new FoundationService(foundationRecords, { rootDid: policyRecord.repoDid, policyUri: policyRecord.uri, policyCid: policyRecord.cid, policyVersion: String(policyRecord.record.policyVersion ?? DEFAULT_POLICY_VERSION) });
  foundation.restoreRepoStates(await foundationPersistence.loadRepoStates());
  foundation.restoreIdentityStates(await foundationPersistence.loadIdentityStates());
  await foundationPersistence.purgeExpiredReviewOperations();
  foundation.restoreReviewOperations(await foundationPersistence.loadReviewOperations());
  const oauthService = options.oauth ? await OAuthService.create(pool, options.oauth) : undefined;
  return {
    foundation,
    foundationPersistence,
    oauthService,
    async listEntities(filters: DirectoryEntityFilters = {}) {
      const assertions = await loadVerificationAssertions(pool);
      const limit = normalizeLimit(filters.limit);
      const result = await pool.query(`
        select
          directory_entities.id,
          directory_entities.record_uri,
          directory_entities.entity_type,
          directory_entities.name,
          directory_entities.short_name,
          atproto_records.collection,
          directory_entities.handle,
          directory_entities.did,
          directory_entities.jurisdiction_name,
          directory_entities.jurisdiction_region,
          directory_entities.description,
          directory_entities.trust_label,
          directory_entities.verification_status,
          directory_entities.verified_by,
          directory_entities.verification_reason,
          directory_entities.status,
          directory_entities.website,
          directory_entities.search_text,
          atproto_records.record
        from directory_entities
        join atproto_records on atproto_records.uri = directory_entities.record_uri
        where ($1 = 'all' or directory_entities.entity_type = $1)
          and ($2 = '' or directory_entities.search_text like '%' || $2 || '%')
          and ($3 = '' or upper(directory_entities.jurisdiction_region) = $3)
          and ($4 = '' or lower(coalesce((atproto_records.record->'jurisdiction'->>'type'), '')) = $4)
        order by directory_entities.name asc
        limit $5
      `, [filters.type ?? 'all', filters.search?.trim().toLowerCase() ?? '', filters.state?.trim().toUpperCase() ?? '', filters.jurisdictionType?.trim().toLowerCase() ?? '', limit]);
      return result.rows.map((row) => {
        const record = row.record as { jurisdiction?: { type?: string } };
        const entityType = row.entity_type as DirectoryEntity['type'];
        const jurisdiction = entityType === 'chapter'
          ? `${row.jurisdiction_name}, ${row.jurisdiction_region}`
          : entityType === 'member-affiliation'
            ? `affiliated with ${row.jurisdiction_name}`
            : row.jurisdiction_name;
        return {
          id: row.id,
          recordUri: row.record_uri,
          type: entityType,
          name: row.name,
          shortName: row.short_name,
          collection: row.collection,
          handle: row.handle,
          did: row.did,
          jurisdiction,
          jurisdictionState: entityType === 'chapter' ? row.jurisdiction_region : undefined,
          jurisdictionType: entityType === 'chapter' ? record.jurisdiction?.type ?? undefined : undefined,
          focusArea: entityType === 'caucus' ? row.jurisdiction_region : undefined,
          publicRole: entityType === 'member-affiliation' ? row.description ?? undefined : undefined,
          memberHandle: entityType === 'member-affiliation' ? row.handle : undefined,
          organizationHandle: entityType === 'member-affiliation' ? row.jurisdiction_name : undefined,
          trustLabel: row.trust_label,
          verificationStatus: assertions.get(row.record_uri)?.verificationStatus ?? row.verification_status,
          verifiedBy: assertions.get(row.record_uri)?.verifiedBy ?? row.verified_by ?? undefined,
          verificationReason: assertions.get(row.record_uri)?.verificationReason ?? row.verification_reason ?? undefined,
          status: row.status,
          website: row.website,
          searchText: row.search_text,
          record: row.record,
        };
      });
    },
    async getEntity(id: string) {
      const assertions = await loadVerificationAssertions(pool);
      const result = await pool.query(`
        select
          directory_entities.id,
          directory_entities.record_uri,
          directory_entities.entity_type,
          directory_entities.name,
          directory_entities.short_name,
          atproto_records.collection,
          directory_entities.handle,
          directory_entities.did,
          directory_entities.jurisdiction_name,
          directory_entities.jurisdiction_region,
          directory_entities.description,
          directory_entities.trust_label,
          directory_entities.verification_status,
          directory_entities.verified_by,
          directory_entities.verification_reason,
          directory_entities.status,
          directory_entities.website,
          directory_entities.search_text,
          atproto_records.record
        from directory_entities
        join atproto_records on atproto_records.uri = directory_entities.record_uri
        where directory_entities.id = $1
      `, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      const record = row.record as { jurisdiction?: { type?: string } };
      const entityType = row.entity_type as DirectoryEntity['type'];
      const jurisdiction = entityType === 'chapter'
        ? `${row.jurisdiction_name}, ${row.jurisdiction_region}`
        : entityType === 'member-affiliation'
          ? `affiliated with ${row.jurisdiction_name}`
          : row.jurisdiction_name;
      return {
        id: row.id,
        recordUri: row.record_uri,
        type: entityType,
        name: row.name,
        shortName: row.short_name,
        collection: row.collection,
        handle: row.handle,
        did: row.did,
        jurisdiction,
        jurisdictionState: entityType === 'chapter' ? row.jurisdiction_region : undefined,
        jurisdictionType: entityType === 'chapter' ? record.jurisdiction?.type ?? undefined : undefined,
        focusArea: entityType === 'caucus' ? row.jurisdiction_region : undefined,
        publicRole: entityType === 'member-affiliation' ? row.description ?? undefined : undefined,
        memberHandle: entityType === 'member-affiliation' ? row.handle : undefined,
        organizationHandle: entityType === 'member-affiliation' ? row.jurisdiction_name : undefined,
        trustLabel: row.trust_label,
        verificationStatus: assertions.get(row.record_uri)?.verificationStatus ?? row.verification_status,
        verifiedBy: assertions.get(row.record_uri)?.verifiedBy ?? row.verified_by ?? undefined,
        verificationReason: assertions.get(row.record_uri)?.verificationReason ?? row.verification_reason ?? undefined,
        status: row.status,
        website: row.website,
        searchText: row.search_text,
        record: row.record,
      };
    },
    async listStatements(entityUri?: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_records where collection = 'org.dsa.statement.public' order by indexed_at desc`);
      return listStatementEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record } as RecordEnvelope)), entityUri);
    },
    async getStatement(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.statement.public' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizeStatementEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record });
    },
    async listPublications() {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_records where collection = 'org.dsa.publication.profile' order by indexed_at desc`);
      return listPublicationProfileEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record } as RecordEnvelope)));
    },
    async getPublication(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.publication.profile' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizePublicationProfileEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record });
    },
    async listArticles(publicationUri?: string, entityUri?: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_records where collection = 'org.dsa.publication.article' order by indexed_at desc`);
      return listPublicationArticleEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record } as RecordEnvelope)), publicationUri, entityUri);
    },
    async getArticle(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.publication.article' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizePublicationArticleEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record });
    },
    async listEndorsements(entityUri?: string, status?: EndorsementPublicRecord['status']) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_records where collection = 'org.dsa.endorsement.public' order by indexed_at desc`);
      return listEndorsementEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record } as RecordEnvelope)), entityUri, status);
    },
    async getEndorsement(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.endorsement.public' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizeEndorsementEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record });
    },
    async listEvents(entityUri?: string, status?: PublicEventRecord['status']) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_records where collection = 'org.dsa.event.public' order by indexed_at desc`);
      return listEventEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record } as RecordEnvelope)), entityUri, status);
    },
    async getEvent(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.event.public' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizeEventEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record });
    },
    async listActivity(filters = {}) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_records where collection in ('org.dsa.statement.public', 'org.dsa.publication.article', 'org.dsa.endorsement.public', 'org.dsa.event.public') order by indexed_at desc`);
      return listActivityEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record } as RecordEnvelope)), filters);
    },
    async ingestRecordEnvelopes(nextRecords) {
      const parsed = nextRecords.map((item) => recordEnvelopeSchema.parse(item));
      for (const rawRecord of parsed) {
        const client = await pool.connect();
        try {
          await client.query('begin');
          await client.query(
            `insert into atproto_record_revisions (uri, cid, did, handle, collection, record, trust_label, indexed_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8)
             on conflict (uri, cid) do nothing`,
            [rawRecord.uri, rawRecord.cid, rawRecord.did, rawRecord.handle, rawRecord.collection, rawRecord.record, rawRecord.trustLabel, rawRecord.indexedAt],
          );
          const existing = await client.query(
            `select cid, did, handle, collection, record, trust_label, indexed_at from atproto_record_revisions where uri = $1 and cid = $2 limit 1`,
            [rawRecord.uri, rawRecord.cid],
          );
          const existingRow = existing.rows[0] as { cid: string; did: string; handle: string; collection: string; record: unknown; trust_label: string; indexed_at: Date | string } | undefined;
          if (!existingRow || !sameImmutableRecord(rowToRevisionEnvelope(rawRecord.uri, existingRow), rawRecord)) {
            throw new Error(`refusing to overwrite immutable record contents for ${rawRecord.uri} with same cid ${rawRecord.cid}`);
          }
          await client.query(
            `insert into atproto_records (uri, cid, did, handle, collection, record, trust_label, indexed_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8)
             on conflict (uri) do update set cid = excluded.cid, did = excluded.did, handle = excluded.handle, collection = excluded.collection, record = excluded.record, trust_label = excluded.trust_label, indexed_at = excluded.indexed_at`,
            [rawRecord.uri, rawRecord.cid, rawRecord.did, rawRecord.handle, rawRecord.collection, rawRecord.record, rawRecord.trustLabel, rawRecord.indexedAt],
          );
          await client.query('commit');
        } catch (error) {
          await client.query('rollback');
          throw error;
        } finally {
          client.release();
        }
      }
      const nextDirectoryRecords = parsed.filter(isDirectoryEntityRecord).map((item) => normalizeDirectoryEntity(item, parsed)).filter((record): record is DirectoryEntity => Boolean(record));
      for (const record of nextDirectoryRecords) {
        const recordData = record.record.record as { $type: 'org.dsa.profile.chapter'; jurisdiction: { name: string; state: string }; } | { $type: 'org.dsa.affiliation.member'; organizationHandle: string; memberHandle: string; publicRole?: string | null } | { $type: 'org.dsa.profile.caucus'; focusArea: string };
        const jurisdictionName = recordData.$type === 'org.dsa.profile.chapter' ? recordData.jurisdiction.name : recordData.$type === 'org.dsa.affiliation.member' ? recordData.organizationHandle : 'caucus';
        const jurisdictionRegion = recordData.$type === 'org.dsa.profile.chapter' ? recordData.jurisdiction.state : recordData.$type === 'org.dsa.affiliation.member' ? recordData.memberHandle : recordData.focusArea;
        const description = recordData.$type === 'org.dsa.profile.chapter' ? null : recordData.$type === 'org.dsa.affiliation.member' ? recordData.publicRole ?? null : recordData.focusArea;
        await pool.query(
          `insert into directory_entities (id, record_uri, entity_type, name, short_name, handle, did, jurisdiction_name, jurisdiction_region, website, description, trust_label, verification_status, verified_by, verification_reason, status, search_text, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now())
           on conflict (id) do update set record_uri = excluded.record_uri, entity_type = excluded.entity_type, name = excluded.name, short_name = excluded.short_name, handle = excluded.handle, did = excluded.did, jurisdiction_name = excluded.jurisdiction_name, jurisdiction_region = excluded.jurisdiction_region, website = excluded.website, description = excluded.description, trust_label = excluded.trust_label, verification_status = excluded.verification_status, verified_by = excluded.verified_by, verification_reason = excluded.verification_reason, status = excluded.status, search_text = excluded.search_text, updated_at = now()`,
          [
            record.id,
            record.recordUri,
            record.type,
            record.name,
            record.shortName,
            record.handle,
            record.did,
            jurisdictionName,
            jurisdictionRegion,
            record.website,
            description,
            record.trustLabel,
            record.verificationStatus,
            record.verifiedBy ?? null,
            record.verificationReason ?? null,
            record.status,
            record.searchText,
          ],
        );
      }
    },
    async getOrgChart(filters = {}) {
      const result = await pool.query(`select uri, cid, did, handle, record, collection, trust_label, indexed_at from atproto_records where collection in ('org.dsa.profile.orgUnit', 'org.dsa.relationship.governance') order by indexed_at asc`);
      return buildOrgChartFromRecords(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record } as RecordEnvelope)), filters);
    },
    async listRecordRevisions(uri: string) {
      const result = await pool.query(`select id, uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_record_revisions where uri = $1 order by indexed_at asc, id asc`, [uri]);
      return result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record } as RecordEnvelope));
    },
    async resolveRecordAuthority(uri: string, options?: { asOf?: string; depth?: number }) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, trust_label, indexed_at from atproto_record_revisions order by indexed_at asc, id asc`);
      const revisions = result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: row.trust_label, record: row.record } as RecordEnvelope));
      return resolveRecordAuthorityFromRecords(uri, revisions, options);
    },
  };
}

async function ensurePrototypeSchema(pool: Pool) {
  await pool.query(`
    create table if not exists atproto_records (
      uri text primary key,
      cid text not null,
      did text not null,
      handle text not null,
      collection text not null,
      record jsonb not null,
      trust_label text not null default 'uncertain',
      indexed_at timestamptz not null
    )
  `);
  await pool.query(`alter table atproto_records add column if not exists trust_label text not null default 'uncertain'`);
  await pool.query(`update atproto_records set trust_label = 'uncertain' where trust_label = 'official'`);
  await pool.query(`
    create table if not exists atproto_record_revisions (
      id bigserial primary key,
      uri text not null,
      cid text not null,
      did text not null,
      handle text not null,
      collection text not null,
      record jsonb not null,
      trust_label text not null,
      indexed_at timestamptz not null,
      observed_at timestamptz not null default now(),
      unique (uri, cid)
    )
  `);
  await pool.query('create index if not exists atproto_record_revisions_uri_indexed_at_id_idx on atproto_record_revisions(uri, indexed_at, id)');
  await pool.query('create index if not exists atproto_record_revisions_uri_idx on atproto_record_revisions(uri)');
  await pool.query('create index if not exists atproto_record_revisions_collection_idx on atproto_record_revisions(collection)');
  await pool.query('create index if not exists atproto_record_revisions_indexed_at_idx on atproto_record_revisions(indexed_at)');
  await pool.query(`insert into atproto_record_revisions (uri, cid, did, handle, collection, record, trust_label, indexed_at) select uri, cid, did, handle, collection, record, coalesce(trust_label, 'uncertain'), indexed_at from atproto_records on conflict (uri, cid) do nothing`);
  await pool.query(`update atproto_record_revisions set trust_label = 'uncertain' where trust_label = 'official'`);
  await pool.query(`
    create table if not exists directory_entities (
      id text primary key,
      record_uri text not null references atproto_records(uri) on delete cascade,
      entity_type text not null,
      name text not null,
      short_name text not null,
      handle text not null,
      did text not null,
      jurisdiction_name text not null,
      jurisdiction_region text not null,
      website text not null,
      description text,
      trust_label text not null,
      status text not null,
      search_text text not null,
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(`alter table directory_entities add column if not exists verification_status text not null default 'uncertain'`);
  await pool.query(`alter table directory_entities add column if not exists verified_by text`);
  await pool.query(`alter table directory_entities add column if not exists verification_reason text`);
  await pool.query(`update directory_entities set trust_label = 'uncertain' where trust_label = 'official'`);
  await pool.query('create index if not exists directory_entities_entity_type_idx on directory_entities(entity_type)');
  await pool.query('create index if not exists directory_entities_search_text_idx on directory_entities(search_text)');
}

function dedupeRecordRevisions(records: RecordEnvelope[]) {
  return records.filter((record, index, self) => self.findIndex((item) => item.uri === record.uri && item.cid === record.cid) === index).map((record) => record);
}

function stableJson(value: unknown) {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sortJsonValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortJsonValue(item)]));
  }
  return value;
}

function sameImmutableRecord(left: RecordEnvelope, right: RecordEnvelope) {
  return left.uri === right.uri
    && left.cid === right.cid
    && left.did === right.did
    && left.collection === right.collection
    && stableJson(left.record) === stableJson(right.record);
}

function rowToRevisionEnvelope(uri: string, row: { cid: string; did: string; handle: string; collection: string; record: unknown; trust_label: string; indexed_at: Date | string }): RecordEnvelope {
  return recordEnvelopeSchema.parse({
    uri,
    cid: row.cid,
    did: row.did,
    handle: row.handle,
    collection: row.collection,
    indexedAt: new Date(row.indexed_at).toISOString(),
    trustLabel: row.trust_label,
    record: row.record,
  });
}

function resolveRecordAuthorityFromRecords(uri: string, revisions: RecordEnvelope[], options?: { asOf?: string; depth?: number }): ResolvedRecordAuthority {
  const asOf = options?.asOf ? new Date(options.asOf) : undefined;
  const visibleRecords = revisions.filter((revision) => !asOf || revision.indexedAt <= asOf.toISOString());
  const sortedRevisions = revisions.filter((revision) => revision.uri === uri).sort((a, b) => a.indexedAt.localeCompare(b.indexedAt));
  const visibleRevisions = sortedRevisions.filter((revision) => !asOf || revision.indexedAt <= asOf.toISOString());
  const current = visibleRevisions.at(-1);
  const fixtureSourceOfTruthCaveat = 'fixture source of truth; no external source chain';
  if (!current) {
    return { uri, revisions: sortedRevisions, authorityRecords: [], supportingAuthorityRecords: [], activeDisputes: [], activeRevocations: [], archiveMarkers: [], status: 'unresolved', caveats: [fixtureSourceOfTruthCaveat], fixtureSourceOfTruthCaveat };
  }
  const authorityRecords = latestRecordsByUri(visibleRecords.filter((record) => record.uri !== uri && isAuthorityRecordForTarget(record, uri)));
  const activeDisputes = authorityRecords.filter((record) => record.collection === 'org.dsa.authority.dispute' && authorityDisputeRecordSchema.safeParse(record.record).success && authorityDisputeRecordSchema.parse(record.record).status === 'active');
  const activeRevocations = authorityRecords.filter((record) => record.collection === 'org.dsa.authority.revocation' && authorityRevocationRecordSchema.safeParse(record.record).success && authorityRevocationRecordSchema.parse(record.record).status === 'active');
  const archiveMarkers = authorityRecords.filter((record) => record.collection === 'org.dsa.record.archive' && recordArchiveRecordSchema.safeParse(record.record).success && recordArchiveRecordSchema.parse(record.record).status === 'active');
  const supportingAuthorityRecords = authorityRecords.filter((record) => !activeDisputes.includes(record) && !activeRevocations.includes(record) && !archiveMarkers.includes(record));
  const disputed = authorityRecords.some((record) => {
    const parsed = authorityDisputeRecordSchema.safeParse(record.record);
    return record.collection === 'org.dsa.authority.dispute' && parsed.success && parsed.data.subjectUri === uri && parsed.data.status === 'active';
  });
  const revoked = authorityRecords.some((record) => {
    const parsed = authorityRevocationRecordSchema.safeParse(record.record);
    return record.collection === 'org.dsa.authority.revocation' && parsed.success && parsed.data.subjectUri === uri && parsed.data.status === 'active';
  });
  const archived = authorityRecords.some((record) => {
    const parsed = recordArchiveRecordSchema.safeParse(record.record);
    return record.collection === 'org.dsa.record.archive' && parsed.success && parsed.data.subjectUri === uri && parsed.data.status === 'active';
  });
  const expired = [current, ...authorityRecords].some((record) => isExpiredForTarget(record, uri, asOf));
  const rawLifecycleState = typeof (current.record as { status?: unknown }).status === 'string'
    ? (current.record as { status: string }).status
    : undefined;
  const lifecycleState = rawLifecycleState === 'active'
    || rawLifecycleState === 'inactive'
    || rawLifecycleState === 'superseded'
    || rawLifecycleState === 'deprecated'
    || rawLifecycleState === 'revoked'
    || rawLifecycleState === 'disputed'
    || rawLifecycleState === 'archived'
    || rawLifecycleState === 'tombstoned'
    ? rawLifecycleState
    : undefined;
  const status: AuthorityResolverStatus = revoked ? 'revoked' : disputed ? 'disputed' : archived ? 'archived' : expired ? 'expired' : lifecycleState && lifecycleState !== 'active' ? lifecycleState : 'valid';
  return { uri, record: current, revisions: sortedRevisions, authorityRecords, lifecycleState, trustLabel: current.trustLabel, supportingAuthorityRecords, activeDisputes, activeRevocations, archiveMarkers, status, caveats: [fixtureSourceOfTruthCaveat], fixtureSourceOfTruthCaveat };
}

function latestRecordsByUri(records: RecordEnvelope[]) {
  return records.reduce<RecordEnvelope[]>((acc, record) => {
    const existingIndex = acc.findIndex((entry) => entry.uri === record.uri);
    if (existingIndex < 0) return [...acc, record];
    const existing = acc[existingIndex];
    if (record.indexedAt.localeCompare(existing.indexedAt) >= 0) acc[existingIndex] = record;
    return acc;
  }, []);
}

function isAuthorityRecordForTarget(record: RecordEnvelope, targetUri: string) {
  if (record.collection === 'org.dsa.authority.delegation' && record.record.$type === 'org.dsa.authority.delegation') return record.record.subjectUri === targetUri || record.record.delegatedToUri === targetUri;
  if (record.collection === 'org.dsa.authority.mandate' && record.record.$type === 'org.dsa.authority.mandate') return record.record.subjectUri === targetUri;
  if (record.collection === 'org.dsa.authority.charter' && record.record.$type === 'org.dsa.authority.charter') return record.record.subjectUri === targetUri || record.record.charteredByUri === targetUri;
  if (record.collection === 'org.dsa.authority.revocation' && record.record.$type === 'org.dsa.authority.revocation') return record.record.subjectUri === targetUri || record.record.revokedByUri === targetUri;
  if (record.collection === 'org.dsa.authority.dispute' && record.record.$type === 'org.dsa.authority.dispute') return record.record.subjectUri === targetUri || record.record.raisedByUri === targetUri;
  if (record.collection === 'org.dsa.record.archive' && record.record.$type === 'org.dsa.record.archive') return record.record.subjectUri === targetUri || record.record.archivedByUri === targetUri;
  return false;
}

function isExpiredForTarget(record: RecordEnvelope, targetUri: string, asOf?: Date) {
  if (record.uri !== targetUri && getSubjectUri(record) !== targetUri) return false;
  if ('effectiveUntil' in record.record && record.record.effectiveUntil) return new Date(record.record.effectiveUntil) <= (asOf ?? new Date());
  return false;
}

function getSubjectUri(record: RecordEnvelope) {
  if ('subjectUri' in record.record && typeof record.record.subjectUri === 'string') return record.record.subjectUri;
  return undefined;
}

async function handleOAuthRoute(req: IncomingMessage, res: ServerResponse<IncomingMessage>, oauth: OAuthService | undefined, rootDid: string) {
  if (!req.url) return false;
  const url = new URL(req.url, 'http://localhost');
  const isSession = req.method === 'GET' && url.pathname === '/api/v1/session';
  const isOAuthPath = url.pathname.startsWith('/oauth/') || url.pathname === '/api/v1/self/records' || url.pathname === '/api/v1/delegation-handoff/records' || url.pathname === '/api/v1/event-handoff/records' || isSession;
  if (!isOAuthPath) return false;
  if (isSession && !oauth) return toJson(res, 200, { contractVersion: 'v1', data: { oauthEnabled: false, authenticated: false, capabilities: { selfWrite: false, reviewSubmission: false, registryReview: false, collections: [], actions: [] } } }), true;
  if (!oauth) return apiError(res, 404, 'not_found', 'OAuth is disabled'), true;
  try {
    if (isSession) {
      const session = await oauth.getBrowserSession(req);
      return toJson(res, 200, { contractVersion: 'v1', data: {
        oauthEnabled: true,
        authenticated: !!session,
        ...(session ? { did: session.did, expiresAt: session.expiresAt } : {}),
        capabilities: {
          selfWrite: !!session,
          reviewSubmission: !!session,
          registryReview: session?.did === rootDid,
          collections: session ? ['us.dsaslate.temp.orgProfile', 'us.dsaslate.temp.publicEvent'] : [],
          actions: session ? ['create', 'update', 'delete'] : [],
        },
      } }), true;
    }
    if (req.method === 'GET' && url.pathname === '/oauth/client-metadata.json') return toJson(res, 200, oauth.metadata), true;
    if (req.method === 'GET' && url.pathname === '/oauth/jwks.json') return toJson(res, 200, oauth.jwks), true;
    if (req.method === 'GET' && url.pathname === '/oauth/login') {
      const handle = url.searchParams.get('handle');
      if (!handle) throw new Error('handle is required');
      const requestedMode = url.searchParams.get('mode');
      const mode = requestedMode === 'registry' ? 'registry' : requestedMode === 'delegations' ? 'delegations' : requestedMode === 'events' ? 'events' : 'user';
      const returnUri = url.searchParams.get('handoff_return_uri');
      const clientState = url.searchParams.get('handoff_state');
      const codeChallenge = url.searchParams.get('handoff_challenge');
      const hasHandoff = returnUri !== null || clientState !== null || codeChallenge !== null;
      if (hasHandoff && (!returnUri || !clientState || !codeChallenge)) throw new Error('OAuth handoff requires return URI, state, and challenge');
      const location = await oauth.begin(handle, mode, hasHandoff ? { returnUri: returnUri!, clientState: clientState!, codeChallenge: codeChallenge! } : undefined);
      res.writeHead(302, { location: location.toString(), 'cache-control': 'no-store' });
      res.end();
      return true;
    }
    if (req.method === 'GET' && url.pathname === '/oauth/callback') {
      const session = await oauth.complete(url.searchParams);
      if ('handoff' in session && session.handoff) {
        res.writeHead(302, { location: session.handoff.location, 'cache-control': 'no-store' });
        res.end();
        return true;
      }
      res.writeHead(302, { location: '/', 'set-cookie': oauth.sessionCookie(session.token, session.expiresAt), 'cache-control': 'no-store' });
      res.end();
      return true;
    }
    if (req.method === 'POST' && url.pathname === '/oauth/handoff/exchange') {
      const body = await readJsonBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object');
      const { code, verifier } = body as { code?: unknown; verifier?: unknown };
      if (typeof code !== 'string' || typeof verifier !== 'string') throw new Error('handoff code and verifier are required');
      const exchanged = await oauth.exchangeHandoff(code, verifier);
      return toJson(res, 200, { access_token: exchanged.accessToken, token_type: 'Bearer', expires_in: exchanged.expiresIn, did: exchanged.did, scope: exchanged.permissionSet }), true;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/delegation-handoff/records') {
      const authorization = getRequestHeader(req, 'authorization');
      const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;
      if (!token) throw new Error('missing OAuth handoff token');
      const body = await readJsonBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object');
      const input = body as SelfRecordWriteInput;
      if (input.action !== 'create' && input.action !== 'update' && input.action !== 'delete') throw new Error('action must be create, update, or delete');
      const output = await oauth.writeHandoffDelegation(token, input);
      return toJson(res, input.action === 'create' ? 201 : 200, { contractVersion: 'v1', data: output }), true;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/event-handoff/records') {
      const authorization = getRequestHeader(req, 'authorization');
      const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;
      if (!token) throw new Error('missing OAuth handoff token');
      const body = await readJsonBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object');
      const input = body as SelfRecordWriteInput;
      if (input.action !== 'create' && input.action !== 'update' && input.action !== 'delete') throw new Error('action must be create, update, or delete');
      const output = await oauth.writeHandoffEvent(token, input);
      return toJson(res, input.action === 'create' ? 201 : 200, { contractVersion: 'v1', data: output }), true;
    }
    if (req.method === 'POST' && url.pathname === '/oauth/logout') {
      oauth.assertTrustedOrigin(req);
      await oauth.logout(req);
      res.setHeader('set-cookie', oauth.clearSessionCookie());
      return toJson(res, 200, { status: 'signed_out' }), true;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/self/records') {
      oauth.assertTrustedOrigin(req);
      const did = await oauth.authenticateRequest(req);
      const body = await readJsonBody(req);
      if (body === Symbol.for('body-too-large')) return apiError(res, 413, 'payload_too_large', 'request body exceeds 1 MiB'), true;
      if (body === Symbol.for('invalid-json')) return apiError(res, 400, 'invalid_json', 'request body must be valid JSON'), true;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object');
      const input = body as SelfRecordWriteInput;
      if (input.action !== 'create' && input.action !== 'update' && input.action !== 'delete') throw new Error('action must be create, update, or delete');
      const output = await oauth.writeSelfAuthoredRecord(did, input);
      return toJson(res, input.action === 'create' ? 201 : 200, { contractVersion: 'v1', data: output }), true;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth request failed';
    if (error instanceof PdsWriteError) {
      if (error.code === 'InvalidSwap') return apiError(res, 409, 'record_conflict', 'record CID changed; reload before retrying'), true;
      if (error.code === 'RecordNotFound') return apiError(res, 404, 'record_not_found', 'record no longer exists'), true;
      return apiError(res, 502, 'pds_write_failed', 'the PDS rejected the record operation'), true;
    }
    const unauthorized = message.includes('session') || message.includes('OAuth browser') || message.includes('handoff token');
    const forbidden = message.includes('origin is not allowed');
    return apiError(res, unauthorized ? 401 : forbidden ? 403 : 400, unauthorized ? 'unauthorized' : forbidden ? 'forbidden' : 'invalid_request', message), true;
  }
  return apiError(res, 404, 'not_found', 'OAuth route not found'), true;
}

export function createApp(repository: DirectoryRepository, options: Partial<Pick<AppConfig, 'CORS_ORIGIN' | 'DEMO_READ_ONLY' | 'ENABLE_ADMIN_INGEST' | 'ENABLE_WRITE_GATEWAY' | 'ENABLE_WRITE_PUBLISH' | 'ENABLE_REVIEW_SUBMISSIONS' | 'PUBLIC_RATE_LIMIT_PER_MINUTE' | 'WRITE_RATE_LIMIT_PER_MINUTE'>> & { writeOperationStore?: InMemoryWriteOperationStore; appRegistry?: AppRegistryEntry[]; authenticateReviewRequest?: (req: IncomingMessage) => string | Promise<string> } = {}) {
  const corsOrigin = options.CORS_ORIGIN ?? '*';
  const demoReadOnly = options.DEMO_READ_ONLY ?? false;
  const enableAdminIngest = !demoReadOnly && (options.ENABLE_ADMIN_INGEST ?? false);
  const enableWriteGateway = !demoReadOnly && (options.ENABLE_WRITE_GATEWAY ?? false);
  const enableWritePublish = !demoReadOnly && (options.ENABLE_WRITE_PUBLISH ?? false);
  const enableReviewSubmissions = !demoReadOnly && (options.ENABLE_REVIEW_SUBMISSIONS ?? false);
  const writeOperationStore = options.writeOperationStore;
  const appRegistry = options.appRegistry ?? [];
  const allowedMethods = demoReadOnly ? 'GET, OPTIONS' : 'GET, POST, OPTIONS';
  const publicRateLimit = options.PUBLIC_RATE_LIMIT_PER_MINUTE ?? 120;
  const writeRateLimit = options.WRITE_RATE_LIMIT_PER_MINUTE ?? 30;
  const publicRateStore = new Map<string, { window: number; count: number }>();
  const writeRateStore = new Map<string, { window: number; count: number }>();
  const server = createServer(async (req, res) => {
    const requestId = getRequestHeader(req, 'x-request-id')?.slice(0, 128) || randomUUID();
    const startedAt = Date.now();
    res.setHeader('x-request-id', requestId);
    res.once('finish', () => console.info(JSON.stringify({ level: 'info', message: 'request', requestId, method: req.method, path: req.url?.split('?')[0], statusCode: res.statusCode, durationMs: Date.now() - startedAt })));
    applyCors(req, res, corsOrigin, allowedMethods);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const isWrite = req.method !== 'GET' && req.method !== 'HEAD';
    const rateStore = isWrite ? writeRateStore : publicRateStore;
    const rateLimit = isWrite ? writeRateLimit : publicRateLimit;
    if (!consumeRateLimit(rateStore, requestIdentity(req), rateLimit)) {
      res.setHeader('retry-after', '60');
      return apiError(res, 429, 'rate_limit_exceeded', 'request rate limit exceeded');
    }
    if (req.url === '/health') return toJson(res, 200, { status: 'ok' });
    if (req.url === '/ready') {
      try {
        const entities = await repository.listEntities();
        return toJson(res, 200, { status: 'ready', entityCount: entities.length, dataset: repository.datasetMetadata ?? { dataset: 'built-in-fallback', schema: 'allSeedRecords' } });
      } catch {
        return toJson(res, 503, { status: 'not_ready', error: 'repository_unavailable' });
      }
    }
    if (await handleOAuthRoute(req, res, repository.oauthService, repository.foundation.policy.rootDid)) return;
    const authenticateReviewRequest = options.authenticateReviewRequest ?? (repository.oauthService ? repository.oauthService.authenticateRequest.bind(repository.oauthService) : undefined);
    if (await handleFoundationRoute(req, res, repository, { enableReviewSubmissions, authenticateReviewRequest })) return;
    if (req.method === 'GET' && req.url === '/api/registry/health') {
      const report = await loadRegistryHealthReport(resolve('fixtures/records.json'));
      return toJson(res, 200, { prototype: true, ...getRegistryHealthSummary(report) });
    }
    if (req.method === 'POST' && req.url === '/api/admin/fixtures/ingest') {
      if (!enableAdminIngest) return toJson(res, 404, routeDisabled());
      const body = await readJsonBody(req);
      if (body === Symbol.for('body-too-large')) return apiError(res, 413, 'payload_too_large', 'request body exceeds 1 MiB');
      if (body === Symbol.for('invalid-json')) return toJson(res, 400, { error: 'invalid_json' });
      const records = Array.isArray(body) ? body : body && typeof body === 'object' && 'records' in body ? (body as { records?: unknown }).records : undefined;
      if (!Array.isArray(records)) return toJson(res, 400, { error: 'invalid_request_body', expected: '{ records: unknown[] }' });
      const report = await replayFixtureRecords(records, repository);
      return toJson(res, 200, { prototype: true, acceptedCount: report.acceptedCount, ingestedCount: report.ingestedCount, rejected: report.rejected });
    }
    if (req.method === 'POST' && req.url === '/api/write/records') {
      if (!enableWriteGateway) return toJson(res, 404, routeDisabled());
      if (!writeOperationStore) return apiError(res, 503, 'legacy_write_store_unavailable', 'legacy write gateway requires an explicit operation store');
      const appToken = getAppToken(req);
      if (!appToken) return toJson(res, 401, { error: 'unauthorized' });
      const auth = authenticateAppFromToken(appToken, appRegistry);
      if (!auth) return toJson(res, 401, { error: 'unauthorized' });
      const body = await readJsonBody(req);
      if (body === Symbol.for('body-too-large')) return apiError(res, 413, 'payload_too_large', 'request body exceeds 1 MiB');
      if (body === Symbol.for('invalid-json')) return toJson(res, 400, { error: 'invalid_json' });
      const isDryRun = !!body && typeof body === 'object' && (body as { dryRun?: unknown }).dryRun === true;
      if (!isDryRun && !enableWritePublish) return toJson(res, 422, { error: 'write_publish_disabled' });
      if (!body || typeof body !== 'object' || (!isDryRun && !enableWritePublish)) {
        const op = writeOperationStore.createOperation({ appId: auth.app.appId, requestHash: 'invalid-request', status: 'rejected', reason: 'write publish disabled', errors: ['write publish disabled'], resolverSummary: 'request rejected before record processing' });
        return toJson(res, 422, { prototype: true, data: normalizeWriteOperation(op) });
      }
      const record = (body as { record?: unknown }).record;
      const requestErrors = validateWriteHeaders(req);
      const recordParse = recordEnvelopeSchema.safeParse(record);
      const envelope = recordParse.success ? recordParse.data : undefined;
      if (!envelope) requestErrors.push('invalid record envelope');
      if (envelope) requestErrors.push(...validateRecordEnvelopeAgainstAppScope(envelope, auth.app).map((issue) => issue.reason));
      const idempotencyKey = getRequestHeader(req, 'idempotency-key') ?? undefined;
      let hasConflict = false;
      if (envelope?.collection === 'org.dsa.event.public') {
        const eventRecord = envelope.record as PublicEventRecord;
        const hostEntity = await repository.getEntity(eventRecord.hostEntityUri);
        if (!hostEntity) requestErrors.push(`host entity not found: ${eventRecord.hostEntityUri}`);
      }
      if (envelope) {
        const revisions = await repository.listRecordRevisions(envelope.uri);
        const ifNoneMatch = getRequestHeader(req, 'if-none-match');
        const ifMatch = getRequestHeader(req, 'if-match');
        if (ifNoneMatch === '*') {
          if (revisions.length > 0) { requestErrors.push(`conflict: record already exists: ${envelope.uri}`); hasConflict = true; }
        } else if (typeof ifMatch === 'string' && ifMatch.trim().length > 0) {
          const latest = revisions[revisions.length - 1];
          if (!latest) requestErrors.push(`missing current revision: ${envelope.uri}`);
          else if (latest.cid !== ifMatch.trim()) { requestErrors.push(`revision conflict: expected ${ifMatch.trim()} but found ${latest.cid}`); hasConflict = true; }
        } else if (isDryRun) {
          requestErrors.push('missing optimistic concurrency header: use If-None-Match: * or If-Match: <cid>');
        } else {
          requestErrors.push('missing optimistic concurrency header: use If-None-Match: * or If-Match: <cid>');
        }
      }
      const resolverSummary = envelope ? `resolver: ${JSON.stringify(await repository.resolveRecordAuthority(envelope.uri)).slice(0, 512)}` : 'resolver unavailable';
      const requestHash = hashWriteRequest({ mode: isDryRun ? 'dry_run' : 'publish', record: envelope, dryRun: isDryRun });
      const status = requestErrors.length ? (requestErrors.some((error) => error.includes('conflict') || error.includes('exists') || error.includes('revision conflict')) ? 'conflict' : 'rejected') : (isDryRun ? 'dry_run' : (auth.app.reviewRequired ? 'pending_review' : 'accepted'));
      const op = writeOperationStore.createOperation({ appId: auth.app.appId, requestHash, targetUri: envelope?.uri, collection: envelope?.collection, status, reason: requestErrors.length ? 'validation failed' : (isDryRun ? 'dry-run accepted' : (auth.app.reviewRequired ? 'pending review' : 'accepted for publish')), errors: requestErrors, record: envelope, resolverSummary, idempotencyKey, idempotencyScope: envelope?.collection });
      if (!isDryRun && requestErrors.length === 0 && !auth.app.reviewRequired && enableWritePublish && envelope) {
        await repository.ingestRecordEnvelopes([envelope]);
      }
      return toJson(res, op.status === 'conflict' || hasConflict ? 409 : (requestErrors.length ? 422 : 200), { prototype: true, data: normalizeWriteOperation(op) });
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/write/operations/')) {
      if (!enableWriteGateway) return toJson(res, 404, routeDisabled());
      if (!writeOperationStore) return apiError(res, 503, 'legacy_write_store_unavailable', 'legacy write gateway requires an explicit operation store');
      const appToken = getAppToken(req);
      if (!appToken) return toJson(res, 401, { error: 'unauthorized' });
      const auth = authenticateAppFromToken(appToken, appRegistry);
      if (!auth) return toJson(res, 401, { error: 'unauthorized' });
      const operationId = decodeURIComponent(req.url.slice('/api/write/operations/'.length));
      const operation = writeOperationStore.getOperation(operationId);
      if (!operation || operation.appId !== auth.app.appId) return toJson(res, 404, { error: 'not_found' });
      return toJson(res, 200, { prototype: true, data: normalizeWriteOperation(operation) });
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/entities')) {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/entities') {
        const type = url.searchParams.get('type') ?? 'all';
        const search = url.searchParams.get('q') ?? url.searchParams.get('search') ?? '';
        const state = url.searchParams.get('state') ?? undefined;
        const jurisdictionType = url.searchParams.get('jurisdictionType') ?? undefined;
        const limitParam = url.searchParams.get('limit');
        const limit = limitParam ? Number(limitParam) : undefined;
        return toJson(res, 200, { prototype: true, data: await repository.listEntities({ type: type as DirectoryEntityFilters['type'], search, state: state ?? undefined, jurisdictionType: jurisdictionType ?? undefined, limit: Number.isFinite(limit) ? limit : undefined }) });
      }
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/org-chart')) {
      const url = new URL(req.url, 'http://localhost');
      return toJson(res, 200, await repository.getOrgChart({ kind: url.searchParams.get('kind') as OrgUnitRecord['kind'] | undefined, unit: url.searchParams.get('unit') ?? undefined }));
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/records/resolve')) {
      const url = new URL(req.url, 'http://localhost');
      const uri = url.searchParams.get('uri');
      if (!uri) return toJson(res, 400, { error: 'invalid_request_query', expected: 'uri is required' });
      const asOf = url.searchParams.get('asOf') ?? undefined;
      if (asOf && Number.isNaN(Date.parse(asOf))) return toJson(res, 400, { error: 'invalid_request_query', expected: 'asOf must be an ISO timestamp' });
      const depthParam = url.searchParams.get('depth');
      let depth: number | undefined;
      if (depthParam) {
        const parsedDepth = Number(depthParam);
        if (!Number.isInteger(parsedDepth) || parsedDepth < 0) return toJson(res, 400, { error: 'invalid_request_query', expected: 'depth must be a non-negative integer' });
        depth = parsedDepth;
      }
      return toJson(res, 200, { prototype: true, data: await repository.resolveRecordAuthority(uri, { asOf, depth }) });
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/entities/')) {
      const id = decodeURIComponent(req.url.slice('/api/entities/'.length));
      const entity = await repository.getEntity(id);
      if (!entity) return toJson(res, 404, { error: 'not_found' });
      return toJson(res, 200, { prototype: true, data: entity });
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/statements')) {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/statements') return toJson(res, 200, { prototype: true, data: await repository.listStatements(url.searchParams.get('entity') ?? undefined) });
      const id = decodeURIComponent(url.pathname.slice('/api/statements/'.length));
      const statement = await repository.getStatement(id);
      if (!statement) return toJson(res, 404, { error: 'not_found' });
      return toJson(res, 200, { prototype: true, data: statement });
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/publications')) {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/publications') return toJson(res, 200, { prototype: true, data: await repository.listPublications() });
      const id = decodeURIComponent(url.pathname.slice('/api/publications/'.length));
      const publication = await repository.getPublication(id);
      if (!publication) return toJson(res, 404, { error: 'not_found' });
      return toJson(res, 200, { prototype: true, data: publication });
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/articles')) {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/articles') return toJson(res, 200, { prototype: true, data: await repository.listArticles(url.searchParams.get('publication') ?? undefined, url.searchParams.get('entity') ?? undefined) });
      const id = decodeURIComponent(url.pathname.slice('/api/articles/'.length));
      const article = await repository.getArticle(id);
      if (!article) return toJson(res, 404, { error: 'not_found' });
      return toJson(res, 200, { prototype: true, data: article });
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/endorsements')) {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/endorsements') return toJson(res, 200, { prototype: true, data: await repository.listEndorsements(url.searchParams.get('entity') ?? undefined, (url.searchParams.get('status') ?? undefined) as EndorsementPublicRecord['status'] | undefined) });
      const id = decodeURIComponent(url.pathname.slice('/api/endorsements/'.length));
      const endorsement = await repository.getEndorsement(id);
      if (!endorsement) return toJson(res, 404, { error: 'not_found' });
      return toJson(res, 200, { prototype: true, data: endorsement });
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/events')) {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/events') return toJson(res, 200, { prototype: true, data: await repository.listEvents(url.searchParams.get('entity') ?? undefined, (url.searchParams.get('status') ?? undefined) as PublicEventRecord['status'] | undefined) });
      const id = decodeURIComponent(url.pathname.slice('/api/events/'.length));
      const event = await repository.getEvent(id);
      if (!event) return toJson(res, 404, { error: 'not_found' });
      return toJson(res, 200, { prototype: true, data: event });
    }
    if (req.method === 'GET' && req.url?.startsWith('/api/activity')) {
      const url = new URL(req.url, 'http://localhost');
      return toJson(res, 200, { prototype: true, data: await repository.listActivity({ entityUri: url.searchParams.get('entity') ?? undefined, type: (url.searchParams.get('type') ?? undefined) as ActivityType | undefined }) });
    }
    if (req.url === '/api/chapters' && req.method === 'GET') {
      const chapters = (await repository.listEntities()).filter((entity) => entity.type === 'chapter');
      return toJson(res, 200, { prototype: true, data: chapters });
    }
    return toJson(res, 404, { error: 'not_found' });
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 60_000;
  return server;
}

function buildOrgChartFromRecords(records: RecordEnvelope[], filters: { kind?: OrgUnitRecord['kind']; unit?: string } = {}) {
  const unitRecords = records.filter((record): record is RecordEnvelope & { record: OrgUnitRecord } => record.collection === 'org.dsa.profile.orgUnit' && orgUnitRecordSchema.safeParse(record.record).success);
  const relationshipRecords = records.filter((record): record is RecordEnvelope & { record: GovernanceRelationshipRecord } => record.collection === 'org.dsa.relationship.governance' && governanceRelationshipRecordSchema.safeParse(record.record).success);
  const selectedUnit = filters.unit ? unitRecords.find((unit) => unit.uri === filters.unit) : undefined;
  const connectedUris = selectedUnit ? new Set([selectedUnit.uri, ...relationshipRecords.filter((rel) => rel.record.subjectUri === selectedUnit.uri || rel.record.objectUri === selectedUnit.uri).flatMap((rel) => [rel.record.subjectUri, rel.record.objectUri])]) : undefined;
  const units = unitRecords.filter((unit) => (filters.kind ? unit.record.kind === filters.kind : true) && (connectedUris ? connectedUris.has(unit.uri) : true));
  const visibleUnitUris = new Set(units.map((unit) => unit.uri));
  const relationships = relationshipRecords.filter((rel) => {
    if (selectedUnit) return visibleUnitUris.has(rel.record.subjectUri) && visibleUnitUris.has(rel.record.objectUri);
    return (filters.kind ? visibleUnitUris.has(rel.record.subjectUri) || visibleUnitUris.has(rel.record.objectUri) : true) && (visibleUnitUris.has(rel.record.subjectUri) || visibleUnitUris.has(rel.record.objectUri));
  });
  return {
    prototype: true as const,
    sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg',
    updatedLabel: 'Last updated June 2020',
    units: units.map((item) => ({ uri: item.uri, ...item.record })),
    relationships: relationships.map((item) => ({ uri: item.uri, ...item.record })),
  };
}

function normalizeStatementEnvelope(record: RecordEnvelope & { record: PublicStatementRecord }) {
  return {
    uri: record.uri,
    did: record.did,
    handle: record.handle,
    collection: record.collection,
    indexedAt: record.indexedAt,
    trustLabel: record.trustLabel,
    record: record.record,
    title: record.record.title,
    summary: record.record.summary,
    bodyMarkdown: record.record.bodyMarkdown,
    issuerUri: record.record.issuerUri,
    issuerName: record.record.issuerName,
    publishedAt: record.record.publishedAt,
    topics: record.record.topics,
    relatedEntityUris: record.record.relatedEntityUris,
    status: record.record.status,
  };
}

function normalizePublicationProfileEnvelope(record: RecordEnvelope & { record: PublicationProfileRecord }) {
  return { uri: record.uri, did: record.did, handle: record.handle, collection: record.collection, indexedAt: record.indexedAt, trustLabel: record.trustLabel, record: record.record, name: record.record.name, shortName: record.record.shortName, publisherUri: record.record.publisherUri, publisherName: record.record.publisherName, website: record.record.website, status: record.record.status };
}

function normalizePublicationArticleEnvelope(record: RecordEnvelope & { record: PublicationArticleRecord }) {
  return { uri: record.uri, did: record.did, handle: record.handle, collection: record.collection, indexedAt: record.indexedAt, trustLabel: record.trustLabel, record: record.record, publicationUri: record.record.publicationUri, publicationName: record.record.publicationName, title: record.record.title, summary: record.record.summary, bodyMarkdown: record.record.bodyMarkdown, authorName: record.record.authorName, publishedAt: record.record.publishedAt, topics: record.record.topics, relatedEntityUris: record.record.relatedEntityUris, status: record.record.status };
}

function normalizeEndorsementEnvelope(record: RecordEnvelope & { record: EndorsementPublicRecord }) {
  return { uri: record.uri, did: record.did, handle: record.handle, collection: record.collection, indexedAt: record.indexedAt, trustLabel: record.trustLabel, record: record.record, endorsingEntityUri: record.record.endorsingEntityUri, endorsingEntityName: record.record.endorsingEntityName, candidateOrMeasureName: record.record.candidateOrMeasureName, officeOrMeasure: record.record.officeOrMeasure, jurisdiction: record.record.jurisdiction, electionDate: record.record.electionDate, status: record.record.status, statementUri: record.record.statementUri, sourceUrl: record.record.sourceUrl, topics: record.record.topics, relatedEntityUris: record.record.relatedEntityUris };
}

function normalizeEventEnvelope(record: RecordEnvelope & { record: PublicEventRecord }) {
  return { uri: record.uri, did: record.did, handle: record.handle, collection: record.collection, indexedAt: record.indexedAt, trustLabel: record.trustLabel, record: record.record, title: record.record.title, hostEntityUri: record.record.hostEntityUri, hostEntityName: record.record.hostEntityName, startsAt: record.record.startsAt, endsAt: record.record.endsAt, mode: record.record.mode, publicUrl: record.record.publicUrl, locationLabel: record.record.locationLabel, status: record.record.status, topics: record.record.topics, relatedEntityUris: record.record.relatedEntityUris };
}

function normalizeActivityEnvelope(record: { uri: string; type: ActivityType; title: string; summary: string; actorName: string; actorUri?: string; date: string; status: string; topics: string[]; relatedEntityUris: string[]; collection: string; trustLabel: string }) {
  return record;
}

function listActivityEnvelopes(records: RecordEnvelope[], filters: { entityUri?: string; type?: ActivityType } = {}) {
  return records.flatMap((record) => {
    if (record.collection === 'org.dsa.statement.public') {
      const parsed = publicStatementRecordSchema.safeParse(record.record);
      if (!parsed.success) return [];
      return [normalizeActivityEnvelope({ uri: record.uri, type: 'statement', title: parsed.data.title, summary: parsed.data.summary, actorName: parsed.data.issuerName, actorUri: parsed.data.issuerUri, date: parsed.data.publishedAt, status: parsed.data.status, topics: parsed.data.topics, relatedEntityUris: parsed.data.relatedEntityUris, collection: record.collection, trustLabel: record.trustLabel })];
    }
    if (record.collection === 'org.dsa.publication.article') {
      const parsed = publicationArticleRecordSchema.safeParse(record.record);
      if (!parsed.success) return [];
      return [normalizeActivityEnvelope({ uri: record.uri, type: 'article', title: parsed.data.title, summary: parsed.data.summary, actorName: parsed.data.publicationName, actorUri: parsed.data.publicationUri, date: parsed.data.publishedAt, status: parsed.data.status, topics: parsed.data.topics, relatedEntityUris: parsed.data.relatedEntityUris, collection: record.collection, trustLabel: record.trustLabel })];
    }
    if (record.collection === 'org.dsa.endorsement.public') {
      const parsed = endorsementPublicRecordSchema.safeParse(record.record);
      if (!parsed.success) return [];
      return [normalizeActivityEnvelope({ uri: record.uri, type: 'endorsement', title: parsed.data.candidateOrMeasureName, summary: `${parsed.data.officeOrMeasure} · ${parsed.data.jurisdiction}`, actorName: parsed.data.endorsingEntityName, actorUri: parsed.data.endorsingEntityUri, date: parsed.data.electionDate, status: parsed.data.status, topics: parsed.data.topics, relatedEntityUris: parsed.data.relatedEntityUris, collection: record.collection, trustLabel: record.trustLabel })];
    }
    if (record.collection === 'org.dsa.event.public') {
      const parsed = publicEventRecordSchema.safeParse(record.record);
      if (!parsed.success) return [];
      return [normalizeActivityEnvelope({ uri: record.uri, type: 'event', title: parsed.data.title, summary: parsed.data.locationLabel ?? parsed.data.mode, actorName: parsed.data.hostEntityName, actorUri: parsed.data.hostEntityUri, date: parsed.data.startsAt, status: parsed.data.status, topics: parsed.data.topics, relatedEntityUris: parsed.data.relatedEntityUris, collection: record.collection, trustLabel: record.trustLabel })];
    }
    return [];
  }).filter((item) => !filters.type || item.type === filters.type).filter((item) => !filters.entityUri || item.actorUri === filters.entityUri || item.relatedEntityUris.includes(filters.entityUri)).sort((a, b) => b.date.localeCompare(a.date));
}

function listStatementEnvelopes(records: RecordEnvelope[], entityUri?: string) {
  return records.filter((record): record is RecordEnvelope & { record: PublicStatementRecord } => {
    if (record.collection !== 'org.dsa.statement.public') return false;
    const parsed = publicStatementRecordSchema.safeParse(record.record);
    if (!parsed.success) return false;
    return !entityUri || parsed.data.issuerUri === entityUri || parsed.data.relatedEntityUris.includes(entityUri);
  }).map(normalizeStatementEnvelope);
}

function listPublicationProfileEnvelopes(records: RecordEnvelope[]) {
  return records.filter((record): record is RecordEnvelope & { record: PublicationProfileRecord } => record.collection === 'org.dsa.publication.profile' && publicationProfileRecordSchema.safeParse(record.record).success).map(normalizePublicationProfileEnvelope);
}

function listPublicationArticleEnvelopes(records: RecordEnvelope[], publicationUri?: string, entityUri?: string) {
  return records.filter((record): record is RecordEnvelope & { record: PublicationArticleRecord } => {
    if (record.collection !== 'org.dsa.publication.article') return false;
    const parsed = publicationArticleRecordSchema.safeParse(record.record);
    if (!parsed.success) return false;
    return (!publicationUri || parsed.data.publicationUri === publicationUri) && (!entityUri || parsed.data.relatedEntityUris.includes(entityUri));
  }).map(normalizePublicationArticleEnvelope);
}

function listEndorsementEnvelopes(records: RecordEnvelope[], entityUri?: string, status?: EndorsementPublicRecord['status']) {
  return records.filter((record): record is RecordEnvelope & { record: EndorsementPublicRecord } => {
    if (record.collection !== 'org.dsa.endorsement.public') return false;
    const parsed = endorsementPublicRecordSchema.safeParse(record.record);
    if (!parsed.success) return false;
    return (!entityUri || parsed.data.endorsingEntityUri === entityUri || parsed.data.relatedEntityUris.includes(entityUri)) && (!status || parsed.data.status === status);
  }).map(normalizeEndorsementEnvelope);
}

function listEventEnvelopes(records: RecordEnvelope[], entityUri?: string, status?: PublicEventRecord['status']) {
  return records.filter((record): record is RecordEnvelope & { record: PublicEventRecord } => {
    if (record.collection !== 'org.dsa.event.public') return false;
    const parsed = publicEventRecordSchema.safeParse(record.record);
    if (!parsed.success) return false;
    return (!entityUri || parsed.data.hostEntityUri === entityUri || parsed.data.relatedEntityUris.includes(entityUri)) && (!status || parsed.data.status === status);
  }).map(normalizeEventEnvelope);
}

async function loadCanonicalFixtureDataset() {
  const fixture = await loadFixtureFile(resolve('fixtures/records.json'));
  const records = fixture.records.length > 0 ? fixture.records.map((record) => recordEnvelopeSchema.parse(record)) : allSeedRecords;
  return { metadata: fixture.metadata, records };
}

async function oauthConfigFromAppConfig(options: Partial<AppConfig>): Promise<OAuthServiceConfig | undefined> {
  if (!options.ENABLE_OAUTH) return undefined;
  if (!options.OAUTH_ENCRYPTION_KEY_FILE || !options.OAUTH_PRIVATE_KEY_FILE) throw new Error('OAuth requires OAUTH_ENCRYPTION_KEY_FILE and OAUTH_PRIVATE_KEY_FILE mounted secrets');
  const [encodedEncryptionKey, privateKey] = await Promise.all([
    readFile(options.OAUTH_ENCRYPTION_KEY_FILE, 'utf8'),
    readFile(options.OAUTH_PRIVATE_KEY_FILE, 'utf8'),
  ]);
  const encryptionKey = Buffer.from(encodedEncryptionKey.trim(), 'base64');
  return {
    appUrl: options.APP_PUBLIC_URL ?? 'https://app-staging.dsaslate.us',
    handleResolver: options.OAUTH_HANDLE_RESOLVER ?? 'https://pds-staging.dsaslate.us',
    internalPdsUrl: options.OAUTH_PDS_INTERNAL_URL,
    serviceDid: options.OAUTH_SERVICE_DID ?? 'did:web:api-staging.dsaslate.us',
    encryptionKey,
    privateKey,
    privateKeyAlg: options.OAUTH_PRIVATE_KEY_ALG ?? 'ES256',
    cookieName: options.OAUTH_COOKIE_NAME ?? 'dsaslate_oauth',
    handoffReturnOrigins: (options.OAUTH_HANDOFF_RETURN_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
    allowHttp: (options.APP_PUBLIC_URL ?? '').startsWith('http://127.0.0.1'),
  };
}

export async function bootstrapRepository(databaseUrl: string, options: Partial<AppConfig> = {}) {
  try {
    const repo = await createPostgresRepository(databaseUrl, { rootDid: options.PROVISIONAL_ROOT_DID, oauth: await oauthConfigFromAppConfig(options) });
    if (options.AUTO_REPLAY_FIXTURES ?? true) {
      const fixture = await loadCanonicalFixtureDataset();
      await replayFixtureRecords(fixture.records, repo);
    }
    return repo;
  } catch (error) {
    if (options.REQUIRE_POSTGRES || options.ENABLE_OAUTH) throw error;
    const fixture = await loadCanonicalFixtureDataset();
    return createMemoryRepository(fixture.records, fixture.metadata);
  }
}

function normalizeLimit(limit?: number) {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return 1000;
  return Math.min(Math.max(0, Math.floor(limit)), 1000);
}

async function loadVerificationAssertions(pool: Pool) {
  const result = await pool.query(`select record from atproto_records where collection = 'org.dsa.verification.assertion' order by indexed_at asc`);
  const assertions = new Map<string, { verificationStatus: DirectoryEntity['verificationStatus']; verifiedBy?: string; verificationReason?: string }>();
  for (const row of result.rows) {
    const record = row.record as { subjectUri?: string; assertion?: string; issuerHandle?: string; reason?: string };
    if (!record.subjectUri) continue;
    assertions.set(record.subjectUri, {
      verificationStatus: record.assertion === 'verified' ? 'verified' : record.assertion === 'disputed' ? 'disputed' : record.assertion === 'revoked' ? 'revoked' : 'self-declared',
      verifiedBy: record.issuerHandle,
      verificationReason: record.reason,
    });
  }
  return assertions;
}
