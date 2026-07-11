import { describe, expect, it } from 'vitest';
import { createFoundationRecord, DEFAULT_BOOTSTRAP_REPO_REV, DEFAULT_POLICY_VERSION, DEFAULT_PROVISIONAL_ROOT_DID } from './foundation-model.js';
import { FoundationService } from './foundation-service.js';

function setup() {
  const entity = createFoundationRecord({
    uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgEntity/entity-one`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: DEFAULT_BOOTSTRAP_REPO_REV, sequence: 1, observedAt: '2026-07-09T00:00:00.000Z', status: 'unverified',
    record: { $type: 'us.dsaslate.temp.orgEntity', displayName: 'Entity One', entityType: 'organization', createdAt: '2026-07-09T00:00:00.000Z' },
  });
  const policy = createFoundationRecord({
    uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.dsaPolicy/bootstrap-policy`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: DEFAULT_BOOTSTRAP_REPO_REV, sequence: 2, observedAt: '2026-07-09T00:00:00.000Z', status: 'unverified',
    record: { $type: 'us.dsaslate.temp.dsaPolicy', policyVersion: DEFAULT_POLICY_VERSION, rootDid: DEFAULT_PROVISIONAL_ROOT_DID, mode: 'provisional', permittedUnitKinds: ['chapter'], createdAt: '2026-07-09T00:00:00.000Z' },
  });
  return { entity, policy, service: new FoundationService([entity, policy], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION }) };
}

describe('foundation AppView service', () => {
  it('accepts an idempotent CID when decoded object keys arrive in a different order', () => {
    const { entity, policy, service } = setup();
    const reordered = { createdAt: entity.record.createdAt, entityType: entity.record.entityType, displayName: entity.record.displayName, $type: entity.record.$type };
    expect(service.applySyncEvent({
      kind: 'record', action: 'update', repoDid: entity.repoDid, pds: 'https://pds.example', repoRev: '3jzfcijpj2z2b', sequence: 3, cursor: 3,
      uri: entity.uri, cid: entity.cid, record: reordered, rawCbor: entity.rawCbor, observedAt: '2026-07-09T00:00:01.000Z', verified: true,
    })).toBe('accepted');
    expect(service.resolve(entity.uri).authority).toMatchObject({ status: 'provisional', policyUri: policy.uri });
  });

  it('restores tombstones into history without resurrecting current projections', () => {
    const { entity, policy } = setup();
    const tombstone = { ...entity, repoRev: '3jzfcijpj2z2b', sequence: 3, observedAt: '2026-07-10T00:00:00.000Z', deletedAt: '2026-07-10T00:00:00.000Z' };
    const restored = new FoundationService([entity, policy, tombstone], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });
    expect(restored.listEntities().entities).toHaveLength(0);
    expect(restored.resolve(entity.uri)).toMatchObject({ deletedAt: tombstone.deletedAt, authority: { status: 'unresolved' } });
  });

  it('keeps the temporary root provisional and supports opaque pagination', () => {
    const { entity, service } = setup();
    const page = service.listEntities({ limit: 1 });
    expect(page.entities).toHaveLength(1);
    expect(page.entities[0].entityUri).toBe(entity.uri);
    expect(page.entities[0].authority.status).toBe('provisional');
    expect(service.resolve(entity.uri).authority.status).toBe('provisional');
  });

  it('selects exact-CID entity projections by authority before cross-repository recency', () => {
    const { entity, policy } = setup();
    const controllerDid = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
    const rootProfile = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgProfile/root`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2b', sequence: 3, observedAt: '2026-07-09T00:00:01.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.orgProfile', entity: { uri: entity.uri, cid: entity.cid }, displayName: 'Root profile', createdAt: '2026-07-09T00:00:01.000Z' },
    });
    const controllerProfile = createFoundationRecord({
      uri: `at://${controllerDid}/us.dsaslate.temp.orgProfile/controller`, repoDid: controllerDid, repoRev: '3jzfcijpj2z2z', sequence: 5, observedAt: '2026-07-09T00:00:05.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.orgProfile', entity: { uri: entity.uri, cid: entity.cid }, displayName: 'Controller profile', createdAt: '2026-07-09T00:00:05.000Z' },
    });
    const enrollment = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.authorityDelegation/enroll`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2c', sequence: 4, observedAt: '2026-07-09T00:00:02.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityDelegation', delegateDid: controllerDid, entityUris: [entity.uri], collections: ['us.dsaslate.temp.publicEvent'], actions: ['create'], effectiveFrom: '2026-07-09T00:00:00.000Z', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const selfAsserted = new FoundationService([entity, policy, rootProfile, controllerProfile, enrollment], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });
    expect(selfAsserted.getEntity(entity.uri)).toMatchObject({ profile: { displayName: 'Root profile' }, profileAuthority: { status: 'provisional' } });

    const profileDelegation = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.authorityDelegation/profile`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2d', sequence: 6, observedAt: '2026-07-09T00:00:03.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityDelegation', delegateDid: controllerDid, entityUris: [entity.uri], collections: ['us.dsaslate.temp.orgProfile'], actions: ['create', 'update'], effectiveFrom: '2026-07-09T00:00:00.000Z', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const delegated = new FoundationService([entity, policy, rootProfile, controllerProfile, enrollment, profileDelegation], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });
    expect(delegated.getEntity(entity.uri)).toMatchObject({ profile: { displayName: 'Controller profile' }, profileProvenance: { repoDid: controllerDid }, profileAuthority: { status: 'provisional' } });

    const staleStrongRef = createFoundationRecord({
      uri: `at://${controllerDid}/us.dsaslate.temp.orgProfile/stale`, repoDid: controllerDid, repoRev: '3jzfcijpj2zzz', sequence: 7, observedAt: '2026-07-09T00:00:07.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.orgProfile', entity: { uri: entity.uri, cid: policy.cid }, displayName: 'Wrong CID', createdAt: '2026-07-09T00:00:07.000Z' },
    });
    const exact = new FoundationService([entity, policy, rootProfile, controllerProfile, enrollment, profileDelegation, staleStrongRef], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });
    expect(exact.getEntity(entity.uri)?.profile).toMatchObject({ displayName: 'Controller profile' });
  });

  it('never activates official authority for a temporary namespace', () => {
    const { entity, policy } = setup();
    const service = new FoundationService([entity, policy], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION, officialActivation: { enabled: true, adoptionDigest: 'sha256:test', stableNamespace: 'us.dsaslate' } });
    expect(service.resolve(entity.uri).authority.status).toBe('provisional');
  });

  it('applies revocation over dispute and excludes future actions from historical resolution', () => {
    const { entity, policy } = setup();
    const dispute = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.authorityAction/dispute`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2b', sequence: 3, observedAt: '2026-07-10T00:00:00.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityAction', target: { uri: entity.uri, cid: entity.cid }, action: 'dispute', reason: 'Contested', effectiveAt: '2026-07-10T00:00:00.000Z' },
    });
    const revocation = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.authorityAction/revoke`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2c', sequence: 4, observedAt: '2026-07-10T00:00:01.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityAction', target: { uri: entity.uri, cid: entity.cid }, action: 'revoke', reason: 'Withdrawn', effectiveAt: '2026-07-10T00:00:01.000Z' },
    });
    const service = new FoundationService([entity, policy, dispute, revocation], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });
    const current = service.resolve(entity.uri, { asOf: '2026-07-11T00:00:00.000Z' }).authority;
    expect(current.status).toBe('revoked');
    expect(current.activeDisputes).toHaveLength(1);
    expect(current.activeRevocations).toHaveLength(1);
    expect(service.resolve(entity.uri, { asOf: '2026-07-09T23:59:59.000Z' }).authority.status).toBe('provisional');
  });

  it('reports expiry and resolver depth failures with the evaluated chain', () => {
    const { entity, policy } = setup();
    const delegation = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.authorityDelegation/base`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2b', sequence: 3, observedAt: '2026-07-09T00:00:01.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityDelegation', delegateDid: DEFAULT_PROVISIONAL_ROOT_DID, entityUris: [entity.uri], collections: ['us.dsaslate.temp.orgEntity'], actions: ['attest'], effectiveFrom: '2026-07-09T00:00:00.000Z', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const attestation = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.authorityAttestation/entity`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2c', sequence: 4, observedAt: '2026-07-09T00:00:02.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityAttestation', subject: { uri: entity.uri, cid: entity.cid }, claim: 'recognizesEntity', delegation: { uri: delegation.uri, cid: delegation.cid }, issuedAt: '2026-07-09T00:00:02.000Z', expiresAt: '2026-07-11T00:00:00.000Z' },
    });
    const service = new FoundationService([entity, policy, delegation, attestation], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });
    const shallow = service.resolve(entity.uri, { asOf: '2026-07-10T00:00:00.000Z', depth: 0 }).authority;
    expect(shallow).toMatchObject({ status: 'unresolved', failedChecks: ['maximum resolver depth reached'] });
    expect(shallow.chain).toHaveLength(1);
    expect(service.resolve(entity.uri, { asOf: '2026-07-10T00:00:00.000Z', depth: 1 }).authority.status).toBe('provisional');
    expect(service.resolve(entity.uri, { asOf: '2026-07-12T00:00:00.000Z' }).authority.status).toBe('expired');
  });

  it('rejects an authority chain whose strong-reference parent is missing', () => {
    const { entity, policy } = setup();
    const missingParent = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.authorityDelegation/missing`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2b', sequence: 8, observedAt: '2026-07-09T00:00:01.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityDelegation', delegateDid: DEFAULT_PROVISIONAL_ROOT_DID, entityUris: [entity.uri], collections: ['us.dsaslate.temp.orgEntity'], actions: ['attest'], effectiveFrom: '2026-07-09T00:00:00.000Z', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const attestation = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.authorityAttestation/missing-parent`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2c', sequence: 9, observedAt: '2026-07-09T00:00:02.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityAttestation', subject: { uri: entity.uri, cid: entity.cid }, claim: 'recognizesEntity', delegation: { uri: missingParent.uri, cid: entity.cid }, issuedAt: '2026-07-09T00:00:02.000Z' },
    });
    const service = new FoundationService([entity, policy, attestation], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });
    expect(service.resolve(entity.uri, { asOf: '2026-07-10T00:00:00.000Z' }).authority).toMatchObject({ status: 'unresolved', reasons: ['authority chain is incomplete'] });
  });

  it('does not enroll future delegations or resurrect a deleted record', () => {
    const { entity, policy } = setup();
    const delegateDid = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
    const futureDelegation = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.authorityDelegation/future`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2b', sequence: 3, observedAt: '2026-07-09T00:00:01.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityDelegation', delegateDid, entityUris: [entity.uri], collections: ['us.dsaslate.temp.orgProfile'], actions: ['create'], effectiveFrom: '2099-01-01T00:00:00.000Z', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const service = new FoundationService([entity, policy, futureDelegation], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });
    expect(service.isEnrolled(delegateDid)).toBe(false);
    expect(service.applySyncEvent({ kind: 'record', action: 'delete', repoDid: DEFAULT_PROVISIONAL_ROOT_DID, pds: 'https://pds.example', repoRev: '3jzfcijpj2z2c', sequence: 4, cursor: 4, uri: entity.uri, observedAt: '2026-07-10T00:00:00.000Z', verified: true })).toBe('accepted');
    expect(service.resolve(entity.uri, { asOf: '2026-07-11T00:00:00.000Z' })).toMatchObject({ deletedAt: '2026-07-10T00:00:00.000Z', authority: { status: 'unresolved' } });
    expect(service.resolve(entity.uri, { asOf: '2026-07-09T12:00:00.000Z' }).authority.status).toBe('provisional');
  });

  it('applies event delegation only inside its entity scope', () => {
    const { entity, policy } = setup();
    const controllerDid = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
    const otherEntity = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgEntity/other`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2b', sequence: 3, observedAt: '2026-07-09T00:00:01.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.orgEntity', displayName: 'Other Entity', entityType: 'organization', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const delegation = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.authorityDelegation/events`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2c', sequence: 4, observedAt: '2026-07-09T00:00:02.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityDelegation', delegateDid: controllerDid, entityUris: [entity.uri], collections: ['us.dsaslate.temp.publicEvent'], actions: ['create', 'update', 'delete'], effectiveFrom: '2026-07-09T00:00:00.000Z', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const makeEvent = (rkey: string, hostEntity: string, sequence: number) => createFoundationRecord({
      uri: `at://${controllerDid}/us.dsaslate.temp.publicEvent/${rkey}`, repoDid: controllerDid, repoRev: `3jzfcijpj2z2${sequence}`, sequence, observedAt: `2026-07-09T00:00:0${sequence}.000Z`, status: 'verified',
      record: { $type: 'us.dsaslate.temp.publicEvent', hostEntity, title: rkey, startsAt: '2026-07-20T00:00:00.000Z', mode: 'online', status: 'scheduled', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const inScope = makeEvent('inside', entity.uri, 5);
    const outOfScope = makeEvent('outside', otherEntity.uri, 6);
    const service = new FoundationService([entity, otherEntity, policy, delegation, inScope, outOfScope], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });
    expect(service.resolve(inScope.uri).authority.status).toBe('provisional');
    expect(service.resolve(outOfScope.uri).authority.status).toBe('selfAsserted');
  });

  it('resolves root to chapter to organizer delegation chains without scope escalation', () => {
    const { entity, policy } = setup();
    const chapterDid = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
    const organizerDid = 'did:plc:bbbbbbbbbbbbbbbbbbbbbbbb';
    const rootDelegation = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.authorityDelegation/chapter`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2b', sequence: 3, observedAt: '2026-07-09T00:00:01.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityDelegation', delegateDid: chapterDid, entityUris: [entity.uri], collections: ['us.dsaslate.temp.authorityDelegation', 'us.dsaslate.temp.publicEvent'], actions: ['create', 'update', 'delete', 'delegate'], effectiveFrom: '2026-07-09T00:00:00.000Z', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const chapterDelegation = createFoundationRecord({
      uri: `at://${chapterDid}/us.dsaslate.temp.authorityDelegation/organizer`, repoDid: chapterDid, repoRev: '3jzfcijpj2z2c', sequence: 4, observedAt: '2026-07-09T00:00:02.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityDelegation', delegateDid: organizerDid, entityUris: [entity.uri], collections: ['us.dsaslate.temp.publicEvent'], actions: ['create', 'update'], effectiveFrom: '2026-07-09T00:00:00.000Z', parent: { uri: rootDelegation.uri, cid: rootDelegation.cid }, createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const event = createFoundationRecord({
      uri: `at://${organizerDid}/us.dsaslate.temp.publicEvent/meeting`, repoDid: organizerDid, repoRev: '3jzfcijpj2z2d', sequence: 5, observedAt: '2026-07-09T00:00:03.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.publicEvent', hostEntity: entity.uri, title: 'Chapter meeting', startsAt: '2026-07-20T00:00:00.000Z', mode: 'online', status: 'scheduled', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const service = new FoundationService([entity, policy, rootDelegation, chapterDelegation, event], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });

    expect(service.listEnrolledRepos()).toEqual([DEFAULT_PROVISIONAL_ROOT_DID, chapterDid, organizerDid].sort());
    expect(service.resolve(chapterDelegation.uri).authority).toMatchObject({
      status: 'provisional',
      chain: [{ uri: chapterDelegation.uri, cid: chapterDelegation.cid }, { uri: rootDelegation.uri, cid: rootDelegation.cid }],
    });
    expect(service.resolve(event.uri).authority).toMatchObject({
      status: 'provisional',
      chain: [{ uri: chapterDelegation.uri, cid: chapterDelegation.cid }, { uri: rootDelegation.uri, cid: rootDelegation.cid }],
      reasons: ['complete delegated chain to provisional staging root'],
    });

    const otherEntity = createFoundationRecord({
      uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgEntity/other-scope`, repoDid: DEFAULT_PROVISIONAL_ROOT_DID, repoRev: '3jzfcijpj2z2e', sequence: 6, observedAt: '2026-07-09T00:00:04.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.orgEntity', displayName: 'Other scope', entityType: 'organization', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const escalatedDelegation = createFoundationRecord({
      uri: `at://${chapterDid}/us.dsaslate.temp.authorityDelegation/escalated`, repoDid: chapterDid, repoRev: '3jzfcijpj2z2f', sequence: 7, observedAt: '2026-07-09T00:00:05.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.authorityDelegation', delegateDid: organizerDid, entityUris: [otherEntity.uri], collections: ['us.dsaslate.temp.publicEvent'], actions: ['create'], effectiveFrom: '2026-07-09T00:00:00.000Z', parent: { uri: rootDelegation.uri, cid: rootDelegation.cid }, createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const outOfScope = createFoundationRecord({
      uri: `at://${organizerDid}/us.dsaslate.temp.publicEvent/out-of-scope`, repoDid: organizerDid, repoRev: '3jzfcijpj2z2g', sequence: 8, observedAt: '2026-07-09T00:00:06.000Z', status: 'verified',
      record: { $type: 'us.dsaslate.temp.publicEvent', hostEntity: otherEntity.uri, title: 'Out of scope', startsAt: '2026-07-20T00:00:00.000Z', mode: 'online', status: 'scheduled', createdAt: '2026-07-09T00:00:00.000Z' },
    });
    const rejected = new FoundationService([entity, otherEntity, policy, rootDelegation, escalatedDelegation, outOfScope], { rootDid: DEFAULT_PROVISIONAL_ROOT_DID, policyUri: policy.uri, policyCid: policy.cid, policyVersion: DEFAULT_POLICY_VERSION });
    expect(rejected.resolve(outOfScope.uri).authority).toMatchObject({ status: 'unresolved', failedChecks: [`delegation ${escalatedDelegation.uri} expands its parent entity scope`] });
  });

  it('rejects client-controlled envelope and authority fields from review submissions', () => {
    const { service } = setup();
    const record = { $type: 'us.dsaslate.temp.publicEvent', hostEntity: 'at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/us.dsaslate.temp.orgEntity/entity', title: 'Event', startsAt: '2026-07-20T00:00:00.000Z', mode: 'online', status: 'scheduled', createdAt: '2026-07-09T00:00:00.000Z' };
    expect(service.submitForReview({ submitterDid: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa', collection: record.$type, record }).status).toBe('pending');
    expect(() => service.submitForReview({ submitterDid: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa', collection: record.$type, record: { ...record, trustLabel: 'official' } })).toThrow('client-controlled trustLabel');
  });

  it('keeps review decisions and their actors in append-only private audit events', () => {
    const { service } = setup();
    const record = { $type: 'us.dsaslate.temp.publicEvent', hostEntity: 'at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/us.dsaslate.temp.orgEntity/entity', title: 'Event', startsAt: '2026-07-20T00:00:00.000Z', mode: 'online', status: 'scheduled', createdAt: '2026-07-09T00:00:00.000Z' };
    const pending = service.submitForReview({ submitterDid: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa', collection: record.$type, record });
    const target = { uri: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgEntity/entity`, cid: setup().entity.cid };
    const approved = service.updateReviewOperation(pending.operationId, { actorDid: DEFAULT_PROVISIONAL_ROOT_DID, status: 'approved', decision: 'approve', reason: 'public evidence reviewed', target, policyVersion: DEFAULT_POLICY_VERSION, message: 'approved under temp-v1' });
    expect(approved.auditEvents).toHaveLength(2);
    expect(approved.auditEvents[1]).toMatchObject({ actorDid: DEFAULT_PROVISIONAL_ROOT_DID, status: 'approved', decision: 'approve', reason: 'public evidence reviewed', target, policyVersion: DEFAULT_POLICY_VERSION, message: 'approved under temp-v1' });
  });

  it('quarantines non-enrolled repos and marks revision-chain gaps desynchronized', () => {
    const { service } = setup();
    const candidateDid = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
    const eventRecord = { $type: 'us.dsaslate.temp.publicEvent' as const, hostEntity: `at://${DEFAULT_PROVISIONAL_ROOT_DID}/us.dsaslate.temp.orgEntity/entity-one`, title: 'Candidate', startsAt: '2026-07-20T00:00:00.000Z', mode: 'online', status: 'scheduled', createdAt: '2026-07-09T00:00:00.000Z' };
    const candidate = createFoundationRecord({ uri: `at://${candidateDid}/us.dsaslate.temp.publicEvent/event-one`, repoDid: candidateDid, repoRev: DEFAULT_BOOTSTRAP_REPO_REV, sequence: 1, observedAt: '2026-07-09T00:00:00.000Z', status: 'verified', record: eventRecord });
    expect(service.applySyncEvent({ kind: 'record', action: 'create', repoDid: candidateDid, pds: 'https://pds.example', repoRev: candidate.repoRev, sequence: 1, cursor: 1, uri: candidate.uri, cid: candidate.cid, record: candidate.record, observedAt: candidate.observedAt, verified: true })).toBe('quarantined');
    expect(service.candidateCount()).toBe(1);
    expect(service.applySyncEvent({ kind: 'record', action: 'create', repoDid: candidateDid, pds: 'https://pds.example', repoRev: '3jzfcijpj2z2b', expectedPrevRev: '3jzfcijpj2zzz', sequence: 3, cursor: 3, uri: candidate.uri, cid: candidate.cid, record: candidate.record, observedAt: '2026-07-09T00:00:01.000Z', verified: true })).toBe('desynchronized');
  });
});
