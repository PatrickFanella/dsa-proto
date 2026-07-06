import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { loadFixtureRecordsFromFile, writeFixtureRecordsToFile } from './fixture-files.js';
import { recordEnvelopeSchema, type RecordEnvelope } from './domain.js';

const DEFAULT_INPUT = '../docs/dsa-caucuses.csv';
const DEFAULT_OUTPUT = 'fixtures/records.json';
const DEFAULT_INDEXED_AT = '2026-07-01T00:00:00.000Z';
const IMPORT_DID_PREFIX = 'did:plc:dsa-caucus-';
const IMPORT_CID_PREFIX = 'bafy-dsa-caucus-';
const DEFAULT_WEBSITE = 'https://dsausa.org/';

type CsvRow = { [key: string]: string };

type ImportOptions = { input: string; output: string };

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'record';
}

function parseArgs(argv: string[]): ImportOptions {
  const options: ImportOptions = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (!arg.startsWith('--')) { if (options.input === DEFAULT_INPUT) options.input = arg; continue; }
    const key = arg.slice(2);
    if (key === 'out' && next) { options.output = next; i += 1; }
    else if (key === 'input' && next) { options.input = next; i += 1; }
  }
  return options;
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]; const next = text[i + 1];
    if (quoted) { if (char === '"' && next === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = false; else cell += char; continue; }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row.push(cell); cell = ''; continue; }
    if (char === '\n' || char === '\r') { if (char === '\r' && next === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += char;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows.filter((values) => values.some((value) => value.trim().length > 0)).map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? '').trim()]))) as CsvRow[];
}

function normalizeWebsite(value: string) {
  const trimmed = value.split(',')[0]?.trim() ?? '';
  if (!trimmed) return DEFAULT_WEBSITE;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try { return new URL(candidate).toString(); } catch { return DEFAULT_WEBSITE; }
}

function buildCaucusEnvelope(row: CsvRow): RecordEnvelope {
  const name = (row.Name ?? '').trim();
  const shortName = (row['Short Name'] ?? '').trim() || name;
  const slug = slugify(name);
  const did = (row.DID ?? '').trim() || `${IMPORT_DID_PREFIX}${slug}`;
  const website = normalizeWebsite(row.Website ?? '');
  const handle = (row.Handle ?? '').trim() || new URL(website).hostname.replace(/^www\./, '') || `${slug}.dsa.example`;
  const record = {
    $type: 'org.dsa.profile.caucus' as const,
    name,
    shortName,
    focusArea: (row['Focus Area'] ?? '').trim(),
    website,
    status: (row.Status ?? '').trim().toLowerCase() === 'inactive' ? 'inactive' as const : 'active' as const,
  };
  return recordEnvelopeSchema.parse({
    uri: `at://${did}/org.dsa.profile.caucus/self`,
    cid: `${IMPORT_CID_PREFIX}${slug}`,
    did,
    handle,
    collection: record.$type,
    indexedAt: DEFAULT_INDEXED_AT,
    trustLabel: (row['Trust Label'] ?? '').trim() || 'uncertain',
    record,
  });
}

export function importCaucusFixturesFromCsvText(csvText: string, existing: RecordEnvelope[] = []) {
  const rows = parseCsv(csvText);
  const imported = rows.map(buildCaucusEnvelope);
  const deduped = new Map<string, RecordEnvelope>();
  for (const record of existing) {
    const importedRecord = record.collection === 'org.dsa.profile.caucus' && (record.did.startsWith(IMPORT_DID_PREFIX) || record.cid.startsWith(IMPORT_CID_PREFIX));
    if (importedRecord) continue;
    deduped.set(record.uri, record);
  }
  for (const record of imported) deduped.set(record.uri, record);
  return { rowsRead: rows.length, records: [...deduped.values()], importedCount: imported.length };
}

export async function importCaucusFixtures(argv: string[]) {
  const options = parseArgs(argv);
  const csvText = await readFile(options.input, 'utf8');
  const existing = await loadFixtureRecordsFromFile(options.output).catch(() => [] as RecordEnvelope[]);
  const result = importCaucusFixturesFromCsvText(csvText, existing);
  for (const record of result.records) recordEnvelopeSchema.parse(record);
  await writeFixtureRecordsToFile(options.output, result.records);
  console.log(`${basename(options.input)}: rows=${result.rowsRead} caucuses=${result.importedCount} output=${options.output}`);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) { await importCaucusFixtures(process.argv.slice(2)); }
