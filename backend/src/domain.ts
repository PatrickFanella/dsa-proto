import { z } from 'zod';

export const trustLabelSchema = z.enum(['mock-official', 'self-declared', 'unverified', 'experimental']);

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

export const mockRecordEnvelopeSchema = z.object({
  uri: z.string().startsWith('at://'),
  cid: z.string().min(1),
  did: z.string().startsWith('did:'),
  handle: z.string().min(1),
  collection: z.union([z.literal('org.dsa.profile.chapter'), z.literal('org.dsa.profile.caucus'), z.literal('org.dsa.affiliation.member')]),
  indexedAt: z.string().datetime(),
  trustLabel: trustLabelSchema,
  record: z.union([chapterRecordSchema, caucusRecordSchema, memberAffiliationRecordSchema]),
}).superRefine((value, ctx) => {
  if (value.collection !== value.record.$type) {
    ctx.addIssue({ code: 'custom', message: 'collection must match record $type', path: ['collection'] });
  }
});

export type MockRecordEnvelope = z.infer<typeof mockRecordEnvelopeSchema>;
export type ChapterRecord = z.infer<typeof chapterRecordSchema>;
export type CaucusRecord = z.infer<typeof caucusRecordSchema>;
export type MemberAffiliationRecord = z.infer<typeof memberAffiliationRecordSchema>;

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
  focusArea?: string;
  publicRole?: string;
  memberHandle?: string;
  organizationHandle?: string;
  trustLabel: z.infer<typeof trustLabelSchema>;
  status: 'active' | 'inactive';
  website: string;
  searchText: string;
  record: MockRecordEnvelope;
};

export type DirectoryEntityFilters = {
  type?: DirectoryEntity['type'] | 'all';
  search?: string;
};

export const chapterSeedRecords: MockRecordEnvelope[] = [
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

export const caucusSeedRecords: MockRecordEnvelope[] = [
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

export const memberAffiliationSeedRecords: MockRecordEnvelope[] = [
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

export function normalizeDirectoryEntity(record: MockRecordEnvelope): DirectoryEntity {
  const normalized = mockRecordEnvelopeSchema.parse(record);
  const recordData = normalized.record;
  if (recordData.$type === 'org.dsa.profile.chapter') {
    const jurisdiction = `${recordData.jurisdiction.name}, ${recordData.jurisdiction.state}`;
    return {
      id: normalized.uri,
      recordUri: normalized.uri,
      type: 'chapter',
      name: recordData.name,
      shortName: recordData.shortName,
      collection: normalized.collection,
      handle: normalized.handle,
      did: normalized.did,
      jurisdiction,
      trustLabel: normalized.trustLabel,
      status: recordData.status,
      website: recordData.website,
      searchText: [recordData.name, recordData.shortName, normalized.handle, normalized.did, jurisdiction].join(' ').toLowerCase(),
      record: normalized,
    };
  }
  if (recordData.$type === 'org.dsa.affiliation.member') {
    const jurisdiction = `affiliated with ${recordData.organizationHandle}`;
    return {
      id: normalized.uri,
      recordUri: normalized.uri,
      type: 'member-affiliation',
      name: recordData.displayName,
      shortName: recordData.publicRole ?? recordData.trustTag,
      collection: normalized.collection,
      handle: normalized.handle,
      did: normalized.did,
      jurisdiction,
      publicRole: recordData.publicRole,
      memberHandle: recordData.memberHandle,
      organizationHandle: recordData.organizationHandle,
      trustLabel: normalized.trustLabel,
      status: 'active',
      website: 'https://example.org/public-prototype',
      searchText: [recordData.displayName, recordData.memberHandle, normalized.handle, normalized.did, jurisdiction, recordData.organizationHandle].join(' ').toLowerCase(),
      record: normalized,
    };
  }
  const jurisdiction = recordData.focusArea;
  return {
    id: normalized.uri,
    recordUri: normalized.uri,
    type: 'caucus',
    name: recordData.name,
    shortName: recordData.shortName,
    collection: normalized.collection,
    handle: normalized.handle,
    did: normalized.did,
    jurisdiction,
    focusArea: recordData.focusArea,
    trustLabel: normalized.trustLabel,
    status: recordData.status,
    website: recordData.website,
    searchText: [recordData.name, recordData.shortName, normalized.handle, normalized.did, jurisdiction].join(' ').toLowerCase(),
    record: normalized,
  };
}

export function matchesDirectoryEntity(entity: DirectoryEntity, filters: DirectoryEntityFilters = {}) {
  const normalizedSearch = filters.search?.trim().toLowerCase() ?? '';
  const typeFilter = filters.type ?? 'all';
  if (typeFilter !== 'all' && entity.type !== typeFilter) return false;
  if (!normalizedSearch) return true;
  return entity.searchText.includes(normalizedSearch);
}
