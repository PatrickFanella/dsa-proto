import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { z } from 'zod';
import { allSeedRecords, endorsementPublicRecordSchema, governanceRelationshipRecordSchema, isDirectoryEntityRecord, matchesDirectoryEntity, orgUnitRecordSchema, publicEventRecordSchema, publicStatementRecordSchema, publicationArticleRecordSchema, publicationProfileRecordSchema, recordEnvelopeSchema, normalizeDirectoryEntity, type DirectoryEntity, type DirectoryEntityFilters, type EndorsementPublicRecord, type GovernanceRelationshipRecord, type OrgUnitRecord, type PublicEventRecord, type PublicStatementRecord, type PublicationArticleRecord, type PublicationProfileRecord, type RecordEnvelope } from './domain.js';
import { replayFixtureRecords } from './fixture-replay.js';
import { getRegistryHealthSummary, loadRegistryHealthReport } from './registry-health.js';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().default('postgres://dsa_proto:change-me@localhost:5432/dsa_proto?sslmode=disable'),
});

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
  ingestRecordEnvelopes(records: RecordEnvelope[]): Promise<void>;
  getOrgChart(filters?: { kind?: OrgUnitRecord['kind']; unit?: string }): Promise<{ prototype: true; sourceUrl: string; updatedLabel: string; units: Array<{ uri: string; name: string; shortName: string; kind: OrgUnitRecord['kind']; description: string; status: string; website?: string }>; relationships: Array<{ uri: string; subjectUri: string; relationship: GovernanceRelationshipRecord['relationship']; objectUri: string; description: string; sourceUrl: string; status: string; createdAt: string }> }>;
};

export function getConfig(env: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(env);
}

function toJson(res: ServerResponse<IncomingMessage>, statusCode: number, body: unknown) {
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
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

export function createMemoryRepository(seed: RecordEnvelope[] = allSeedRecords): DirectoryRepository {
  const rawRecords = seed.map((record) => recordEnvelopeSchema.parse(record));
  const records = dedupeEntities(rawRecords);
  return {
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
    async ingestRecordEnvelopes(nextRecords) {
      const parsed = nextRecords.map((item) => recordEnvelopeSchema.parse(item));
      rawRecords.push(...parsed);
      const nextDirectoryRecords = dedupeEntities(rawRecords);
      records.splice(0, records.length, ...nextDirectoryRecords);
    },
    async getOrgChart(filters = {}) {
      return buildOrgChartFromRecords(rawRecords, filters);
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
      return listStatementEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'mock-official', record: row.record } as RecordEnvelope)), entityUri);
    },
    async getStatement(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.statement.public' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizeStatementEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'mock-official', record: row.record });
    },
    async listPublications() {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where collection = 'org.dsa.publication.profile' order by indexed_at desc`);
      return listPublicationProfileEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'mock-official', record: row.record } as RecordEnvelope)));
    },
    async getPublication(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.publication.profile' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizePublicationProfileEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'mock-official', record: row.record });
    },
    async listArticles(publicationUri?: string, entityUri?: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where collection = 'org.dsa.publication.article' order by indexed_at desc`);
      return listPublicationArticleEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'mock-official', record: row.record } as RecordEnvelope)), publicationUri, entityUri);
    },
    async getArticle(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.publication.article' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizePublicationArticleEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'mock-official', record: row.record });
    },
    async listEndorsements(entityUri?: string, status?: EndorsementPublicRecord['status']) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where collection = 'org.dsa.endorsement.public' order by indexed_at desc`);
      return listEndorsementEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'mock-official', record: row.record } as RecordEnvelope)), entityUri, status);
    },
    async getEndorsement(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.endorsement.public' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizeEndorsementEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'mock-official', record: row.record });
    },
    async listEvents(entityUri?: string, status?: PublicEventRecord['status']) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where collection = 'org.dsa.event.public' order by indexed_at desc`);
      return listEventEnvelopes(result.rows.map((row) => ({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'mock-official', record: row.record } as RecordEnvelope)), entityUri, status);
    },
    async getEvent(id: string) {
      const result = await pool.query(`select uri, cid, did, handle, collection, record, indexed_at from atproto_records where uri = $1 and collection = 'org.dsa.event.public' limit 1`, [id]);
      const row = result.rows[0];
      if (!row) return undefined;
      return normalizeEventEnvelope({ uri: row.uri, cid: row.cid, did: row.did, handle: row.handle, collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'mock-official', record: row.record });
    },
    async ingestRecordEnvelopes(nextRecords) {
      const parsed = nextRecords.map((item) => recordEnvelopeSchema.parse(item));
      for (const rawRecord of parsed) {
        await pool.query(
          `insert into atproto_records (uri, cid, did, handle, collection, record, indexed_at)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (uri) do update set cid = excluded.cid, did = excluded.did, handle = excluded.handle, collection = excluded.collection, record = excluded.record, indexed_at = excluded.indexed_at`,
          [rawRecord.uri, rawRecord.cid, rawRecord.did, rawRecord.handle, rawRecord.collection, rawRecord.record, rawRecord.indexedAt],
        );
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
      return buildOrgChartFromRecords(result.rows.map((row) => ({ uri: row.uri, cid: 'db', did: 'did:plc:db', handle: 'dsausa.org', collection: row.collection, indexedAt: new Date(row.indexed_at).toISOString(), trustLabel: 'mock-official', record: row.record } as RecordEnvelope)), filters);
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
  await pool.query(`alter table directory_entities add column if not exists verification_status text not null default 'unverified'`);
  await pool.query(`alter table directory_entities add column if not exists verified_by text`);
  await pool.query(`alter table directory_entities add column if not exists verification_reason text`);
  await pool.query('create index if not exists directory_entities_entity_type_idx on directory_entities(entity_type)');
  await pool.query('create index if not exists directory_entities_search_text_idx on directory_entities(search_text)');
}

export function createApp(repository: DirectoryRepository) {
  return createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-headers': 'content-type' });
      res.end();
      return;
    }
    if (req.url === '/health') return toJson(res, 200, { status: 'ok' });
    if (req.method === 'GET' && req.url === '/api/registry/health') {
      const report = await loadRegistryHealthReport(resolve('fixtures/records.json'));
      return toJson(res, 200, { prototype: true, ...getRegistryHealthSummary(report) });
    }
    if (req.method === 'POST' && req.url === '/api/admin/fixtures/ingest') {
      const body = await readJsonBody(req);
      if (body === Symbol.for('invalid-json')) return toJson(res, 400, { error: 'invalid_json' });
      const records = Array.isArray(body) ? body : body && typeof body === 'object' && 'records' in body ? (body as { records?: unknown }).records : undefined;
      if (!Array.isArray(records)) return toJson(res, 400, { error: 'invalid_request_body', expected: '{ records: unknown[] }' });
      const report = await replayFixtureRecords(records, repository);
      return toJson(res, 200, { prototype: true, acceptedCount: report.acceptedCount, ingestedCount: report.ingestedCount, rejected: report.rejected });
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

export async function bootstrapRepository(databaseUrl: string) {
  try {
    const repo = await createPostgresRepository(databaseUrl);
    await replayFixtureRecords(allSeedRecords, repo);
    return repo;
  } catch {
    return createMemoryRepository();
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
      verificationStatus: record.assertion === 'verified' ? 'mock-verified' : record.assertion === 'disputed' ? 'disputed' : record.assertion === 'revoked' ? 'revoked' : 'self-declared',
      verifiedBy: record.issuerHandle,
      verificationReason: record.reason,
    });
  }
  return assertions;
}
