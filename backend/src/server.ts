import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { z } from 'zod';
import { allSeedRecords, authorityDisputeRecordSchema, authorityRevocationRecordSchema, recordArchiveRecordSchema, endorsementPublicRecordSchema, governanceRelationshipRecordSchema, isDirectoryEntityRecord, matchesDirectoryEntity, orgUnitRecordSchema, publicEventRecordSchema, publicStatementRecordSchema, publicationArticleRecordSchema, publicationProfileRecordSchema, recordEnvelopeSchema, normalizeDirectoryEntity, type AuthorityResolverStatus, type DirectoryEntity, type DirectoryEntityFilters, type EndorsementPublicRecord, type GovernanceRelationshipRecord, type OrgUnitRecord, type PublicEventRecord, type PublicStatementRecord, type PublicationArticleRecord, type PublicationProfileRecord, type RecordEnvelope, type ResolvedRecordAuthority } from './domain.js';
import { loadFixtureFile, type FixtureDatasetMetadata } from './fixture-files.js';
import { replayFixtureRecords } from './fixture-replay.js';
import { authenticateAppFromToken, validateRecordEnvelopeAgainstAppScope } from './app-registry.js';
import { getRegistryHealthSummary, loadRegistryHealthReport } from './registry-health.js';
import { InMemoryWriteOperationStore, writeOperationSchema, type WriteOperation } from './write-operations.js';

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
  ENABLE_ADMIN_INGEST: envFlagSchema.default(true),
  ENABLE_WRITE_GATEWAY: envFlagSchema.default(false),
  ENABLE_WRITE_PUBLISH: envFlagSchema.default(false),
  AUTO_REPLAY_FIXTURES: envFlagSchema.default(true),
  REQUIRE_POSTGRES: envFlagSchema.default(false),
});

export type AppConfig = z.infer<typeof envSchema>;

export type DirectoryRepository = {
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
  return envSchema.parse(env);
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
    res.setHeader('vary', 'Origin');
  }
  res.setHeader('access-control-allow-headers', 'content-type, authorization, x-dsa-app-token, idempotency-key, if-match, if-none-match');
  res.setHeader('access-control-allow-methods', allowedMethods);
}

function routeDisabled() {
  return { error: 'not_found' };
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
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return Symbol.for('invalid-json');
  }
}

export function createMemoryRepository(seed: RecordEnvelope[] = allSeedRecords, datasetMetadata?: FixtureDatasetMetadata): DirectoryRepository {
  const rawRecords = seed.map((record) => recordEnvelopeSchema.parse(record));
  const records = dedupeEntities(rawRecords);
  const recordRevisions = dedupeRecordRevisions(rawRecords);
  return {
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

export async function createPostgresRepository(databaseUrl: string): Promise<DirectoryRepository> {
  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query('select 1');
  await ensurePrototypeSchema(pool);
  return {
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
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where collection = 'org.dsa.statement.public' order by indexed_at desc`);
      return listStatementEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record } as RecordEnvelope)), entityUri);
    },
    async getStatement(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.statement.public' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizeStatementEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record });
    },
    async listPublications() {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where collection = 'org.dsa.publication.profile' order by indexed_at desc`);
      return listPublicationProfileEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record } as RecordEnvelope)));
    },
    async getPublication(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.publication.profile' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizePublicationProfileEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record });
    },
    async listArticles(publicationUri?: string, entityUri?: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where collection = 'org.dsa.publication.article' order by indexed_at desc`);
      return listPublicationArticleEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record } as RecordEnvelope)), publicationUri, entityUri);
    },
    async getArticle(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.publication.article' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizePublicationArticleEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record });
    },
    async listEndorsements(entityUri?: string, status?: EndorsementPublicRecord['status']) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where collection = 'org.dsa.endorsement.public' order by indexed_at desc`);
      return listEndorsementEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record } as RecordEnvelope)), entityUri, status);
    },
    async getEndorsement(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.endorsement.public' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizeEndorsementEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record });
    },
    async listEvents(entityUri?: string, status?: PublicEventRecord['status']) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where collection = 'org.dsa.event.public' order by indexed_at desc`);
      return listEventEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record } as RecordEnvelope)), entityUri, status);
    },
    async getEvent(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.event.public' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizeEventEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record });
    },
    async listActivity(filters = {}) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where collection in ('org.dsa.statement.public', 'org.dsa.publication.article', 'org.dsa.endorsement.public', 'org.dsa.event.public') order by indexed_at desc`);
      return listActivityEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record } as RecordEnvelope)), filters);
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
            `insert into atproto_records (uri, cid, did, handle, collection, record, indexed_at)
             values ($1, $2, $3, $4, $5, $6, $7)
             on conflict (uri) do update set cid = excluded.cid, did = excluded.did, handle = excluded.handle, collection = excluded.collection, record = excluded.record, indexed_at = excluded.indexed_at`,
            [rawRecord.uri, rawRecord.cid, rawRecord.did, rawRecord.handle, rawRecord.collection, rawRecord.record, rawRecord.indexedAt],
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
      const result = await pool.query(`select uri, record, collection, indexed_at from atproto_records where collection in ('org.dsa.profile.orgUnit', 'org.dsa.relationship.governance') order by indexed_at asc`);
      return buildOrgChartFromRecords(result.rows.map((row) => ({ uri: row.uri, cid: 'db', did: 'did:plc:db', handle: 'dsausa.org', collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'official', record: row.record } as RecordEnvelope)), filters);
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
      indexed_at timestamptz not null
    )
  `);
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
  await pool.query(`insert into atproto_record_revisions (uri, cid, did, handle, collection, record, trust_label, indexed_at) select uri, cid, did, handle, collection, record, 'official', indexed_at from atproto_records on conflict (uri, cid) do nothing`);
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

export function createApp(repository: DirectoryRepository, options: Partial<Pick<AppConfig, 'CORS_ORIGIN' | 'DEMO_READ_ONLY' | 'ENABLE_ADMIN_INGEST' | 'ENABLE_WRITE_GATEWAY' | 'ENABLE_WRITE_PUBLISH'>> & { writeOperationStore?: InMemoryWriteOperationStore } = {}) {
  const corsOrigin = options.CORS_ORIGIN ?? '*';
  const demoReadOnly = options.DEMO_READ_ONLY ?? false;
  const enableAdminIngest = !demoReadOnly && (options.ENABLE_ADMIN_INGEST ?? true);
  const enableWriteGateway = !demoReadOnly && (options.ENABLE_WRITE_GATEWAY ?? false);
  const enableWritePublish = !demoReadOnly && (options.ENABLE_WRITE_PUBLISH ?? false);
  const writeOperationStore = options.writeOperationStore ?? new InMemoryWriteOperationStore();
  const allowedMethods = demoReadOnly ? 'GET, OPTIONS' : 'GET, POST, OPTIONS';
  return createServer(async (req, res) => {
    applyCors(req, res, corsOrigin, allowedMethods);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
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
    if (req.method === 'GET' && req.url === '/api/registry/health') {
      const report = await loadRegistryHealthReport(resolve('fixtures/records.json'));
      return toJson(res, 200, { prototype: true, ...getRegistryHealthSummary(report) });
    }
    if (req.method === 'POST' && req.url === '/api/admin/fixtures/ingest') {
      if (!enableAdminIngest) return toJson(res, 404, routeDisabled());
      const body = await readJsonBody(req);
      if (body === Symbol.for('invalid-json')) return toJson(res, 400, { error: 'invalid_json' });
      const records = Array.isArray(body) ? body : body && typeof body === 'object' && 'records' in body ? (body as { records?: unknown }).records : undefined;
      if (!Array.isArray(records)) return toJson(res, 400, { error: 'invalid_request_body', expected: '{ records: unknown[] }' });
      const report = await replayFixtureRecords(records, repository);
      return toJson(res, 200, { prototype: true, acceptedCount: report.acceptedCount, ingestedCount: report.ingestedCount, rejected: report.rejected });
    }
    if (req.method === 'POST' && req.url === '/api/write/records') {
      if (!enableWriteGateway) return toJson(res, 404, routeDisabled());
      const appToken = getAppToken(req);
      if (!appToken) return toJson(res, 401, { error: 'unauthorized' });
      const auth = authenticateAppFromToken(appToken);
      if (!auth) return toJson(res, 401, { error: 'unauthorized' });
      const body = await readJsonBody(req);
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
      const appToken = getAppToken(req);
      if (!appToken) return toJson(res, 401, { error: 'unauthorized' });
      const auth = authenticateAppFromToken(appToken);
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

export async function bootstrapRepository(databaseUrl: string, options: Partial<Pick<AppConfig, 'AUTO_REPLAY_FIXTURES' | 'REQUIRE_POSTGRES'>> = {}) {
  try {
    const repo = await createPostgresRepository(databaseUrl);
    if (options.AUTO_REPLAY_FIXTURES ?? true) {
      const fixture = await loadCanonicalFixtureDataset();
      await replayFixtureRecords(fixture.records, repo);
    }
    return repo;
  } catch (error) {
    if (options.REQUIRE_POSTGRES) throw error;
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
