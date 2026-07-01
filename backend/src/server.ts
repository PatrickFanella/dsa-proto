import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Pool } from 'pg';
import { z } from 'zod';
import { caucusSeedRecords, chapterSeedRecords, mockRecordEnvelopeSchema, normalizeDirectoryEntity, type DirectoryEntity, type MockRecordEnvelope } from './domain.js';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().default('postgres://dsa_proto:change-me@localhost:5432/dsa_proto?sslmode=disable'),
});

export type DirectoryRepository = {
  listEntities(): Promise<DirectoryEntity[]>;
  ingestMockRecords(records: MockRecordEnvelope[]): Promise<void>;
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

export function createMemoryRepository(seed: MockRecordEnvelope[] = [...chapterSeedRecords, ...caucusSeedRecords]): DirectoryRepository {
  const records = seed.map((record) => normalizeDirectoryEntity(mockRecordEnvelopeSchema.parse(record)));
  return {
    async listEntities() {
      return records;
    },
    async ingestMockRecords(nextRecords) {
      for (const record of nextRecords.map((item) => normalizeDirectoryEntity(item))) {
        const existingIndex = records.findIndex((entry) => entry.id === record.id);
        if (existingIndex >= 0) records[existingIndex] = record;
        else records.push(record);
      }
    },
  };
}

export async function createPostgresRepository(databaseUrl: string): Promise<DirectoryRepository> {
  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query('select 1');
  await ensurePrototypeSchema(pool);
  return {
    async listEntities() {
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
          directory_entities.trust_label,
          directory_entities.status,
          directory_entities.website,
          directory_entities.search_text,
          atproto_records.record
        from directory_entities
        join atproto_records on atproto_records.uri = directory_entities.record_uri
        order by directory_entities.name asc
      `);
      return result.rows.map((row) => {
        const entityType = row.entity_type as DirectoryEntity['type'];
        const jurisdiction = entityType === 'chapter' ? `${row.jurisdiction_name}, ${row.jurisdiction_region}` : row.jurisdiction_region;
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
          focusArea: entityType === 'caucus' ? row.jurisdiction_region : undefined,
          trustLabel: row.trust_label,
          status: row.status,
          website: row.website,
          searchText: row.search_text,
          record: row.record,
        };
      });
    },
    async ingestMockRecords(nextRecords) {
      for (const record of nextRecords.map((item) => normalizeDirectoryEntity(item))) {
        const recordData = record.record.record;
        const jurisdictionName = recordData.$type === 'org.dsa.profile.chapter' ? recordData.jurisdiction.name : 'caucus';
        const jurisdictionRegion = recordData.$type === 'org.dsa.profile.chapter' ? recordData.jurisdiction.state : recordData.focusArea;
        const description = recordData.$type === 'org.dsa.profile.chapter' ? null : recordData.focusArea;
        await pool.query(
          `insert into atproto_records (uri, cid, did, handle, collection, record, indexed_at)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (uri) do update set cid = excluded.cid, did = excluded.did, handle = excluded.handle, collection = excluded.collection, record = excluded.record, indexed_at = excluded.indexed_at`,
          [record.recordUri, record.record.cid, record.did, record.handle, record.record.collection, record.record, record.record.indexedAt],
        );
        await pool.query(
          `insert into directory_entities (id, record_uri, entity_type, name, short_name, handle, did, jurisdiction_name, jurisdiction_region, website, description, trust_label, status, search_text, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
           on conflict (id) do update set record_uri = excluded.record_uri, entity_type = excluded.entity_type, name = excluded.name, short_name = excluded.short_name, handle = excluded.handle, did = excluded.did, jurisdiction_name = excluded.jurisdiction_name, jurisdiction_region = excluded.jurisdiction_region, website = excluded.website, description = excluded.description, trust_label = excluded.trust_label, status = excluded.status, search_text = excluded.search_text, updated_at = now()`,
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
            record.status,
            record.searchText,
          ],
        );
      }
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
    if (req.url === '/api/entities' && req.method === 'GET') return toJson(res, 200, { prototype: true, data: await repository.listEntities() });
    if (req.url === '/api/chapters' && req.method === 'GET') {
      const chapters = (await repository.listEntities()).filter((entity) => entity.type === 'chapter');
      return toJson(res, 200, { prototype: true, data: chapters });
    }
    return toJson(res, 404, { error: 'not_found' });
  });
}

export async function bootstrapRepository(databaseUrl: string) {
  try {
    const repo = await createPostgresRepository(databaseUrl);
    await repo.ingestMockRecords([...chapterSeedRecords, ...caucusSeedRecords]);
    return repo;
  } catch {
    return createMemoryRepository();
  }
}
