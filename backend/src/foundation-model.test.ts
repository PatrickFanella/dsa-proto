import { describe, expect, it } from 'vitest';
import { createFoundationRecord, DEFAULT_BOOTSTRAP_REPO_REV, DEFAULT_PROVISIONAL_ROOT_DID, validateFoundationRecord, validateFoundationRecordValue } from './foundation-model.js';

function validRecord() {
  return createFoundationRecord({
    uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgEntity/3jzfcijpj2z2a`,
    repoDid: DEFAULT_PROVISIONAL_ROOT_DID,
    repoRev: DEFAULT_BOOTSTRAP_REPO_REV,
    sequence: 1,
    observedAt: '2026-07-09T00:00:00.000Z',
    status: 'verified',
    handle: 'registry.pds-staging.dsaslate.us',
    record: {
      $type: 'us.dsaslate.temp.orgEntity',
      displayName: 'Example Chapter',
      entityType: 'organization',
      createdAt: '2026-07-09T00:00:00.000Z',
      futureExtension: { preserved: true },
    },
  });
}

describe('foundation record integrity', () => {
  it('accepts valid records and preserves unknown extension fields', () => {
    const record = validRecord();
    expect(validateFoundationRecord(record)).toEqual([]);
    expect(record.record.futureExtension).toEqual({ preserved: true });
    expect(record.rawCbor?.length).toBeGreaterThan(0);
    expect(record.cid).toMatch(/^bafy/);
  });

  it('rejects URI authority and collection mismatches', () => {
    const record = validRecord();
    const issues = validateFoundationRecord({
      ...record,
      uri: 'at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/us.dsaslate.temp.publicEvent/3jzfcijpj2z2a',
    });
    expect(issues.map((issue) => issue.message).join(' ')).toContain('must equal repository DID');
    expect(issues.map((issue) => issue.message).join(' ')).toContain('must equal record $type');
    expect(validateFoundationRecord({ ...record, uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgEntity` }).map((issue) => issue.path)).toContain('uri.rkey');
  });

  it('rejects invalid CID, DID, handle, and revision syntax', () => {
    const record = validRecord();
    const issues = validateFoundationRecord({ ...record, cid: 'fake', repoDid: 'not-a-did', handle: 'not a handle', repoRev: 'not-a-tid' });
    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining(['cid', 'repoDid', 'handle', 'repoRev']));
    expect(validateFoundationRecord({ ...record, repoRev: '7zzzzzzzzzzzz' }).map((issue) => issue.message).join(' ')).toContain('too far in the future');
  });

  it('rejects a CID or raw block that does not match the decoded record', () => {
    const record = validRecord();
    expect(() => createFoundationRecord({ ...record, cid: 'bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkz7l6i73ndnj6b5zps5e' })).toThrow('does not match raw record bytes');
    const changed = { ...record.record, displayName: 'Changed after encoding' };
    expect(() => createFoundationRecord({ ...record, record: changed, rawCbor: record.rawCbor })).toThrow('decoded value does not match');
  });

  it('rejects private membership, contact, payment, grievance, ballot, and logistics fields', () => {
    const base = { $type: 'us.dsaslate.temp.orgEntity' as const, displayName: 'Public organization', entityType: 'organization', createdAt: '2026-07-09T00:00:00.000Z' };
    for (const key of ['personName', 'memberDid', 'interestTags', 'contactEmail', 'paymentStatus', 'grievanceNotes', 'ballotChoice', 'electionDate', 'privateLogistics']) {
      expect(validateFoundationRecordValue({ ...base, [key]: 'private' }).map((issue) => issue.path)).toContain(`record.${key}`);
    }
  });
});
