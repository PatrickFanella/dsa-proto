import { fileURLToPath } from 'node:url';
import { loadRawFixtureRecordsFromFile } from './fixture-files.js';
import { isDirectoryEntityRecord, recordEnvelopeSchema, type RecordEnvelope } from './domain.js';

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

export async function loadRegistryHealthReport(filePath: string): Promise<RegistryHealthReport> {
  const rawRecords = await loadRawFixtureRecordsFromFile(filePath);
  const invalidRecords: HealthIssue[] = [];
  const validRecords: RecordEnvelope[] = [];

  for (const [index, raw] of rawRecords.entries()) {
    const parsed = recordEnvelopeSchema.safeParse(raw);
    if (parsed.success) validRecords.push(parsed.data);
    else invalidRecords.push({ index, reason: formatIssues(parsed.error) });
  }

  const directoryRecords = validRecords
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => isDirectoryEntityRecord(record));

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
