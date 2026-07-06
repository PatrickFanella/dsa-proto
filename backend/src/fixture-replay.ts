import { recordEnvelopeSchema, type RecordEnvelope, validatePublicationBoundary } from './domain.js';
import type { DirectoryRepository } from './server.js';

export type FixtureReplayRejection = {
  index: number;
  reason: string;
};

export type FixtureReplayReport = {
  acceptedCount: number;
  rejected: FixtureReplayRejection[];
  ingestedCount: number;
};

function formatValidationReason(error: { issues?: Array<{ path?: ReadonlyArray<unknown>; message: string }> }) {
  return error.issues?.map((issue) => `${issue.path?.length ? issue.path.map(String).join('.') : 'record'}: ${issue.message}`).join('; ') ?? 'invalid record envelope';
}

export async function replayFixtureRecords(records: unknown[], repository: Pick<DirectoryRepository, 'ingestRecordEnvelopes'>): Promise<FixtureReplayReport> {
  const validRecords: RecordEnvelope[] = [];
  const rejected: FixtureReplayRejection[] = [];

  for (const [index, record] of records.entries()) {
    const boundaryIssues = validatePublicationBoundary(record);
    if (boundaryIssues.length > 0) {
      rejected.push({ index, reason: boundaryIssues.map((issue) => issue.reason).join('; ') });
      continue;
    }
    const parsed = recordEnvelopeSchema.safeParse(record);
    if (!parsed.success) {
      rejected.push({ index, reason: formatValidationReason(parsed.error) });
      continue;
    }
    validRecords.push(parsed.data);
  }

  if (validRecords.length > 0) {
    await repository.ingestRecordEnvelopes(validRecords);
  }

  return { acceptedCount: validRecords.length, rejected, ingestedCount: validRecords.length };
}
