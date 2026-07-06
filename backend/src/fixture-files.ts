import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { recordEnvelopeSchema, type RecordEnvelope } from './domain.js';

export type FixtureDatasetMetadata = {
  dataset: string;
  schema: string;
};

export type FixtureFilePayload = unknown[] | { metadata?: unknown; records: unknown[] };

export function isFixtureDatasetMetadata(value: unknown): value is FixtureDatasetMetadata {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && typeof (value as { dataset?: unknown }).dataset === 'string'
    && typeof (value as { schema?: unknown }).schema === 'string';
}

export async function loadFixtureFile(filePath: string): Promise<{ metadata?: FixtureDatasetMetadata; records: unknown[] }> {
  const raw = JSON.parse(await readFile(filePath, 'utf8')) as FixtureFilePayload;
  if (Array.isArray(raw)) return { records: raw };
  return { metadata: isFixtureDatasetMetadata(raw.metadata) ? raw.metadata : undefined, records: raw.records };
}

export async function loadRawFixtureRecordsFromFile(filePath: string): Promise<unknown[]> {
  return (await loadFixtureFile(filePath)).records;
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
  let metadata: FixtureDatasetMetadata | undefined;
  try {
    metadata = (await loadFixtureFile(filePath)).metadata;
  } catch {
    metadata = undefined;
  }
  await mkdir(dirname(filePath), { recursive: true });
  const payload = metadata ? { metadata, records } : records;
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}
