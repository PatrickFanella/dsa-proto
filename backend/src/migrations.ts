import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

const migrationsDirectory = fileURLToPath(new URL('../../migrations/', import.meta.url));

export async function applyMigrations(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [1_685_286_751]);
    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    const files = (await readdir(migrationsDirectory)).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
    for (const file of files) {
      const applied = await client.query('select 1 from schema_migrations where name = $1', [file]);
      if (applied.rowCount) continue;
      const sql = await readFile(new URL(`../../migrations/${file}`, import.meta.url), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [1_685_286_751]).catch(() => undefined);
    client.release();
  }
}
