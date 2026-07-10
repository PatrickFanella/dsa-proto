import { createHash } from 'node:crypto';
import { AtUri, isValidDid } from '@atproto/syntax';
import type { RecordEnvelope } from './domain.js';
import {
  createFoundationRecord,
  DEFAULT_BOOTSTRAP_REPO_REV,
  DEFAULT_POLICY_VERSION,
  DEFAULT_PROVISIONAL_ROOT_DID,
  type BootstrapProvenance,
  type FoundationRecord,
  type FoundationRecordValue,
  type StrongRef,
} from './foundation-model.js';

export type LegacyMigrationResult = {
  records: FoundationRecord[];
  dropped: Array<{ uri: string; collection: string; reason: string }>;
  warnings: Array<{ uri: string; reason: string }>;
  entityMap: Map<string, StrongRef>;
  policy: StrongRef;
};

export type LegacyMigrationOptions = {
  rootDid?: string;
  repoRev?: string;
  importedAt?: string;
  policyVersion?: string;
};

const permittedUnitKinds = ['chapter', 'organizingCommittee', 'caucus', 'nationalCommittee', 'steeringCommittee', 'workingGroup', 'commission', 'staff', 'publication', 'membershipBody', 'delegateBody', 'youthCommittee', 'other'];

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function recordKey(prefix: string, value: string) {
  return `${prefix}-${digest(value).slice(0, 24)}`;
}

function isRepositoryDid(value: string) {
  if (!isValidDid(value)) return false;
  return !value.startsWith('did:plc:') || /^did:plc:[a-z2-7]{24}$/.test(value);
}

function sourceUrl(record: RecordEnvelope): string | undefined {
  const value = record.record as Record<string, unknown>;
  for (const key of ['sourceUrl', 'website', 'publicUrl']) {
    if (typeof value[key] === 'string') return value[key] as string;
  }
  return undefined;
}

function bootstrap(record: RecordEnvelope, importedAt: string): BootstrapProvenance {
  return {
    legacyUri: record.uri,
    legacyCollection: record.collection,
    sourceUrl: sourceUrl(record),
    rowHash: `sha256:${digest(record)}`,
    importedAt,
  };
}

function mapUnitKind(record: RecordEnvelope): string {
  if (record.collection === 'org.dsa.profile.chapter') {
    const kind = (record.record as { jurisdiction?: { type?: string } }).jurisdiction?.type;
    return kind === 'organizing-committee' ? 'organizingCommittee' : 'chapter';
  }
  if (record.collection === 'org.dsa.profile.caucus') return 'caucus';
  const kind = (record.record as { kind?: string }).kind;
  const map: Record<string, string> = {
    'national-committee': 'nationalCommittee',
    'steering-committee': 'steeringCommittee',
    'working-group': 'workingGroup',
    commission: 'commission',
    staff: 'staff',
    'staff-role': 'staff',
    publication: 'publication',
    'priority-committee': 'workingGroup',
    'chapter-network': 'chapter',
    'membership-body': 'membershipBody',
    'delegate-body': 'delegateBody',
    'youth-committee': 'youthCommittee',
  };
  return kind ? map[kind] ?? 'other' : 'other';
}

function recordDisplayName(record: RecordEnvelope) {
  const value = record.record as { name?: string; shortName?: string; displayName?: string };
  return value.name ?? value.displayName ?? value.shortName ?? record.handle;
}

function makeRecord(input: {
  rootDid: string;
  repoRev: string;
  sequence: number;
  observedAt: string;
  rkey: string;
  record: FoundationRecordValue;
  bootstrap?: BootstrapProvenance;
}) {
  return createFoundationRecord({
    uri: `at://${input.rootDid}/${input.record.$type}/${input.rkey}`,
    repoDid: input.rootDid,
    repoRev: input.repoRev,
    sequence: input.sequence,
    observedAt: input.observedAt,
    status: 'unverified',
    record: input.record,
    bootstrap: input.bootstrap,
  });
}

export function migrateLegacyRecords(records: RecordEnvelope[], options: LegacyMigrationOptions = {}): LegacyMigrationResult {
  const rootDid = options.rootDid ?? DEFAULT_PROVISIONAL_ROOT_DID;
  const repoRev = options.repoRev ?? DEFAULT_BOOTSTRAP_REPO_REV;
  const importedAt = options.importedAt ?? '2026-07-09T00:00:00.000Z';
  const policyVersion = options.policyVersion ?? DEFAULT_POLICY_VERSION;
  const output: FoundationRecord[] = [];
  const dropped: LegacyMigrationResult['dropped'] = [];
  const warnings: LegacyMigrationResult['warnings'] = [];
  const entityMap = new Map<string, StrongRef>();
  const profileMap = new Map<string, StrongRef>();
  let sequence = 1;

  const policyRecord = makeRecord({
    rootDid,
    repoRev,
    sequence: sequence++,
    observedAt: importedAt,
    rkey: 'bootstrap-policy',
    record: {
      $type: 'us.dsaslate.temp.dsaPolicy',
      policyVersion,
      rootDid,
      mode: 'provisional',
      permittedUnitKinds,
      createdAt: importedAt,
    },
  });
  output.push(policyRecord);
  const policy = { uri: policyRecord.uri, cid: policyRecord.cid };

  const entityRecords = records.filter((record) => record.collection === 'org.dsa.profile.chapter' || record.collection === 'org.dsa.profile.caucus' || record.collection === 'org.dsa.profile.orgUnit');
  for (const legacy of entityRecords) {
    const name = recordDisplayName(legacy);
    const entitySourceUrl = sourceUrl(legacy);
    const entity = makeRecord({
      rootDid,
      repoRev,
      sequence: sequence++,
      observedAt: legacy.indexedAt,
      rkey: recordKey('entity', legacy.uri),
      record: {
        $type: 'us.dsaslate.temp.orgEntity',
        displayName: name,
        entityType: 'organization',
        ...(entitySourceUrl ? { canonicalUrl: entitySourceUrl } : {}),
        createdAt: legacy.indexedAt,
      },
      bootstrap: bootstrap(legacy, importedAt),
    });
    output.push(entity);
    const entityRef = { uri: entity.uri, cid: entity.cid };
    entityMap.set(legacy.uri, entityRef);

    const description = (legacy.record as { description?: string }).description;
    const website = sourceUrl(legacy);
    const profile = makeRecord({
      rootDid,
      repoRev,
      sequence: sequence++,
      observedAt: legacy.indexedAt,
      rkey: recordKey('profile', legacy.uri),
      record: {
        $type: 'us.dsaslate.temp.orgProfile',
        entity: entityRef,
        displayName: name,
        ...(description ? { description } : {}),
        ...(website ? { links: [{ uri: website, label: 'Public website' }] } : {}),
        createdAt: legacy.indexedAt,
      },
      bootstrap: bootstrap(legacy, importedAt),
    });
    output.push(profile);
    profileMap.set(legacy.uri, { uri: profile.uri, cid: profile.cid });

    const chapterJurisdiction = legacy.collection === 'org.dsa.profile.chapter' ? (legacy.record as { jurisdiction?: { type?: string; name?: string; state?: string; country?: string } }).jurisdiction : undefined;
    output.push(makeRecord({
      rootDid,
      repoRev,
      sequence: sequence++,
      observedAt: legacy.indexedAt,
      rkey: recordKey('unit', legacy.uri),
      record: {
        $type: 'us.dsaslate.temp.dsaUnit',
        entity: entityRef,
        unitKind: mapUnitKind(legacy),
        ...(chapterJurisdiction?.name ? { jurisdiction: { kind: chapterJurisdiction.type ?? 'unknown', name: chapterJurisdiction.name, ...(chapterJurisdiction.state ? { region: chapterJurisdiction.state } : {}), ...(chapterJurisdiction.country ? { country: chapterJurisdiction.country.slice(0, 2).toUpperCase() } : {}) } } : {}),
        createdAt: legacy.indexedAt,
      },
      bootstrap: bootstrap(legacy, importedAt),
    }));
  }

  for (const legacy of records) {
    if (entityMap.has(legacy.uri)) continue;
    if (legacy.collection === 'org.dsa.affiliation.member') {
      dropped.push({ uri: legacy.uri, collection: legacy.collection, reason: 'public person and membership-affiliation records are excluded from v1' });
      continue;
    }
    if (legacy.collection === 'org.dsa.identity.continuity') {
      const value = legacy.record as {
        stableId: string;
        subjectUri: string;
        status: string;
        successorUri?: string;
        supersedesUri?: string;
      };
      const entity = entityMap.get(value.subjectUri);
      if (!entity) {
        warnings.push({ uri: legacy.uri, reason: 'identity transition references an entity not present in the migration input' });
        continue;
      }
      let fromUri = value.subjectUri;
      let toUri = value.subjectUri;
      if (value.successorUri) toUri = value.successorUri;
      else if (value.supersedesUri) fromUri = value.supersedesUri;
      let fromDid: string;
      let toDid: string;
      try {
        fromDid = new AtUri(fromUri).host;
        toDid = new AtUri(toUri).host;
      } catch {
        warnings.push({ uri: legacy.uri, reason: 'identity transition contains an invalid predecessor or successor AT URI' });
        continue;
      }
      if (!isValidDid(fromDid) || !isValidDid(toDid)) {
        warnings.push({ uri: legacy.uri, reason: 'identity transition contains an invalid predecessor or successor DID' });
        continue;
      }
      const fromProfile = profileMap.get(fromUri);
      const toProfile = profileMap.get(toUri);
      output.push(makeRecord({
        rootDid, repoRev, sequence: sequence++, observedAt: legacy.indexedAt, rkey: recordKey('transition', legacy.uri),
        record: {
          $type: 'us.dsaslate.temp.identityTransition',
          entity: entity.uri,
          fromDid,
          toDid,
          ...(fromProfile ? { fromProfile } : {}),
          ...(toProfile ? { toProfile } : {}),
          reason: `Migrated ${value.status} identity-continuity marker ${value.stableId}`,
          effectiveAt: legacy.indexedAt,
        },
        bootstrap: bootstrap(legacy, importedAt),
      }));
      continue;
    }
    if (legacy.collection === 'org.dsa.relationship.governance') {
      const value = legacy.record as { subjectUri: string; relationship: string; objectUri: string; description?: string; sourceUrl?: string; createdAt: string };
      const subject = entityMap.get(value.subjectUri);
      const object = entityMap.get(value.objectUri);
      if (!subject || !object) {
        warnings.push({ uri: legacy.uri, reason: 'relationship references an entity not present in the migration input' });
        continue;
      }
      output.push(makeRecord({
        rootDid, repoRev, sequence: sequence++, observedAt: legacy.indexedAt, rkey: recordKey('relationship', legacy.uri),
        record: { $type: 'us.dsaslate.temp.orgRelationship', subject: subject.uri, relationship: value.relationship, object: object.uri, ...(value.description ? { description: value.description } : {}), ...(value.sourceUrl ? { evidenceUris: [value.sourceUrl] } : {}), createdAt: value.createdAt },
        bootstrap: bootstrap(legacy, importedAt),
      }));
      continue;
    }
    if (legacy.collection === 'org.dsa.verification.assertion' || legacy.collection === 'org.dsa.authority.charter' || legacy.collection === 'org.dsa.authority.mandate') {
      const value = legacy.record as { subjectUri?: string; reason?: string; effectiveFrom?: string; createdAt?: string };
      const subject = value.subjectUri ? entityMap.get(value.subjectUri) : undefined;
      if (!subject) {
        warnings.push({ uri: legacy.uri, reason: 'authority claim references an entity not present in the migration input' });
        continue;
      }
      output.push(makeRecord({
        rootDid, repoRev, sequence: sequence++, observedAt: legacy.indexedAt, rkey: recordKey('attestation', legacy.uri),
        record: { $type: 'us.dsaslate.temp.authorityAttestation', subject, claim: legacy.collection === 'org.dsa.verification.assertion' ? 'verifiesProfile' : 'recognizesEntity', ...(value.reason ? { reason: value.reason } : {}), issuedAt: value.createdAt ?? value.effectiveFrom ?? legacy.indexedAt },
        bootstrap: bootstrap(legacy, importedAt),
      }));
      continue;
    }
    if (legacy.collection === 'org.dsa.authority.dispute' || legacy.collection === 'org.dsa.authority.revocation' || legacy.collection === 'org.dsa.record.archive') {
      const value = legacy.record as { subjectUri?: string; reason?: string; summary?: string; createdAt?: string };
      const target = value.subjectUri ? entityMap.get(value.subjectUri) : undefined;
      if (!target) {
        warnings.push({ uri: legacy.uri, reason: 'authority action references an entity not present in the migration input' });
        continue;
      }
      const action = legacy.collection === 'org.dsa.authority.dispute' ? 'dispute' : legacy.collection === 'org.dsa.authority.revocation' ? 'revoke' : 'archive';
      output.push(makeRecord({
        rootDid, repoRev, sequence: sequence++, observedAt: legacy.indexedAt, rkey: recordKey('action', legacy.uri),
        record: { $type: 'us.dsaslate.temp.authorityAction', target, action, reason: value.reason ?? value.summary ?? 'Migrated prototype authority action', effectiveAt: value.createdAt ?? legacy.indexedAt },
        bootstrap: bootstrap(legacy, importedAt),
      }));
      continue;
    }
    if (legacy.collection === 'org.dsa.authority.delegation') {
      const value = legacy.record as { delegatedToUri?: string; subjectUri?: string; effectiveFrom?: string; effectiveUntil?: string };
      let delegateDid: string | undefined;
      if (value.delegatedToUri) {
        try { delegateDid = new AtUri(value.delegatedToUri).host; } catch { delegateDid = undefined; }
      }
      const entity = value.subjectUri ? entityMap.get(value.subjectUri) : undefined;
      if (!delegateDid || !isRepositoryDid(delegateDid) || !entity) {
        warnings.push({ uri: legacy.uri, reason: 'delegation lacks a valid delegate DID or migrated entity scope' });
        continue;
      }
      output.push(makeRecord({
        rootDid, repoRev, sequence: sequence++, observedAt: legacy.indexedAt, rkey: recordKey('delegation', legacy.uri),
        record: { $type: 'us.dsaslate.temp.authorityDelegation', delegateDid, entityUris: [entity.uri], collections: ['us.dsaslate.temp.orgProfile', 'us.dsaslate.temp.publicEvent'], actions: ['create', 'update', 'delete'], effectiveFrom: value.effectiveFrom ?? legacy.indexedAt, ...(value.effectiveUntil ? { effectiveUntil: value.effectiveUntil } : {}), createdAt: legacy.indexedAt },
        bootstrap: bootstrap(legacy, importedAt),
      }));
      continue;
    }
    if (legacy.collection === 'org.dsa.event.public') {
      const value = legacy.record as { hostEntityUri: string; title: string; startsAt: string; endsAt?: string; mode: string; publicUrl?: string; locationLabel?: string; status: string; topics?: string[] };
      const host = entityMap.get(value.hostEntityUri);
      if (!host) {
        warnings.push({ uri: legacy.uri, reason: 'public event references an entity not present in the migration input' });
        continue;
      }
      output.push(makeRecord({
        rootDid, repoRev, sequence: sequence++, observedAt: legacy.indexedAt, rkey: recordKey('event', legacy.uri),
        record: { $type: 'us.dsaslate.temp.publicEvent', hostEntity: host.uri, title: value.title, startsAt: value.startsAt, ...(value.endsAt ? { endsAt: value.endsAt } : {}), mode: value.mode === 'in-person' ? 'inPerson' : value.mode, ...(value.publicUrl ? { publicUrl: value.publicUrl } : {}), ...(value.locationLabel ? { locationLabel: value.locationLabel } : {}), status: value.status, topics: value.topics ?? [], createdAt: legacy.indexedAt },
        bootstrap: bootstrap(legacy, importedAt),
      }));
      continue;
    }
    dropped.push({ uri: legacy.uri, collection: legacy.collection, reason: 'legacy family is deferred until its temporary Lexicon is implemented' });
  }

  return { records: output, dropped, warnings, entityMap, policy };
}
