import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { loadFixtureRecordsFromFile, writeFixtureRecordsToFile } from './fixture-files.js';
import { recordEnvelopeSchema, type RecordEnvelope } from './domain.js';

const DEFAULT_INPUT = '../docs/dsa-chapters.csv';
const DEFAULT_OUTPUT = 'fixtures/records.json';
const DEFAULT_INDEXED_AT = '2026-07-01T00:00:00.000Z';
const IMPORT_DID_PREFIX = 'did:plc:dsa-';
const IMPORT_CID_PREFIX = 'bafy-dsa-';
const DEFAULT_WEBSITE = 'https://dsausa.org/chapters/';

type CsvRow = { [key: string]: string };

type ImportOptions = {
  input: string;
  output: string;
  replaceChapters: boolean;
};

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'record';
}

function parseArgs(argv: string[]): ImportOptions {
  const options: ImportOptions = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, replaceChapters: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (!arg.startsWith('--')) {
      if (options.input === DEFAULT_INPUT) options.input = arg;
      continue;
    }
    const key = arg.slice(2);
    if (key === 'out' && next) { options.output = next; i += 1; }
    else if (key === 'input' && next) { options.input = next; i += 1; }
    else if (key === 'replace-chapters') options.replaceChapters = next !== 'false';
  }
  return options;
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { row.push(cell); cell = ''; continue; }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = ''; continue;
    }
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
  try {
    return new URL(candidate).toString();
  } catch {
    return DEFAULT_WEBSITE;
  }
}

function deriveChapterHandle(website: string, slug: string) {
  const host = new URL(website).hostname.replace(/^www\./, '');
  const sharedHosts = new Set(['dsausa.org', 'linktr.ee', 'linktree.com']);
  if (!host || sharedHosts.has(host)) return `${slug}.chapters.dsa.example`;
  return host;
}

function buildChapterEnvelope(row: CsvRow): RecordEnvelope {
  const state = row.State.trim().toUpperCase();
  const name = row.Name.trim();
  const status = row.Status.trim();
  const slug = slugify(`${state}-${name}`);
  const did = `${IMPORT_DID_PREFIX}${slug}`;
  const website = normalizeWebsite(row.Website ?? '');
  const handle = deriveChapterHandle(website, slug);
  const record = {
    $type: 'org.dsa.profile.chapter' as const,
    name,
    shortName: name,
    jurisdiction: {
      type: status === 'Organizing Committee' ? 'organizing-committee' : 'chapter',
      name,
      state,
      country: 'US',
    },
    website,
    status: status.toLowerCase().includes('inactive') ? 'inactive' as const : 'active' as const,
  };
  return recordEnvelopeSchema.parse({
    uri: `at://${did}/org.dsa.profile.chapter/self`,
    cid: `${IMPORT_CID_PREFIX}${slug}`,
    did,
    handle,
    collection: record.$type,
    indexedAt: DEFAULT_INDEXED_AT,
    trustLabel: 'self-declared',
    record,
  });
}

export function importChapterFixturesFromCsvText(csvText: string, existing: RecordEnvelope[] = [], replaceChapters = true) {
  const rows = parseCsv(csvText);
  const imported = rows.map(buildChapterEnvelope);
  const deduped = new Map<string, RecordEnvelope>();
  for (const record of existing) {
    const importedRecord = record.collection === 'org.dsa.profile.chapter' && (record.did.startsWith(IMPORT_DID_PREFIX) || record.cid.startsWith(IMPORT_CID_PREFIX));
    if (replaceChapters && importedRecord) continue;
    deduped.set(record.uri, record);
  }
  for (const record of imported) deduped.set(record.uri, record);
  return { rowsRead: rows.length, records: [...deduped.values()], importedCount: imported.length };
}

export async function importChapterFixtures(argv: string[]) {
  const options = parseArgs(argv);
  const inputPath = options.input;
  const outputPath = options.output;
  const csvText = await readFile(inputPath, 'utf8');
  const existing = await loadFixtureRecordsFromFile(outputPath).catch(() => [] as RecordEnvelope[]);
  const result = importChapterFixturesFromCsvText(csvText, existing, options.replaceChapters);
  for (const record of result.records) recordEnvelopeSchema.parse(record);
  await writeFixtureRecordsToFile(outputPath, result.records);
  console.log(`${basename(inputPath)}: rows=${result.rowsRead} chapters=${result.importedCount} output=${outputPath}`);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await importChapterFixtures(process.argv.slice(2));
}
