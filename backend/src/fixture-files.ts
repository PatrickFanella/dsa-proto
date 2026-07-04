import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { recordEnvelopeSchema, type RecordEnvelope } from './domain.js';

export type FixtureFilePayload = unknown[] | { records: unknown[] };

export async function loadRawFixtureRecordsFromFile(filePath: string): Promise<unknown[]> {
  const raw = JSON.parse(await readFile(filePath, 'utf8')) as FixtureFilePayload;
  return Array.isArray(raw) ? raw : raw.records;
}

export async function loadFixtureRecordsFromFile(filePath: string): Promise<RecordEnvelope[]> {
  const records = await loadRawFixtureRecordsFromFile(filePath);
  return records.map((record, index) => {
    const parsed = recordEnvelopeSchema.safeParse(record);
    if (!parsed.success) {
      const reason = parsed.error.issues.map((issue) => `${issue.path.length ? issue.path.join('.') : 'record'}: ${issue.message}`).join('; ');
      throw new Error(`Invalid record at index ${index} in ${filePath}: ${reason}`);
    }
    return parsed.data;
  });
}

export async function writeFixtureRecordsToFile(filePath: string, records: RecordEnvelope[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`);
}
