import { z } from 'zod';

export const trustLabelSchema = z.enum(['mock-official', 'self-declared', 'unverified', 'experimental']);
export const verificationAssertionSchema = z.object({
  $type: z.literal('org.dsa.verification.assertion'),
  subjectUri: z.string().startsWith('at://'),
  subjectDid: z.string().startsWith('did:'),
  issuerDid: z.string().startsWith('did:'),
  issuerHandle: z.string().min(1),
  assertion: z.enum(['verified', 'disputed', 'revoked', 'self-declared']),
  reason: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const chapterRecordSchema = z.object({
  $type: z.literal('org.dsa.profile.chapter'),
  name: z.string().min(1),
  shortName: z.string().min(1),
  jurisdiction: z.object({
    type: z.string().min(1),
    name: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
  }),
  website: z.string().url(),
  status: z.enum(['active', 'inactive']),
});

export const caucusRecordSchema = z.object({
  $type: z.literal('org.dsa.profile.caucus'),
  name: z.string().min(1),
  shortName: z.string().min(1),
  focusArea: z.string().min(1),
  website: z.string().url(),
  status: z.enum(['active', 'inactive']),
});

export const memberAffiliationRecordSchema = z.object({
  $type: z.literal('org.dsa.affiliation.member'),
  displayName: z.string().min(1),
  memberDid: z.string().startsWith('did:'),
  memberHandle: z.string().min(1),
  organizationDid: z.string().startsWith('did:'),
  organizationHandle: z.string().min(1),
  relationship: z.literal('self-declared-member'),
  trustTag: z.enum(['self-declared', 'unverified', 'experimental']),
  visibility: z.literal('public'),
  publicRole: z.string().min(1).optional(),
  interests: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime(),
});

export const recordEnvelopeSchema = z.object({
  uri: z.string().startsWith('at://'),
  cid: z.string().min(1),
  did: z.string().startsWith('did:'),
  handle: z.string().min(1),
  collection: z.union([z.literal('org.dsa.profile.chapter'), z.literal('org.dsa.profile.caucus'), z.literal('org.dsa.affiliation.member'), z.literal('org.dsa.verification.assertion')]),
  indexedAt: z.string().datetime(),
  trustLabel: trustLabelSchema,
  record: z.union([chapterRecordSchema, caucusRecordSchema, memberAffiliationRecordSchema, verificationAssertionSchema]),
}).superRefine((value, ctx) => {
  if (value.collection !== value.record.$type) {
    ctx.addIssue({ code: 'custom', message: 'collection must match record $type', path: ['collection'] });
  }
});

export type RecordEnvelope = z.infer<typeof recordEnvelopeSchema>;
export type ChapterRecord = z.infer<typeof chapterRecordSchema>;
export type CaucusRecord = z.infer<typeof caucusRecordSchema>;
export type MemberAffiliationRecord = z.infer<typeof memberAffiliationRecordSchema>;
export type VerificationAssertionRecord = z.infer<typeof verificationAssertionSchema>;

export type VerificationStatus = 'mock-verified' | 'self-declared' | 'unverified' | 'disputed' | 'revoked' | 'experimental';

export type DirectoryEntity = {
  id: string;
  recordUri: string;
  type: 'chapter' | 'caucus' | 'member-affiliation';
  name: string;
  shortName: string;
  collection: 'org.dsa.profile.chapter' | 'org.dsa.profile.caucus' | 'org.dsa.affiliation.member';
  handle: string;
  did: string;
  jurisdiction: string;
  jurisdictionState?: string;
  jurisdictionType?: string;
  focusArea?: string;
  publicRole?: string;
  memberHandle?: string;
  organizationHandle?: string;
  trustLabel: z.infer<typeof trustLabelSchema>;
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verificationReason?: string;
  status: 'active' | 'inactive';
  website: string;
  searchText: string;
  record: RecordEnvelope;
};

export type DirectoryEntityFilters = {
  type?: DirectoryEntity['type'] | 'all';
  search?: string;
  state?: string;
  jurisdictionType?: string;
  limit?: number;
};

export const chapterSeedRecords: RecordEnvelope[] = [
  {
    uri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
    cid: 'bafy-mock-nyc',
    did: 'did:plc:nycdsa',
    handle: 'nyc.dsausa.org',
    collection: 'org.dsa.profile.chapter',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'mock-official',
    record: {
      $type: 'org.dsa.profile.chapter',
      name: 'New York City DSA',
      shortName: 'NYC-DSA',
      jurisdiction: { type: 'city', name: 'New York City', state: 'NY', country: 'US' },
      website: 'https://socialists.nyc/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:midsa/org.dsa.profile.chapter/self',
    cid: 'bafy-mock-michigan',
    did: 'did:plc:midsa',
    handle: 'michigan.socialists.org',
    collection: 'org.dsa.profile.chapter',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'self-declared',
    record: {
      $type: 'org.dsa.profile.chapter',
      name: 'Michigan DSA',
      shortName: 'MI-DSA',
      jurisdiction: { type: 'state', name: 'Michigan', state: 'MI', country: 'US' },
      website: 'https://michigandsa.org/',
      status: 'active',
    },
  },
];

export const caucusSeedRecords: RecordEnvelope[] = [
  {
    uri: 'at://did:plc:climatecaucus/org.dsa.profile.caucus/self',
    cid: 'bafy-mock-climate-caucus',
    did: 'did:plc:climatecaucus',
    handle: 'climate.dsausa.org',
    collection: 'org.dsa.profile.caucus',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'experimental',
    record: {
      $type: 'org.dsa.profile.caucus',
      name: 'DSA Climate Caucus',
      shortName: 'Climate Caucus',
      focusArea: 'climate justice organizing',
      website: 'https://dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:rankandfile/org.dsa.profile.caucus/self',
    cid: 'bafy-mock-rank-file',
    did: 'did:plc:rankandfile',
    handle: 'rankandfile.dsausa.org',
    collection: 'org.dsa.profile.caucus',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'self-declared',
    record: {
      $type: 'org.dsa.profile.caucus',
      name: 'Rank and File Working Group',
      shortName: 'R&F WG',
      focusArea: 'workplace organizing support',
      website: 'https://dsausa.org/',
      status: 'active',
    },
  },
];

export const memberAffiliationSeedRecords: RecordEnvelope[] = [
  {
    uri: 'at://did:plc:memberalpha/org.dsa.affiliation.member/self',
    cid: 'bafy-mock-member-alpha',
    did: 'did:plc:memberalpha',
    handle: 'member.alpha.example',
    collection: 'org.dsa.affiliation.member',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'self-declared',
    record: {
      $type: 'org.dsa.affiliation.member',
      displayName: 'Alex Rivera',
      memberDid: 'did:plc:memberalpha',
      memberHandle: 'member.alpha.example',
      organizationDid: 'did:plc:nycdsa',
      organizationHandle: 'nyc.dsausa.org',
      relationship: 'self-declared-member',
      trustTag: 'self-declared',
      visibility: 'public',
      publicRole: 'neighborhood canvass volunteer',
      interests: ['housing', 'mutual aid'],
      createdAt: '2026-07-01T00:00:00.000Z',
    },
  },
  {
    uri: 'at://did:plc:memberbeta/org.dsa.affiliation.member/self',
    cid: 'bafy-mock-member-beta',
    did: 'did:plc:memberbeta',
    handle: 'member.beta.example',
    collection: 'org.dsa.affiliation.member',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'unverified',
    record: {
      $type: 'org.dsa.affiliation.member',
      displayName: 'Jordan Kim',
      memberDid: 'did:plc:memberbeta',
      memberHandle: 'member.beta.example',
      organizationDid: 'did:plc:midsa',
      organizationHandle: 'michigan.socialists.org',
      relationship: 'self-declared-member',
      trustTag: 'unverified',
      visibility: 'public',
      publicRole: 'policy study circle participant',
      interests: ['labor', 'transit'],
      createdAt: '2026-07-01T00:00:00.000Z',
    },
  },
  {
    uri: 'at://did:plc:membergamma/org.dsa.affiliation.member/self',
    cid: 'bafy-mock-member-gamma',
    did: 'did:plc:membergamma',
    handle: 'member.gamma.example',
    collection: 'org.dsa.affiliation.member',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'experimental',
    record: {
      $type: 'org.dsa.affiliation.member',
      displayName: 'Sam Taylor',
      memberDid: 'did:plc:membergamma',
      memberHandle: 'member.gamma.example',
      organizationDid: 'did:plc:climatecaucus',
      organizationHandle: 'climate.dsausa.org',
      relationship: 'self-declared-member',
      trustTag: 'experimental',
      visibility: 'public',
      publicRole: 'working-group observer',
      interests: ['climate justice', 'education'],
      createdAt: '2026-07-01T00:00:00.000Z',
    },
  },
];

export const verificationAssertionSeedRecords: RecordEnvelope[] = [
  {
    uri: 'at://did:plc:nycdsa/org.dsa.verification.assertion/self',
    cid: 'bafy-mock-verification-nyc',
    did: 'did:plc:nationaldsa',
    handle: 'dsausa.org',
    collection: 'org.dsa.verification.assertion',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'mock-official',
    record: {
      $type: 'org.dsa.verification.assertion',
      subjectUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
      subjectDid: 'did:plc:nycdsa',
      issuerDid: 'did:plc:nationaldsa',
      issuerHandle: 'dsausa.org',
      assertion: 'verified',
      reason: 'Prototype national verification assertion for the NYC chapter example.',
      createdAt: '2026-07-01T00:00:00.000Z',
    },
  },
  {
    uri: 'at://did:plc:climatecaucus/org.dsa.verification.assertion/self',
    cid: 'bafy-mock-verification-climate-dispute',
    did: 'did:plc:nycdsa',
    handle: 'nyc.dsausa.org',
    collection: 'org.dsa.verification.assertion',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'experimental',
    record: {
      $type: 'org.dsa.verification.assertion',
      subjectUri: 'at://did:plc:climatecaucus/org.dsa.profile.caucus/self',
      subjectDid: 'did:plc:climatecaucus',
      issuerDid: 'did:plc:nycdsa',
      issuerHandle: 'nyc.dsausa.org',
      assertion: 'disputed',
      reason: 'Experimental caucus status is shown as disputed for prototype trust-state coverage.',
      createdAt: '2026-07-01T00:00:00.000Z',
    },
  },
];

export const allSeedRecords: RecordEnvelope[] = [...chapterSeedRecords, ...caucusSeedRecords, ...memberAffiliationSeedRecords, ...verificationAssertionSeedRecords];

export type DirectoryRecordEnvelope = Exclude<RecordEnvelope, { collection: 'org.dsa.verification.assertion' }>;

export function isDirectoryEntityRecord(record: RecordEnvelope): record is DirectoryRecordEnvelope {
  return record.collection !== 'org.dsa.verification.assertion';
}

export function computeVerificationMetadata(records: RecordEnvelope[], subjectUri: string, currentTrustLabel: z.infer<typeof trustLabelSchema>): Pick<DirectoryEntity, 'verificationStatus' | 'verifiedBy' | 'verificationReason' | 'trustLabel'> {
  const assertions = records.filter((record): record is RecordEnvelope & { record: VerificationAssertionRecord } => {
    const parsed = verificationAssertionSchema.safeParse(record.record);
    return record.collection === 'org.dsa.verification.assertion' && parsed.success && parsed.data.subjectUri === subjectUri;
  });
  const latest = assertions.at(-1);
  if (!latest) {
    return { trustLabel: currentTrustLabel, verificationStatus: currentTrustLabel === 'experimental' ? 'experimental' : currentTrustLabel === 'mock-official' ? 'mock-verified' : currentTrustLabel };
  }
  const statusMap: Record<VerificationAssertionRecord['assertion'], VerificationStatus> = {
    verified: 'mock-verified',
    disputed: 'disputed',
    revoked: 'revoked',
    'self-declared': 'self-declared',
  };
  return {
    trustLabel: currentTrustLabel,
    verificationStatus: statusMap[latest.record.assertion],
    verifiedBy: latest.record.issuerHandle,
    verificationReason: latest.record.reason,
  };
}

export function normalizeDirectoryEntity(record: RecordEnvelope, allRecords: RecordEnvelope[] = [record]): DirectoryEntity | undefined {
  const normalized = recordEnvelopeSchema.parse(record);
  if (!isDirectoryEntityRecord(normalized)) return undefined;
  const recordData = normalized.record as ChapterRecord | CaucusRecord | MemberAffiliationRecord;
  if (recordData.$type === 'org.dsa.profile.chapter') {
    const verification = computeVerificationMetadata(allRecords, normalized.uri, normalized.trustLabel);
    const jurisdiction = `${recordData.jurisdiction.name}, ${recordData.jurisdiction.state}`;
    return {
      id: normalized.uri,
      recordUri: normalized.uri,
      type: 'chapter',
      name: recordData.name,
      shortName: recordData.shortName,
      collection: normalized.collection as DirectoryEntity['collection'],
      handle: normalized.handle,
      did: normalized.did,
      jurisdiction,
      jurisdictionState: recordData.jurisdiction.state,
      jurisdictionType: recordData.jurisdiction.type,
      trustLabel: verification.trustLabel,
      verificationStatus: verification.verificationStatus,
      verifiedBy: verification.verifiedBy,
      verificationReason: verification.verificationReason,
      status: recordData.status,
      website: recordData.website,
      searchText: [recordData.name, recordData.shortName, normalized.handle, normalized.did, jurisdiction].join(' ').toLowerCase(),
      record: normalized,
    };
  }
  if (recordData.$type === 'org.dsa.affiliation.member') {
    const verification = computeVerificationMetadata(allRecords, normalized.uri, normalized.trustLabel);
    const jurisdiction = `affiliated with ${recordData.organizationHandle}`;
    return {
      id: normalized.uri,
      recordUri: normalized.uri,
      type: 'member-affiliation',
      name: recordData.displayName,
      shortName: recordData.publicRole ?? recordData.trustTag,
      collection: normalized.collection as DirectoryEntity['collection'],
      handle: normalized.handle,
      did: normalized.did,
      jurisdiction,
      jurisdictionState: undefined,
      jurisdictionType: undefined,
      publicRole: recordData.publicRole,
      memberHandle: recordData.memberHandle,
      organizationHandle: recordData.organizationHandle,
      trustLabel: verification.trustLabel,
      verificationStatus: verification.verificationStatus,
      verifiedBy: verification.verifiedBy,
      verificationReason: verification.verificationReason,
      status: 'active',
      website: 'https://example.org/public-prototype',
      searchText: [recordData.displayName, recordData.memberHandle, normalized.handle, normalized.did, jurisdiction, recordData.organizationHandle].join(' ').toLowerCase(),
      record: normalized,
    };
  }
  const verification = computeVerificationMetadata(allRecords, normalized.uri, normalized.trustLabel);
  const caucusRecord = recordData as CaucusRecord;
  const jurisdiction = caucusRecord.focusArea;
  return {
    id: normalized.uri,
    recordUri: normalized.uri,
    type: 'caucus',
    name: caucusRecord.name,
    shortName: caucusRecord.shortName,
    collection: normalized.collection as DirectoryEntity['collection'],
    handle: normalized.handle,
    did: normalized.did,
    jurisdiction,
    jurisdictionState: undefined,
    jurisdictionType: undefined,
    focusArea: caucusRecord.focusArea,
    trustLabel: verification.trustLabel,
    verificationStatus: verification.verificationStatus,
    verifiedBy: verification.verifiedBy,
    verificationReason: verification.verificationReason,
    status: caucusRecord.status,
    website: caucusRecord.website,
    searchText: [caucusRecord.name, caucusRecord.shortName, normalized.handle, normalized.did, jurisdiction].join(' ').toLowerCase(),
    record: normalized,
  };
}

export function matchesDirectoryEntity(entity: DirectoryEntity, filters: DirectoryEntityFilters = {}) {
  const normalizedSearch = filters.search?.trim().toLowerCase() ?? '';
  const typeFilter = filters.type ?? 'all';
  const stateFilter = filters.state?.trim().toUpperCase() ?? '';
  const jurisdictionTypeFilter = filters.jurisdictionType?.trim().toLowerCase() ?? '';
  if (typeFilter !== 'all' && entity.type !== typeFilter) return false;
  if (stateFilter && entity.jurisdictionState?.toUpperCase() !== stateFilter) return false;
  if (jurisdictionTypeFilter && entity.jurisdictionType?.toLowerCase() !== jurisdictionTypeFilter) return false;
  if (!normalizedSearch) return true;
  return entity.searchText.includes(normalizedSearch);
}
