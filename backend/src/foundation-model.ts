import { createHash } from 'node:crypto';
import * as dagCbor from '@ipld/dag-cbor';
import { AtUri, ensureValidAtUri, ensureValidDid, ensureValidHandle, ensureValidNsid, ensureValidRecordKey, ensureValidTid } from '@atproto/syntax';
import { CID } from 'multiformats/cid';
import * as digest from 'multiformats/hashes/digest';
import * as orgEntity from './lexicons/us/dsaslate/temp/orgEntity.defs.js';
import * as orgProfile from './lexicons/us/dsaslate/temp/orgProfile.defs.js';
import * as orgRelationship from './lexicons/us/dsaslate/temp/orgRelationship.defs.js';
import * as authorityDelegation from './lexicons/us/dsaslate/temp/authorityDelegation.defs.js';
import * as authorityAttestation from './lexicons/us/dsaslate/temp/authorityAttestation.defs.js';
import * as authorityAction from './lexicons/us/dsaslate/temp/authorityAction.defs.js';
import * as identityTransition from './lexicons/us/dsaslate/temp/identityTransition.defs.js';
import * as dsaUnit from './lexicons/us/dsaslate/temp/dsaUnit.defs.js';
import * as dsaPolicy from './lexicons/us/dsaslate/temp/dsaPolicy.defs.js';
import * as publicEvent from './lexicons/us/dsaslate/temp/publicEvent.defs.js';

export const TEMP_NAMESPACE = 'us.dsaslate.temp';
export const DEFAULT_PROVISIONAL_ROOT_DID = 'did:plc:dsaslatetempreg234567abc';
export const DEFAULT_BOOTSTRAP_REPO_REV = '3jzfcijpj2z2a';
export const DEFAULT_POLICY_VERSION = 'temp-v1';
export const DEFAULT_POLICY_URI = `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.dsaPolicy/3jzfcijpj2z2a`;

export const foundationCollections = [
  'us.dsaslate.temp.orgEntity',
  'us.dsaslate.temp.orgProfile',
  'us.dsaslate.temp.orgRelationship',
  'us.dsaslate.temp.authorityDelegation',
  'us.dsaslate.temp.authorityAttestation',
  'us.dsaslate.temp.authorityAction',
  'us.dsaslate.temp.identityTransition',
  'us.dsaslate.temp.dsaUnit',
  'us.dsaslate.temp.dsaPolicy',
  'us.dsaslate.temp.publicEvent',
] as const;

export type FoundationCollection = typeof foundationCollections[number];
export type ProvenanceStatus = 'verified' | 'unverified' | 'invalid' | 'desynchronized';
export type AuthorityStatus = 'unresolved' | 'provisional' | 'selfAsserted' | 'attested' | 'official' | 'disputed' | 'revoked' | 'expired';
export type LifecycleStatusV1 = 'active' | 'inactive' | 'superseded' | 'archived' | 'tombstoned';
export type StrongRef = { uri: string; cid: string };
export type FoundationRecordValue = Record<string, unknown> & { $type: FoundationCollection };

export type BootstrapProvenance = {
  legacyUri: string;
  legacyCollection: string;
  sourceUrl?: string;
  rowHash: string;
  importedAt: string;
};

export type FoundationRecord = {
  uri: string;
  cid: string;
  repoDid: string;
  repoRev: string;
  sequence: number;
  observedAt: string;
  status: ProvenanceStatus;
  handle?: string;
  record: FoundationRecordValue;
  rawCbor?: Uint8Array;
  bootstrap?: BootstrapProvenance;
  disposition?: 'primary' | 'candidate';
  deletedAt?: string;
};

export type Provenance = {
  uri: string;
  cid: string;
  repoDid: string;
  repoRev: string;
  sequence: number;
  observedAt: string;
  status: ProvenanceStatus;
};

export type AuthorityDecision = {
  status: AuthorityStatus;
  policyUri: string;
  policyVersion: string;
  rootDid: string;
  chain: StrongRef[];
  reasons: string[];
  failedChecks?: string[];
  activeDisputes?: StrongRef[];
  activeRevocations?: StrongRef[];
  evaluatedAt: string;
};

export type EntityView = {
  entityUri: string;
  profile?: Record<string, unknown>;
  profileProvenance?: Provenance;
  profileAuthority?: AuthorityDecision;
  dsaUnit?: Record<string, unknown>;
  dsaUnitProvenance?: Provenance;
  dsaUnitAuthority?: AuthorityDecision;
  provenance: Provenance;
  authority: AuthorityDecision;
  lifecycle: LifecycleStatusV1;
};

export type ActivityView = {
  uri: string;
  collection: FoundationCollection;
  record: Record<string, unknown>;
  provenance: Provenance;
  authority: AuthorityDecision;
};

export type FoundationValidationIssue = { path: string; message: string };
const TID_ALPHABET = '234567abcdefghijklmnopqrstuvwxyz';

type LexiconValidationResult = { success: boolean; error?: { issues?: Array<{ path?: ReadonlyArray<unknown>; message?: string }> } };
type LexiconValidator = (value: unknown) => LexiconValidationResult;

const recordValidators: Record<FoundationCollection, LexiconValidator> = {
  'us.dsaslate.temp.orgEntity': (value) => orgEntity.$safeParse(value) as LexiconValidationResult,
  'us.dsaslate.temp.orgProfile': (value) => orgProfile.$safeParse(value) as LexiconValidationResult,
  'us.dsaslate.temp.orgRelationship': (value) => orgRelationship.$safeParse(value) as LexiconValidationResult,
  'us.dsaslate.temp.authorityDelegation': (value) => authorityDelegation.$safeParse(value) as LexiconValidationResult,
  'us.dsaslate.temp.authorityAttestation': (value) => authorityAttestation.$safeParse(value) as LexiconValidationResult,
  'us.dsaslate.temp.authorityAction': (value) => authorityAction.$safeParse(value) as LexiconValidationResult,
  'us.dsaslate.temp.identityTransition': (value) => identityTransition.$safeParse(value) as LexiconValidationResult,
  'us.dsaslate.temp.dsaUnit': (value) => dsaUnit.$safeParse(value) as LexiconValidationResult,
  'us.dsaslate.temp.dsaPolicy': (value) => dsaPolicy.$safeParse(value) as LexiconValidationResult,
  'us.dsaslate.temp.publicEvent': (value) => publicEvent.$safeParse(value) as LexiconValidationResult,
};

const privateFieldPatterns = [/person/i, /individual/i, /member(ship)?/i, /interest/i, /contact/i, /e-?mail/i, /phone/i, /payment/i, /dues/i, /grievance/i, /ballot/i, /election/i, /voter/i, /private.?logistics/i];

function findPrivateFields(value: unknown, path = 'record'): FoundationValidationIssue[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => findPrivateFields(item, `${path}.${index}`));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    const issue: FoundationValidationIssue[] = privateFieldPatterns.some((pattern) => pattern.test(key))
      ? [{ path: `${path}.${key}`, message: 'private person, membership, contact, payment, grievance, ballot, or logistics data is not allowed in public v1' }]
      : [];
    return [...issue, ...findPrivateFields(item, `${path}.${key}`)];
  });
}

function captureValidation(path: string, validate: () => void, issues: FoundationValidationIssue[]) {
  try {
    validate();
  } catch (error) {
    issues.push({ path, message: error instanceof Error ? error.message : `invalid ${path}` });
  }
}

function stableDataString(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableDataString).join(',')}]`;
  if (value instanceof Uint8Array) return `{"$bytes":${JSON.stringify(Buffer.from(value).toString('base64'))}}`;
  if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableDataString((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

export function isFoundationCollection(value: string): value is FoundationCollection {
  return (foundationCollections as readonly string[]).includes(value);
}

export function validateFoundationRecordValue(value: unknown): FoundationValidationIssue[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [{ path: 'record', message: 'record must be an object' }];
  const type = (value as { $type?: unknown }).$type;
  if (typeof type !== 'string' || !isFoundationCollection(type)) return [{ path: 'record.$type', message: `unsupported foundation collection ${String(type)}` }];
  const privacyIssues = findPrivateFields(value);
  if (privacyIssues.length) return privacyIssues;
  const result = recordValidators[type](value);
  if (result.success) return [];
  return (result.error?.issues ?? []).map((issue) => ({ path: issue.path?.length ? `record.${issue.path.map(String).join('.')}` : 'record', message: issue.message ?? 'invalid Lexicon record' }));
}

export function validateFoundationRecord(input: FoundationRecord): FoundationValidationIssue[] {
  const issues: FoundationValidationIssue[] = [];
  captureValidation('uri', () => ensureValidAtUri(input.uri), issues);
  captureValidation('repoDid', () => ensureValidDid(input.repoDid), issues);
  captureValidation('repoRev', () => ensureValidTid(input.repoRev), issues);
  if (input.handle) captureValidation('handle', () => ensureValidHandle(input.handle!), issues);
  captureValidation('cid', () => {
    const parsed = CID.parse(input.cid);
    if (parsed.toString() !== input.cid) throw new Error('CID must use its normalized string representation');
  }, issues);
  captureValidation('cid', () => {
    const bytes = input.rawCbor ?? encodeRecord(input.record);
    const computed = computeBytesCid(bytes);
    if (computed !== input.cid) throw new Error(`CID does not match raw record bytes (${computed})`);
    if (input.rawCbor && stableDataString(dagCbor.decode(input.rawCbor)) !== stableDataString(input.record)) throw new Error('raw record bytes decode to different content');
  }, issues);
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) issues.push({ path: 'sequence', message: 'sequence must be a non-negative safe integer' });
  if (Number.isNaN(Date.parse(input.observedAt))) issues.push({ path: 'observedAt', message: 'observedAt must be an ISO datetime' });
  if (!Number.isNaN(Date.parse(input.observedAt))) {
    const revisionTime = tidTimestampMs(input.repoRev);
    if (revisionTime !== undefined && revisionTime > Date.parse(input.observedAt) + 5 * 60_000) issues.push({ path: 'repoRev', message: 'repository revision timestamp is too far in the future' });
  }
  if (!input.record || typeof input.record !== 'object' || Array.isArray(input.record)) {
    issues.push({ path: 'record', message: 'record must be an object' });
    return issues;
  }
  const collection = input.record.$type;
  if (!isFoundationCollection(collection)) {
    issues.push({ path: 'record.$type', message: `unsupported foundation collection ${String(collection)}` });
    return issues;
  }
  captureValidation('record.$type', () => ensureValidNsid(collection), issues);
  try {
    const uri = new AtUri(input.uri);
    if (uri.toString() !== input.uri) issues.push({ path: 'uri', message: 'AT URI must use its normalized string representation' });
    captureValidation('uri.rkey', () => ensureValidRecordKey(uri.rkey), issues);
    if (uri.host !== input.repoDid) issues.push({ path: 'uri', message: `AT URI authority ${uri.host} must equal repository DID ${input.repoDid}` });
    if (uri.collection !== collection) issues.push({ path: 'uri', message: `AT URI collection ${uri.collection ?? 'missing'} must equal record $type ${collection}` });
  } catch {
    // ensureValidAtUri already records the syntax error.
  }
  issues.push(...validateFoundationRecordValue(input.record));
  return issues;
}

export function tidTimestampMs(tid: string) {
  try {
    ensureValidTid(tid);
    let encoded = 0n;
    for (const character of tid) encoded = encoded * 32n + BigInt(TID_ALPHABET.indexOf(character));
    return Number((encoded >> 10n) / 1000n);
  } catch {
    return undefined;
  }
}

export function assertFoundationRecord(input: FoundationRecord): FoundationRecord {
  const issues = validateFoundationRecord(input);
  if (issues.length) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
  return structuredClone(input);
}

export function encodeRecord(record: FoundationRecordValue): Uint8Array {
  return dagCbor.encode(record);
}

function computeBytesCid(bytes: Uint8Array): string {
  const hash = createHash('sha256').update(bytes).digest();
  const multihash = digest.create(0x12, hash);
  return CID.createV1(dagCbor.code, multihash).toString();
}

export function computeRecordCid(record: FoundationRecordValue): string {
  return computeBytesCid(encodeRecord(record));
}

export function createFoundationRecord(input: Omit<FoundationRecord, 'cid' | 'rawCbor'> & { cid?: string; rawCbor?: Uint8Array }): FoundationRecord {
  const rawCbor = input.rawCbor ? new Uint8Array(input.rawCbor) : encodeRecord(input.record);
  const computedCid = computeBytesCid(rawCbor);
  const cid = input.cid ?? computedCid;
  if (cid !== computedCid) throw new Error(`cid: ${cid} does not match raw record bytes (${computedCid})`);
  const decoded = dagCbor.decode(rawCbor);
  if (stableDataString(decoded) !== stableDataString(input.record)) throw new Error('rawCbor: decoded value does not match the supplied record without field loss');
  return assertFoundationRecord({ ...input, cid, rawCbor });
}

export function toProvenance(record: FoundationRecord): Provenance {
  return {
    uri: record.uri,
    cid: record.cid,
    repoDid: record.repoDid,
    repoRev: record.repoRev,
    sequence: record.sequence,
    observedAt: record.observedAt,
    status: record.status,
  };
}

export function encodeCursor(value: { after: string; watermark: number }): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor(value: string | undefined): { after: string; watermark: number } | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { after?: unknown; watermark?: unknown };
    if (typeof parsed.after !== 'string' || !Number.isSafeInteger(parsed.watermark) || Number(parsed.watermark) < 0) return undefined;
    return { after: parsed.after, watermark: Number(parsed.watermark) };
  } catch {
    return undefined;
  }
}

export function normalizePageLimit(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(1, Math.floor(value)));
}
