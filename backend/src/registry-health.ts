import { fileURLToPath } from 'node:url';
import { loadRawFixtureRecordsFromFile } from './fixture-files.js';
import { isDirectoryEntityRecord, recordEnvelopeSchema, type RecordEnvelope, validatePublicationBoundary } from './domain.js';

type HealthIssue = {
  index: number;
  reason: string;
};

type DuplicateEntry = {
  value: string;
  indexes: number[];
};

export type RegistryHealthReport = {
  file: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: HealthIssue[];
  directoryCountsByCollection: Record<string, number>;
  directoryCountsByType: Record<string, number>;
  duplicates: {
    uri: DuplicateEntry[];
    did: DuplicateEntry[];
    handle: DuplicateEntry[];
    name: DuplicateEntry[];
  };
};

export type RegistryHealthStatus = 'ok' | 'warning' | 'fail';

export function getRegistryHealthStatus(report: RegistryHealthReport): RegistryHealthStatus {
  if (report.invalidRecords.length > 0) return 'fail';
  if (report.duplicates.uri.length > 0 || report.duplicates.did.length > 0 || report.duplicates.handle.length > 0 || report.duplicates.name.length > 0) return 'warning';
  return 'ok';
}

export function getRegistryHealthSummary(report: RegistryHealthReport) {
  return {
    file: report.file,
    fileLabel: report.file,
    status: getRegistryHealthStatus(report),
    totalRecords: report.totalRecords,
    validCount: report.validRecords,
    invalidCount: report.invalidRecords.length,
    duplicateCount: report.duplicates.uri.length + report.duplicates.did.length + report.duplicates.handle.length + report.duplicates.name.length,
    directoryCountsByCollection: report.directoryCountsByCollection,
    directoryCountsByType: report.directoryCountsByType,
    invalidRecords: report.invalidRecords,
    duplicates: report.duplicates,
  };
}

function formatIssues(error: { issues?: Array<{ path?: ReadonlyArray<unknown>; message: string }> }) {
  return error.issues?.map((issue) => `${issue.path?.length ? issue.path.map(String).join('.') : 'record'}: ${issue.message}`).join('; ') ?? 'invalid record envelope';
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getDirectoryName(record: RecordEnvelope) {
  if (record.collection === 'org.dsa.affiliation.member') return (record.record as { displayName: string }).displayName;
  if (record.collection === 'org.dsa.profile.chapter' || record.collection === 'org.dsa.profile.caucus') return (record.record as { name: string }).name;
  return '';
}

function collectDuplicates(values: Array<{ index: number; value: string }>): DuplicateEntry[] {
  const groups = new Map<string, number[]>();
  for (const entry of values) {
    const indexes = groups.get(entry.value) ?? [];
    indexes.push(entry.index);
    groups.set(entry.value, indexes);
  }
  return [...groups.entries()].filter(([, indexes]) => indexes.length > 1).sort(([a], [b]) => a.localeCompare(b)).map(([value, indexes]) => ({ value, indexes }));
}

type OrgNodeKind = 'entity' | 'profile' | 'org-unit';
type OrgUnitKind = 'national-committee' | 'steering-committee' | 'staff' | 'staff-role' | 'publication' | 'priority-committee' | 'working-group' | 'commission' | 'chapter-network' | 'membership-body' | 'delegate-body' | 'youth-committee';

type OrgNode = {
  uri: string;
  kind: OrgNodeKind;
  orgUnitKind?: OrgUnitKind;
};

type GovernanceRelationship = {
  subjectUri: string;
  objectUri: string;
  relationship: string;
};

const hierarchicalRelationships = new Set(['elects', 'appoints', 'creates-priorities-for', 'approves-charter-for', 'hires-and-directs', 'hires-with-approval']);

const allowedRelationshipPairs: Record<string, ReadonlySet<string>> = {
  elects: new Set(['delegate-body->national-committee', 'national-committee->steering-committee', 'membership-body->chapter-network', 'membership-body->delegate-body']),
  'sits-on': new Set(['youth-committee->national-committee']),
  appoints: new Set(['national-committee->publication']),
  'creates-priorities-for': new Set(['national-committee->priority-committee']),
  'approves-charter-for': new Set(['national-committee->working-group', 'national-committee->chapter-network']),
  'hires-and-directs': new Set(['national-committee->staff-role']),
  'hires-with-approval': new Set(['staff-role->staff']),
  supports: new Set(['staff->membership-body', 'staff->priority-committee']),
  'can-join': new Set(['membership-body->national-committee']),
  'can-volunteer': new Set(['membership-body->priority-committee', 'membership-body->working-group']),
  'can-submit': new Set(['membership-body->publication']),
};

function getOrgNodeKind(record: RecordEnvelope): OrgNodeKind | undefined {
  if (record.collection === 'org.dsa.profile.orgUnit') return 'org-unit';
  if (record.collection === 'org.dsa.profile.chapter' || record.collection === 'org.dsa.profile.caucus') return 'profile';
  if (record.collection === 'org.dsa.affiliation.member') return 'entity';
  return undefined;
}

function getOrgUnitKind(record: RecordEnvelope): OrgUnitKind | undefined {
  return record.collection === 'org.dsa.profile.orgUnit' ? ((record.record as { kind: OrgUnitKind }).kind) : undefined;
}

function getGovernanceRelationship(record: RecordEnvelope): GovernanceRelationship | undefined {
  return record.collection === 'org.dsa.relationship.governance' ? (record.record as GovernanceRelationship) : undefined;
}

function getRelationshipKindPair(subject: OrgNode | undefined, object: OrgNode | undefined) {
  if (!subject || !object) return undefined;
  if (subject.kind === 'org-unit' && object.kind === 'org-unit') return `${subject.orgUnitKind}->${object.orgUnitKind}`;
  if (subject.kind === 'entity' && object.kind === 'org-unit') return 'entity->org-unit';
  if (subject.kind === 'profile' && object.kind === 'org-unit') return 'profile->org-unit';
  if (subject.kind === 'org-unit' && object.kind === 'profile') return 'org-unit->profile';
  return `${subject.kind}->${object.kind}`;
}

function hasHierarchicalCycle(start: string, target: string, adjacency: Map<string, Set<string>>) {
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    if (current === start) return true;
    seen.add(current);
    for (const next of adjacency.get(current) ?? []) stack.push(next);
  }
  return false;
}

export async function loadRegistryHealthReport(filePath: string): Promise<RegistryHealthReport> {
  const rawRecords = await loadRawFixtureRecordsFromFile(filePath);
  const invalidRecords: HealthIssue[] = [];
  const validRecords: RecordEnvelope[] = [];

  for (const [index, raw] of rawRecords.entries()) {
    const boundaryIssues = validatePublicationBoundary(raw);
    if (boundaryIssues.length > 0) {
      invalidRecords.push({ index, reason: boundaryIssues.map((issue) => issue.reason).join('; ') });
      continue;
    }
    const parsed = recordEnvelopeSchema.safeParse(raw);
    if (!parsed.success) {
      invalidRecords.push({ index, reason: formatIssues(parsed.error) });
      continue;
    }
    validRecords.push(parsed.data);
  }

  const directoryRecords = validRecords
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => isDirectoryEntityRecord(record));
  const orgNodes = new Map<string, OrgNode>();
  for (const record of validRecords) {
    const kind = getOrgNodeKind(record);
    if (kind) orgNodes.set(record.uri, { uri: record.uri, kind, orgUnitKind: getOrgUnitKind(record) });
  }
  const hierarchicalAdjacency = new Map<string, Set<string>>();
  const relationshipRecords = validRecords
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.collection === 'org.dsa.relationship.governance');

  for (const { record, index } of relationshipRecords) {
    const relationship = getGovernanceRelationship(record);
    if (!relationship) continue;
    const subject = orgNodes.get(relationship.subjectUri);
    const object = orgNodes.get(relationship.objectUri);
    if (!subject || !object) {
      invalidRecords.push({ index, reason: `relationship references unknown source/target (${subject ? 'target missing' : 'source missing'})` });
      continue;
    }
    if (hierarchicalRelationships.has(relationship.relationship) && hasHierarchicalCycle(relationship.subjectUri, relationship.objectUri, hierarchicalAdjacency)) {
      invalidRecords.push({ index, reason: 'hierarchical relationship creates a cycle' });
      continue;
    }
    const allowedPair = allowedRelationshipPairs[relationship.relationship]?.has(getRelationshipKindPair(subject, object) ?? '');
    if (!allowedPair) {
      invalidRecords.push({ index, reason: `relationship kind ${relationship.relationship} does not allow ${getRelationshipKindPair(subject, object) ?? 'unknown'} pairs` });
      continue;
    }
    if (hierarchicalRelationships.has(relationship.relationship)) {
      const outgoing = hierarchicalAdjacency.get(relationship.subjectUri) ?? new Set<string>();
      outgoing.add(relationship.objectUri);
      hierarchicalAdjacency.set(relationship.subjectUri, outgoing);
    }
  }

  const directoryCountsByCollection: Record<string, number> = {};
  const directoryCountsByType: Record<string, number> = {};
  const duplicateInputs = {
    uri: [] as Array<{ index: number; value: string }>,
    did: [] as Array<{ index: number; value: string }>,
    handle: [] as Array<{ index: number; value: string }>,
    name: [] as Array<{ index: number; value: string }>,
  };

  for (const { record, index } of directoryRecords) {
    directoryCountsByCollection[record.collection] = (directoryCountsByCollection[record.collection] ?? 0) + 1;
    const type = record.collection === 'org.dsa.profile.chapter' ? 'chapter' : record.collection === 'org.dsa.profile.caucus' ? 'caucus' : 'member-affiliation';
    directoryCountsByType[type] = (directoryCountsByType[type] ?? 0) + 1;
    duplicateInputs.uri.push({ index, value: record.uri });
    duplicateInputs.did.push({ index, value: record.did });
    duplicateInputs.handle.push({ index, value: record.handle.toLowerCase() });
    duplicateInputs.name.push({ index, value: `${record.collection}:${normalizeName(getDirectoryName(record))}` });
  }

  return {
    file: filePath,
    totalRecords: rawRecords.length,
    validRecords: validRecords.length,
    invalidRecords,
    directoryCountsByCollection: Object.fromEntries(Object.entries(directoryCountsByCollection).sort(([a], [b]) => a.localeCompare(b))),
    directoryCountsByType: Object.fromEntries(Object.entries(directoryCountsByType).sort(([a], [b]) => a.localeCompare(b))),
    duplicates: {
      uri: collectDuplicates(duplicateInputs.uri),
      did: collectDuplicates(duplicateInputs.did),
      handle: collectDuplicates(duplicateInputs.handle),
      name: collectDuplicates(duplicateInputs.name),
    },
  };
}

function hasFailures(report: RegistryHealthReport) {
  return report.invalidRecords.length > 0 || report.duplicates.uri.length > 0 || report.duplicates.did.length > 0 || report.duplicates.handle.length > 0 || report.duplicates.name.length > 0;
}

function printReport(report: RegistryHealthReport) {
  console.log(`${report.file}: total=${report.totalRecords} valid=${report.validRecords} invalid=${report.invalidRecords.length}`);
  console.log(`  directory by collection: ${Object.entries(report.directoryCountsByCollection).map(([key, value]) => `${key}=${value}`).join(' ') || 'none'}`);
  console.log(`  directory by type: ${Object.entries(report.directoryCountsByType).map(([key, value]) => `${key}=${value}`).join(' ') || 'none'}`);
  for (const issue of report.invalidRecords) console.log(`  invalid[${issue.index}]: ${issue.reason}`);
  for (const [label, duplicates] of Object.entries(report.duplicates)) {
    for (const duplicate of duplicates) console.log(`  duplicate ${label}: ${duplicate.value} @ ${duplicate.indexes.join(',')}`);
  }
}

async function main() {
  const files = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const fixtureFiles = files.length > 0 ? files : ['fixtures/records.json'];
  let failed = false;
  for (const file of fixtureFiles) {
    const report = await loadRegistryHealthReport(file);
    printReport(report);
    if (hasFailures(report)) failed = true;
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
