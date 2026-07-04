import { writeFixtureRecordsToFile } from './fixture-files.js';
import { recordEnvelopeSchema, type RecordEnvelope } from './domain.js';
import { loadFixtureRecordsFromFile } from './fixture-files.js';

type AuthorOptions = {
  file: string;
  type: 'chapter' | 'verification';
  name?: string;
  shortName?: string;
  handle?: string;
  did?: string;
  uri?: string;
  cid?: string;
  website?: string;
  status?: 'active' | 'inactive';
  subjectUri?: string;
  subjectDid?: string;
  issuerDid?: string;
  issuerHandle?: string;
  assertion?: 'verified' | 'disputed' | 'revoked' | 'self-declared';
  reason?: string;
  indexedAt?: string;
  createdAt?: string;
};

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'record';
}

function parseArgs(argv: string[]): AuthorOptions {
  const options: AuthorOptions = { file: 'fixtures/records.json', type: 'chapter', status: 'active' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key === 'inactive') {
      options.status = 'inactive';
      continue;
    }
    if (key === 'type') options.type = next as AuthorOptions['type'];
    else if (key === 'file') options.file = next;
    else if (key === 'name') options.name = next;
    else if (key === 'shortName') options.shortName = next;
    else if (key === 'handle') options.handle = next;
    else if (key === 'did') options.did = next;
    else if (key === 'uri') options.uri = next;
    else if (key === 'cid') options.cid = next;
    else if (key === 'website') options.website = next;
    else if (key === 'subjectUri') options.subjectUri = next;
    else if (key === 'subjectDid') options.subjectDid = next;
    else if (key === 'issuerDid') options.issuerDid = next;
    else if (key === 'issuerHandle') options.issuerHandle = next;
    else if (key === 'assertion') options.assertion = next as AuthorOptions['assertion'];
    else if (key === 'reason') options.reason = next;
    else if (key === 'indexedAt') options.indexedAt = next;
    else if (key === 'createdAt') options.createdAt = next;
  }
  return options;
}

export function buildAuthorFixtureRecord(options: AuthorOptions): RecordEnvelope {
  const indexedAt = options.indexedAt ?? '2026-07-01T00:00:00.000Z';
  if (options.type === 'verification') {
    const subjectUri = options.subjectUri ?? 'at://did:plc:nycdsa/org.dsa.profile.chapter/self';
    const subjectDid = options.subjectDid ?? 'did:plc:nycdsa';
    const issuerDid = options.issuerDid ?? 'did:plc:nationaldsa';
    const issuerHandle = options.issuerHandle ?? 'dsausa.org';
    const record = {
      $type: 'org.dsa.verification.assertion' as const,
      subjectUri,
      subjectDid,
      issuerDid,
      issuerHandle,
      assertion: options.assertion ?? 'verified',
      reason: options.reason ?? 'Prototype authored fixture record.',
      createdAt: options.createdAt ?? indexedAt,
    };
    return recordEnvelopeSchema.parse({
      uri: options.uri ?? `${subjectUri}/verification`,
      cid: options.cid ?? `bafy-${slugify(issuerHandle)}-${slugify(subjectDid)}`,
      did: issuerDid,
      handle: issuerHandle,
      collection: record.$type,
      indexedAt,
      trustLabel: 'mock-official',
      record,
    });
  }
  const name = options.name ?? 'Prototype Chapter';
  const shortName = options.shortName ?? slugify(name).toUpperCase();
  const handle = options.handle ?? `${slugify(name)}.dsa.example`;
  const did = options.did ?? `did:plc:${slugify(name)}`;
  const record = {
    $type: 'org.dsa.profile.chapter' as const,
    name,
    shortName,
    jurisdiction: { type: 'city', name, state: 'NY', country: 'US' },
    website: options.website ?? 'https://example.org/',
    status: options.status ?? 'active',
  };
  return recordEnvelopeSchema.parse({
    uri: options.uri ?? `at://${did}/org.dsa.profile.chapter/self`,
    cid: options.cid ?? `bafy-${slugify(name)}`,
    did,
    handle,
    collection: record.$type,
    indexedAt,
    trustLabel: 'self-declared',
    record,
  });
}

export async function authorFixtureRecord(argv: string[]) {
  const options = parseArgs(argv);
  const record = buildAuthorFixtureRecord(options);
  const existing = await loadFixtureRecordsFromFile(options.file).catch(() => [] as RecordEnvelope[]);
  await writeFixtureRecordsToFile(options.file, [...existing, record]);
  return record;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const record = await authorFixtureRecord(process.argv.slice(2));
  console.log(JSON.stringify(record, null, 2));
}
