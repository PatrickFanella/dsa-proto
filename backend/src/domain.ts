import { z } from 'zod';

export const trustLabelSchema = z.enum([
  'official',
  'verified-by-national',
  'verified-by-chapter',
  'verified-by-caucus',
  'self-declared',
  'community-submitted',
  'secondary-source',
  'uncertain',
]);
export const lifecycleStatusSchema = z.enum(['active', 'inactive', 'superseded', 'deprecated', 'revoked', 'disputed', 'archived', 'tombstoned']);
export const recordWorkflowStatusSchema = z.enum(['draft', 'published', 'withdrawn', 'cancelled', 'resolved']);

export function mapWorkflowStatusToLifecycle(status: z.infer<typeof recordWorkflowStatusSchema>): z.infer<typeof lifecycleStatusSchema> | undefined {
  const mapping: Partial<Record<z.infer<typeof recordWorkflowStatusSchema>, z.infer<typeof lifecycleStatusSchema>>> = {
    published: 'active',
    draft: 'inactive',
    withdrawn: 'inactive',
    cancelled: 'archived',
    resolved: 'inactive',
  };
  return mapping[status];
}
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

export const publicStatementRecordSchema = z.object({
  $type: z.literal('org.dsa.statement.public'),
  title: z.string().min(1),
  summary: z.string().min(1),
  bodyMarkdown: z.string().min(1),
  issuerUri: z.string().startsWith('at://'),
  issuerName: z.string().min(1),
  publishedAt: z.string().datetime(),
  topics: z.array(z.string().min(1)),
  relatedEntityUris: z.array(z.string().startsWith('at://')),
  status: z.enum(['published', 'archived', 'draft']),
});

export const publicationProfileRecordSchema = z.object({
  $type: z.literal('org.dsa.publication.profile'),
  name: z.string().min(1),
  shortName: z.string().min(1),
  publisherUri: z.string().startsWith('at://'),
  publisherName: z.string().min(1),
  website: z.string().url().optional(),
  status: z.enum(['active', 'inactive']),
});

export const publicationArticleRecordSchema = z.object({
  $type: z.literal('org.dsa.publication.article'),
  publicationUri: z.string().startsWith('at://'),
  publicationName: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  bodyMarkdown: z.string().min(1),
  authorName: z.string().min(1).optional(),
  publishedAt: z.string().datetime(),
  topics: z.array(z.string().min(1)),
  relatedEntityUris: z.array(z.string().startsWith('at://')),
  status: z.enum(['published', 'archived', 'draft']),
});

export const endorsementPublicRecordSchema = z.object({
  $type: z.literal('org.dsa.endorsement.public'),
  endorsingEntityUri: z.string().startsWith('at://'),
  endorsingEntityName: z.string().min(1),
  candidateOrMeasureName: z.string().min(1),
  officeOrMeasure: z.string().min(1),
  jurisdiction: z.string().min(1),
  electionDate: z.string().date(),
  status: z.enum(['active', 'withdrawn', 'archived']),
  statementUri: z.string().startsWith('at://').optional(),
  sourceUrl: z.string().url().optional(),
  topics: z.array(z.string().min(1)),
  relatedEntityUris: z.array(z.string().startsWith('at://')),
});

export const publicEventRecordSchema = z.object({
  $type: z.literal('org.dsa.event.public'),
  title: z.string().min(1),
  hostEntityUri: z.string().startsWith('at://'),
  hostEntityName: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  mode: z.enum(['online', 'in-person', 'hybrid']),
  publicUrl: z.string().url().optional(),
  locationLabel: z.string().min(1).optional(),
  status: z.enum(['scheduled', 'cancelled', 'archived']),
  topics: z.array(z.string().min(1)),
  relatedEntityUris: z.array(z.string().startsWith('at://')),
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

export const orgUnitRecordSchema = z.object({
  $type: z.literal('org.dsa.profile.orgUnit'),
  name: z.string().min(1),
  shortName: z.string().min(1),
  kind: z.enum(['national-committee', 'steering-committee', 'staff', 'staff-role', 'publication', 'priority-committee', 'working-group', 'commission', 'chapter-network', 'membership-body', 'delegate-body', 'youth-committee']),
  description: z.string().min(1),
  website: z.string().url().optional(),
  status: z.enum(['active', 'inactive']),
});

export const governanceRelationshipRecordSchema = z.object({
  $type: z.literal('org.dsa.relationship.governance'),
  subjectUri: z.string().startsWith('at://'),
  relationship: z.enum(['elects', 'sits-on', 'appoints', 'creates-priorities-for', 'approves-charter-for', 'hires-and-directs', 'hires-with-approval', 'supports', 'can-join', 'can-volunteer', 'can-submit']),
  objectUri: z.string().startsWith('at://'),
  description: z.string().min(1),
  sourceUrl: z.string().url(),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string().datetime(),
});

export const memberAffiliationRecordSchema = z.object({
  $type: z.literal('org.dsa.affiliation.member'),
  displayName: z.string().min(1),
  memberDid: z.string().startsWith('did:'),
  memberHandle: z.string().min(1),
  organizationDid: z.string().startsWith('did:'),
  organizationHandle: z.string().min(1),
  relationship: z.literal('self-declared-member'),
  trustTag: z.enum(['self-declared', 'community-submitted', 'uncertain']),
  visibility: z.literal('public'),
  publicRole: z.string().min(1).optional(),
  interests: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime(),
});

export const authorityDelegationRecordSchema = z.object({
  $type: z.literal('org.dsa.authority.delegation'),
  subjectUri: z.string().startsWith('at://'),
  delegatedToUri: z.string().startsWith('at://'),
  scope: z.string().min(1),
  authority: z.string().min(1),
  effectiveFrom: z.string().datetime(),
  effectiveUntil: z.string().datetime().optional(),
  status: lifecycleStatusSchema,
});

export const authorityMandateRecordSchema = z.object({
  $type: z.literal('org.dsa.authority.mandate'),
  subjectUri: z.string().startsWith('at://'),
  roleName: z.string().min(1),
  mandate: z.string().min(1),
  effectiveFrom: z.string().datetime(),
  effectiveUntil: z.string().datetime().optional(),
  status: lifecycleStatusSchema,
});

export const authorityCharterRecordSchema = z.object({
  $type: z.literal('org.dsa.authority.charter'),
  subjectUri: z.string().startsWith('at://'),
  charteredByUri: z.string().startsWith('at://'),
  jurisdiction: z.string().min(1),
  effectiveFrom: z.string().datetime(),
  effectiveUntil: z.string().datetime().optional(),
  status: lifecycleStatusSchema,
});

export const authorityRevocationRecordSchema = z.object({
  $type: z.literal('org.dsa.authority.revocation'),
  subjectUri: z.string().startsWith('at://'),
  revokedByUri: z.string().startsWith('at://'),
  reason: z.string().min(1),
  createdAt: z.string().datetime(),
  status: z.enum(['active', 'archived']),
});

export const authorityDisputeRecordSchema = z.object({
  $type: z.literal('org.dsa.authority.dispute'),
  subjectUri: z.string().startsWith('at://'),
  raisedByUri: z.string().startsWith('at://'),
  summary: z.string().min(1),
  createdAt: z.string().datetime(),
  status: z.enum(['active', 'resolved', 'archived']),
});

export const recordArchiveRecordSchema = z.object({
  $type: z.literal('org.dsa.record.archive'),
  subjectUri: z.string().startsWith('at://'),
  archivedByUri: z.string().startsWith('at://'),
  reason: z.string().min(1),
  createdAt: z.string().datetime(),
  status: z.enum(['active', 'archived']),
});

export const recordEnvelopeSchema = z.object({
  uri: z.string().startsWith('at://'),
  cid: z.string().min(1),
  did: z.string().startsWith('did:'),
  handle: z.string().min(1),
  collection: z.union([z.literal('org.dsa.profile.chapter'), z.literal('org.dsa.profile.caucus'), z.literal('org.dsa.profile.orgUnit'), z.literal('org.dsa.relationship.governance'), z.literal('org.dsa.affiliation.member'), z.literal('org.dsa.verification.assertion'), z.literal('org.dsa.statement.public'), z.literal('org.dsa.publication.profile'), z.literal('org.dsa.publication.article'), z.literal('org.dsa.endorsement.public'), z.literal('org.dsa.event.public'), z.literal('org.dsa.authority.delegation'), z.literal('org.dsa.authority.mandate'), z.literal('org.dsa.authority.charter'), z.literal('org.dsa.authority.revocation'), z.literal('org.dsa.authority.dispute'), z.literal('org.dsa.record.archive')]),
  indexedAt: z.string().datetime(),
  trustLabel: trustLabelSchema,
  record: z.union([chapterRecordSchema, caucusRecordSchema, orgUnitRecordSchema, governanceRelationshipRecordSchema, memberAffiliationRecordSchema, verificationAssertionSchema, publicStatementRecordSchema, publicationProfileRecordSchema, publicationArticleRecordSchema, endorsementPublicRecordSchema, publicEventRecordSchema, authorityDelegationRecordSchema, authorityMandateRecordSchema, authorityCharterRecordSchema, authorityRevocationRecordSchema, authorityDisputeRecordSchema, recordArchiveRecordSchema]),
}).superRefine((value, ctx) => {
  if (value.collection !== value.record.$type) {
    ctx.addIssue({ code: 'custom', message: 'collection must match record $type', path: ['collection'] });
  }
});

export type RecordEnvelope = z.infer<typeof recordEnvelopeSchema>;
export type AuthorityResolverStatus = 'valid' | 'disputed' | 'revoked' | 'expired' | 'unresolved';
export type ResolvedRecordAuthority = {
  uri: string;
  record?: RecordEnvelope;
  revisions: RecordEnvelope[];
  authorityRecords: RecordEnvelope[];
  status: AuthorityResolverStatus;
  caveats: string[];
};
export type ChapterRecord = z.infer<typeof chapterRecordSchema>;
export type CaucusRecord = z.infer<typeof caucusRecordSchema>;
export type OrgUnitRecord = z.infer<typeof orgUnitRecordSchema>;
export type GovernanceRelationshipRecord = z.infer<typeof governanceRelationshipRecordSchema>;
export type MemberAffiliationRecord = z.infer<typeof memberAffiliationRecordSchema>;
export type VerificationAssertionRecord = z.infer<typeof verificationAssertionSchema>;
export type PublicStatementRecord = z.infer<typeof publicStatementRecordSchema>;
export type PublicationProfileRecord = z.infer<typeof publicationProfileRecordSchema>;
export type PublicationArticleRecord = z.infer<typeof publicationArticleRecordSchema>;
export type EndorsementPublicRecord = z.infer<typeof endorsementPublicRecordSchema>;
export type PublicEventRecord = z.infer<typeof publicEventRecordSchema>;
export type AuthorityDelegationRecord = z.infer<typeof authorityDelegationRecordSchema>;
export type AuthorityMandateRecord = z.infer<typeof authorityMandateRecordSchema>;
export type AuthorityCharterRecord = z.infer<typeof authorityCharterRecordSchema>;
export type AuthorityRevocationRecord = z.infer<typeof authorityRevocationRecordSchema>;
export type AuthorityDisputeRecord = z.infer<typeof authorityDisputeRecordSchema>;
export type RecordArchiveRecord = z.infer<typeof recordArchiveRecordSchema>;

export type VerificationStatus = 'verified' | 'self-declared' | 'uncertain' | 'disputed' | 'revoked' | 'community-submitted';

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
    trustLabel: 'official',
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
    trustLabel: 'community-submitted',
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

export const orgChartSeedRecords: RecordEnvelope[] = [
  {
    uri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-npc',
    did: 'did:plc:npc',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'National Political Committee',
      shortName: 'NPC',
      kind: 'national-committee',
      description: 'National governing committee elected by chapter delegates at convention.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:npcsc/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-npc-sc',
    did: 'did:plc:npcsc',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'NPC Steering Committee',
      shortName: 'NPC SC',
      kind: 'steering-committee',
      description: 'Steering committee elected from and by the National Political Committee.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:ydsa-ncc/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-ydsa-ncc',
    did: 'did:plc:ydsa-ncc',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'YDSA National Coordinating Committee',
      shortName: 'YDSA NCC',
      kind: 'youth-committee',
      description: 'Youth-led national coordinating body with a public seat on NPC and NPC SC.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:nationaldsa/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-national-dsa',
    did: 'did:plc:nationaldsa',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'Democratic Socialists of America',
      shortName: 'DSA',
      kind: 'national-committee',
      description: 'National organization that members join through the public join flow.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:demleft/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-demleft',
    did: 'did:plc:demleft',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'Democratic Left',
      shortName: 'Dem Left',
      kind: 'publication',
      description: 'National publication that accepts pitches and submissions from members.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:socialistforum/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-sf',
    did: 'did:plc:socialistforum',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'Socialist Forum',
      shortName: 'Socialist Forum',
      kind: 'publication',
      description: 'National publication for public member contributions.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:prioritycommittees/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-priority-committees',
    did: 'did:plc:prioritycommittees',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'Priority Committees',
      shortName: 'Priority Committees',
      kind: 'priority-committee',
      description: 'National priority committees whose priorities and steering committees are created or appointed by the NPC.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:workinggroupscommissions/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-working-groups-commissions',
    did: 'did:plc:workinggroupscommissions',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'Working Groups and Commissions',
      shortName: 'WGs & Commissions',
      kind: 'working-group',
      description: 'Working groups and commissions chartered by the NPC for member volunteer participation.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:localchapters/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-local-chapters',
    did: 'did:plc:localchapters',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'Local Chapters',
      shortName: 'Local Chapters',
      kind: 'chapter-network',
      description: 'Local chapters chartered by the NPC where members elect local leaders.',
      website: 'https://www.dsausa.org/chapters/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:nationalstaff/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-national-staff',
    did: 'did:plc:nationalstaff',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'National Staff',
      shortName: 'National Staff',
      kind: 'staff',
      description: 'National staff support DSA bodies and membership according to the public chart.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:nationaldirector/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-national-director',
    did: 'did:plc:nationaldirector',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'National Director',
      shortName: 'National Director',
      kind: 'staff-role',
      description: 'Staff leadership role hired and directed by the NPC according to the public chart.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:chapterdelegates/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-chapter-delegates',
    did: 'did:plc:chapterdelegates',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'Chapter Delegates',
      shortName: 'Chapter Delegates',
      kind: 'delegate-body',
      description: 'Delegates elected by membership to convention who elect the NPC.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:membership/org.dsa.profile.orgUnit/self',
    cid: 'bafy-mock-orgunit-membership',
    did: 'did:plc:membership',
    handle: 'dsausa.org',
    collection: 'org.dsa.profile.orgUnit',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.profile.orgUnit',
      name: 'DSA Membership',
      shortName: 'Membership',
      kind: 'membership-body',
      description: 'Public membership body that can join DSA and participate in chapter life.',
      website: 'https://www.dsausa.org/',
      status: 'active',
    },
  },
];

export const governanceRelationshipSeedRecords: RecordEnvelope[] = [
  { uri: 'at://did:plc:chapterdelegates/org.dsa.relationship.governance/npc-elects', cid: 'bafy-mock-rel-elects', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:chapterdelegates/org.dsa.profile.orgUnit/self', relationship: 'elects', objectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', description: 'Chapter delegates elect the National Political Committee at convention.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:npc/org.dsa.relationship.governance/sc-elects', cid: 'bafy-mock-rel-npc-elects-sc', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', relationship: 'elects', objectUri: 'at://did:plc:npcsc/org.dsa.profile.orgUnit/self', description: 'NPC elects the NPC Steering Committee.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:npc/org.dsa.relationship.governance/ydsa-seat', cid: 'bafy-mock-rel-ydsa', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:ydsa-ncc/org.dsa.profile.orgUnit/self', relationship: 'sits-on', objectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', description: 'YDSA national co-chairs hold a public seat relationship with NPC and NPC SC.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:membership/org.dsa.relationship.governance/elects-local-leaders', cid: 'bafy-mock-rel-members-elect-local', did: 'did:plc:membership', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:membership/org.dsa.profile.orgUnit/self', relationship: 'elects', objectUri: 'at://did:plc:localchapters/org.dsa.profile.orgUnit/self', description: 'Members elect local chapter leaders.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:membership/org.dsa.relationship.governance/elects-chapter-delegates', cid: 'bafy-mock-rel-members-elect-delegates', did: 'did:plc:membership', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:membership/org.dsa.profile.orgUnit/self', relationship: 'elects', objectUri: 'at://did:plc:chapterdelegates/org.dsa.profile.orgUnit/self', description: 'Members elect chapter delegates to convention.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:membership/org.dsa.relationship.governance/membership-can-join', cid: 'bafy-mock-rel-can-join', did: 'did:plc:membership', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:membership/org.dsa.profile.orgUnit/self', relationship: 'can-join', objectUri: 'at://did:plc:nationaldsa/org.dsa.profile.orgUnit/self', description: 'People can join DSA through the membership body.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:membership/org.dsa.relationship.governance/publications-can-submit', cid: 'bafy-mock-rel-submit', did: 'did:plc:membership', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:membership/org.dsa.profile.orgUnit/self', relationship: 'can-submit', objectUri: 'at://did:plc:demleft/org.dsa.profile.orgUnit/self', description: 'Members can pitch and submit pieces to publications.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:membership/org.dsa.relationship.governance/can-volunteer-priority-committees', cid: 'bafy-mock-rel-volunteer-priority', did: 'did:plc:membership', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:membership/org.dsa.profile.orgUnit/self', relationship: 'can-volunteer', objectUri: 'at://did:plc:prioritycommittees/org.dsa.profile.orgUnit/self', description: 'Members can join or volunteer with priority committees.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:membership/org.dsa.relationship.governance/can-volunteer-working-groups', cid: 'bafy-mock-rel-volunteer-wg', did: 'did:plc:membership', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:membership/org.dsa.profile.orgUnit/self', relationship: 'can-volunteer', objectUri: 'at://did:plc:workinggroupscommissions/org.dsa.profile.orgUnit/self', description: 'Members can join or volunteer with working groups and commissions.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:npc/org.dsa.relationship.governance/appoints-publications', cid: 'bafy-mock-rel-appoints-publications', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', relationship: 'appoints', objectUri: 'at://did:plc:demleft/org.dsa.profile.orgUnit/self', description: 'NPC appoints the editorial board for publications.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:npc/org.dsa.relationship.governance/creates-priorities', cid: 'bafy-mock-rel-priorities', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', relationship: 'creates-priorities-for', objectUri: 'at://did:plc:prioritycommittees/org.dsa.profile.orgUnit/self', description: 'NPC creates priorities and appoints steering committees for priority committees.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:npc/org.dsa.relationship.governance/charters-working-groups', cid: 'bafy-mock-rel-charters-wg', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', relationship: 'approves-charter-for', objectUri: 'at://did:plc:workinggroupscommissions/org.dsa.profile.orgUnit/self', description: 'NPC approves charters for working groups and commissions.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:npc/org.dsa.relationship.governance/charters-local-chapters', cid: 'bafy-mock-rel-charters-chapters', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', relationship: 'approves-charter-for', objectUri: 'at://did:plc:localchapters/org.dsa.profile.orgUnit/self', description: 'NPC approves charters for local chapters.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:npc/org.dsa.relationship.governance/hires-national-director', cid: 'bafy-mock-rel-hires-director', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', relationship: 'hires-and-directs', objectUri: 'at://did:plc:nationaldirector/org.dsa.profile.orgUnit/self', description: 'NPC hires and directs the National Director.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:nationaldirector/org.dsa.relationship.governance/hires-staff', cid: 'bafy-mock-rel-director-hires-staff', did: 'did:plc:nationaldirector', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:nationaldirector/org.dsa.profile.orgUnit/self', relationship: 'hires-with-approval', objectUri: 'at://did:plc:nationalstaff/org.dsa.profile.orgUnit/self', description: 'National Director hires national staff with NPC approval.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:nationalstaff/org.dsa.relationship.governance/supports-membership', cid: 'bafy-mock-rel-staff-supports-members', did: 'did:plc:nationalstaff', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:nationalstaff/org.dsa.profile.orgUnit/self', relationship: 'supports', objectUri: 'at://did:plc:membership/org.dsa.profile.orgUnit/self', description: 'National staff supports membership.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
  { uri: 'at://did:plc:nationalstaff/org.dsa.relationship.governance/supports-public-bodies', cid: 'bafy-mock-rel-staff-supports-bodies', did: 'did:plc:nationalstaff', handle: 'dsausa.org', collection: 'org.dsa.relationship.governance', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', record: { $type: 'org.dsa.relationship.governance', subjectUri: 'at://did:plc:nationalstaff/org.dsa.profile.orgUnit/self', relationship: 'supports', objectUri: 'at://did:plc:prioritycommittees/org.dsa.profile.orgUnit/self', description: 'National staff supports public-facing DSA bodies including publications, committees, working groups, commissions, and local chapters.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' } },
];

export const authoritySeedRecords: RecordEnvelope[] = [
  {
    uri: 'at://did:plc:nationaldsa/org.dsa.authority.mandate/national-membership-mandate',
    cid: 'bafy-mock-authority-mandate-national',
    did: 'did:plc:nationaldsa',
    handle: 'dsausa.org',
    collection: 'org.dsa.authority.mandate',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.authority.mandate',
      subjectUri: 'at://did:plc:nationaldsa/org.dsa.profile.orgUnit/self',
      roleName: 'national membership body',
      mandate: 'National DSA provides the primary membership path, national coordination, and shared organizational support for local chapters and caucuses.',
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:nationaldsa/org.dsa.authority.charter/nyc-charter',
    cid: 'bafy-mock-authority-charter-nyc',
    did: 'did:plc:nationaldsa',
    handle: 'dsausa.org',
    collection: 'org.dsa.authority.charter',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.authority.charter',
      subjectUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
      charteredByUri: 'at://did:plc:nationaldsa/org.dsa.profile.orgUnit/self',
      jurisdiction: 'New York City, NY, US',
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:nationaldsa/org.dsa.authority.delegation/npc-charter-delegation',
    cid: 'bafy-mock-authority-delegation-npc',
    did: 'did:plc:nationaldsa',
    handle: 'dsausa.org',
    collection: 'org.dsa.authority.delegation',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.authority.delegation',
      subjectUri: 'at://did:plc:nationaldsa/org.dsa.profile.orgUnit/self',
      delegatedToUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self',
      scope: 'charter local chapters and steward national organizational priorities',
      authority: 'National Political Committee authority delegated through national governance structure',
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:nycdsa/org.dsa.authority.dispute/climate-caucus-status',
    cid: 'bafy-mock-authority-dispute-climate',
    did: 'did:plc:nycdsa',
    handle: 'nyc.dsausa.org',
    collection: 'org.dsa.authority.dispute',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'community-submitted',
    record: {
      $type: 'org.dsa.authority.dispute',
      subjectUri: 'at://did:plc:climatecaucus/org.dsa.profile.caucus/self',
      raisedByUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
      summary: 'Local prototype notes a dispute over whether the climate caucus is operating as a formal caucus or an informal organizing project.',
      createdAt: '2026-07-01T00:00:00.000Z',
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
    trustLabel: 'uncertain',
    record: {
      $type: 'org.dsa.affiliation.member',
      displayName: 'Jordan Kim',
      memberDid: 'did:plc:memberbeta',
      memberHandle: 'member.beta.example',
      organizationDid: 'did:plc:midsa',
      organizationHandle: 'michigan.socialists.org',
      relationship: 'self-declared-member',
      trustTag: 'uncertain',
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
    trustLabel: 'community-submitted',
    record: {
      $type: 'org.dsa.affiliation.member',
      displayName: 'Sam Taylor',
      memberDid: 'did:plc:membergamma',
      memberHandle: 'member.gamma.example',
      organizationDid: 'did:plc:climatecaucus',
      organizationHandle: 'climate.dsausa.org',
      relationship: 'self-declared-member',
      trustTag: 'community-submitted',
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
    trustLabel: 'official',
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
    trustLabel: 'community-submitted',
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

export const publicStatementSeedRecords: RecordEnvelope[] = [
  {
    uri: 'at://did:plc:nycdsa/org.dsa.statement.public/welcome-note',
    cid: 'bafy-mock-statement-nyc-welcome',
    did: 'did:plc:nycdsa',
    handle: 'nyc.dsausa.org',
    collection: 'org.dsa.statement.public',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.statement.public',
      title: 'Welcome to the prototype chapter feed',
      summary: 'A safe sample statement for the local demo.',
      bodyMarkdown: 'This prototype statement shows how a chapter post can point back to the registry.',
      issuerUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
      issuerName: 'New York City DSA',
      publishedAt: '2026-07-01T00:00:00.000Z',
      topics: ['prototype', 'directory'],
      relatedEntityUris: ['at://did:plc:nycdsa/org.dsa.profile.chapter/self'],
      status: 'published',
    },
  },
  {
    uri: 'at://did:plc:climatecaucus/org.dsa.statement.public/community-note',
    cid: 'bafy-mock-statement-climate-note',
    did: 'did:plc:climatecaucus',
    handle: 'climate.dsausa.org',
    collection: 'org.dsa.statement.public',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'community-submitted',
    record: {
      $type: 'org.dsa.statement.public',
      title: 'Climate caucus demo update',
      summary: 'Prototype caucus note linking back to the public directory.',
      bodyMarkdown: 'This is a short demo statement about public-facing organizing and education.',
      issuerUri: 'at://did:plc:climatecaucus/org.dsa.profile.caucus/self',
      issuerName: 'DSA Climate Caucus',
      publishedAt: '2026-07-01T00:00:00.000Z',
      topics: ['climate', 'prototype'],
      relatedEntityUris: ['at://did:plc:climatecaucus/org.dsa.profile.caucus/self'],
      status: 'published',
    },
  },
  {
    uri: 'at://did:plc:npc/org.dsa.statement.public/governance-note',
    cid: 'bafy-mock-statement-npc-note',
    did: 'did:plc:npc',
    handle: 'dsausa.org',
    collection: 'org.dsa.statement.public',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.statement.public',
      title: 'Public governance demo note',
      summary: 'A short org-unit statement for the prototype feed.',
      bodyMarkdown: 'Public prototype note for governance and publication examples only.',
      issuerUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self',
      issuerName: 'National Political Committee',
      publishedAt: '2026-07-01T00:00:00.000Z',
      topics: ['governance', 'publication'],
      relatedEntityUris: ['at://did:plc:npc/org.dsa.profile.orgUnit/self', 'at://did:plc:demleft/org.dsa.profile.orgUnit/self'],
      status: 'published',
    },
  },
];

export const publicationSeedRecords: RecordEnvelope[] = [
  {
    uri: 'at://did:plc:demleft/org.dsa.publication.profile/self',
    cid: 'bafy-mock-publication-demleft',
    did: 'did:plc:demleft',
    handle: 'dsausa.org',
    collection: 'org.dsa.publication.profile',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.publication.profile',
      name: 'Democratic Left',
      shortName: 'Dem Left',
      publisherUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self',
      publisherName: 'National Political Committee',
      website: 'https://www.dsausa.org/democratic-left/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:demleft/org.dsa.publication.article/welcome-piece',
    cid: 'bafy-mock-publication-demleft-article',
    did: 'did:plc:demleft',
    handle: 'dsausa.org',
    collection: 'org.dsa.publication.article',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.publication.article',
      publicationUri: 'at://did:plc:demleft/org.dsa.publication.profile/self',
      publicationName: 'Democratic Left',
      title: 'A public demo article for the prototype',
      summary: 'Example article showing publication/article records end-to-end.',
      bodyMarkdown: 'This prototype article links the publication layer back to a chapter and the org chart.',
      authorName: 'DSA editorial collective',
      publishedAt: '2026-07-01T00:00:00.000Z',
      topics: ['prototype', 'publication'],
      relatedEntityUris: ['at://did:plc:npc/org.dsa.profile.orgUnit/self', 'at://did:plc:nycdsa/org.dsa.profile.chapter/self'],
      status: 'published',
    },
  },
];

export const endorsementSeedRecords: RecordEnvelope[] = [
  {
    uri: 'at://did:plc:nycdsa/org.dsa.endorsement.public/mock-nyc-city-council',
    cid: 'bafy-mock-endorsement-nyc-city-council',
    did: 'did:plc:nycdsa',
    handle: 'nyc.dsausa.org',
    collection: 'org.dsa.endorsement.public',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.endorsement.public',
      endorsingEntityUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
      endorsingEntityName: 'New York City DSA',
      candidateOrMeasureName: 'Prototype candidate endorsement sample',
      officeOrMeasure: 'City Council District 1',
      jurisdiction: 'New York City, NY',
      electionDate: '2026-11-03',
      status: 'active',
      statementUri: 'at://did:plc:nycdsa/org.dsa.statement.public/welcome-note',
      sourceUrl: 'https://example.org/public-prototype/endorsements/nyc-city-council',
      topics: ['prototype', 'elections', 'municipal'],
      relatedEntityUris: ['at://did:plc:nycdsa/org.dsa.profile.chapter/self', 'at://did:plc:nycdsa/org.dsa.statement.public/welcome-note'],
    },
  },
  {
    uri: 'at://did:plc:npc/org.dsa.endorsement.public/mock-proposal-measure',
    cid: 'bafy-mock-endorsement-npc-measure',
    did: 'did:plc:npc',
    handle: 'dsausa.org',
    collection: 'org.dsa.endorsement.public',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.endorsement.public',
      endorsingEntityUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self',
      endorsingEntityName: 'National Political Committee',
      candidateOrMeasureName: 'Prototype public campaign endorsement sample',
      officeOrMeasure: 'Housing and tenant protections measure',
      jurisdiction: 'National / prototype',
      electionDate: '2026-11-03',
      status: 'archived',
      statementUri: 'at://did:plc:npc/org.dsa.statement.public/governance-note',
      sourceUrl: 'https://example.org/public-prototype/endorsements/npc-measure',
      topics: ['prototype', 'campaign', 'housing'],
      relatedEntityUris: ['at://did:plc:npc/org.dsa.profile.orgUnit/self', 'at://did:plc:demleft/org.dsa.publication.article/welcome-piece'],
    },
  },
];

export const publicEventSeedRecords: RecordEnvelope[] = [
  {
    uri: 'at://did:plc:nycdsa/org.dsa.event.public/orientation',
    cid: 'bafy-mock-event-nyc-orientation',
    did: 'did:plc:nycdsa',
    handle: 'nyc.dsausa.org',
    collection: 'org.dsa.event.public',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.event.public',
      title: 'NYC DSA public orientation',
      hostEntityUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
      hostEntityName: 'New York City DSA',
      startsAt: '2026-07-15T18:00:00.000Z',
      mode: 'online',
      publicUrl: 'https://example.org/public-prototype/events/nyc-orientation',
      status: 'scheduled',
      topics: ['welcome', 'membership', 'prototype'],
      relatedEntityUris: ['at://did:plc:nycdsa/org.dsa.profile.chapter/self'],
    },
  },
  {
    uri: 'at://did:plc:climatecaucus/org.dsa.event.public/briefing',
    cid: 'bafy-mock-event-climate-briefing',
    did: 'did:plc:climatecaucus',
    handle: 'climate.dsausa.org',
    collection: 'org.dsa.event.public',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'community-submitted',
    record: {
      $type: 'org.dsa.event.public',
      title: 'Climate caucus public briefing',
      hostEntityUri: 'at://did:plc:climatecaucus/org.dsa.profile.caucus/self',
      hostEntityName: 'DSA Climate Caucus',
      startsAt: '2026-07-20T00:00:00.000Z',
      endsAt: '2026-07-20T01:00:00.000Z',
      mode: 'hybrid',
      publicUrl: 'https://example.org/public-prototype/events/climate-briefing',
      locationLabel: 'Public demo location shared for the prototype only',
      status: 'scheduled',
      topics: ['climate', 'education', 'prototype'],
      relatedEntityUris: ['at://did:plc:climatecaucus/org.dsa.profile.caucus/self'],
    },
  },
  {
    uri: 'at://did:plc:npc/org.dsa.event.public/governance-forum',
    cid: 'bafy-mock-event-npc-forum',
    did: 'did:plc:npc',
    handle: 'dsausa.org',
    collection: 'org.dsa.event.public',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'official',
    record: {
      $type: 'org.dsa.event.public',
      title: 'NPC public governance forum',
      hostEntityUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self',
      hostEntityName: 'National Political Committee',
      startsAt: '2026-07-25T22:00:00.000Z',
      mode: 'in-person',
      locationLabel: 'Prototype public session room',
      status: 'archived',
      topics: ['governance', 'public process', 'prototype'],
      relatedEntityUris: ['at://did:plc:npc/org.dsa.profile.orgUnit/self', 'at://did:plc:demleft/org.dsa.profile.orgUnit/self'],
    },
  },
];

export const allSeedRecords: RecordEnvelope[] = [...chapterSeedRecords, ...caucusSeedRecords, ...orgChartSeedRecords, ...governanceRelationshipSeedRecords, ...authoritySeedRecords, ...memberAffiliationSeedRecords, ...verificationAssertionSeedRecords, ...publicStatementSeedRecords, ...publicationSeedRecords, ...endorsementSeedRecords, ...publicEventSeedRecords];

export type DirectoryRecordEnvelope = RecordEnvelope & { collection: 'org.dsa.profile.chapter' | 'org.dsa.profile.caucus' | 'org.dsa.affiliation.member' };

export function isDirectoryEntityRecord(record: RecordEnvelope): record is DirectoryRecordEnvelope {
  return record.collection === 'org.dsa.profile.chapter' || record.collection === 'org.dsa.profile.caucus' || record.collection === 'org.dsa.affiliation.member';
}

export function computeVerificationMetadata(records: RecordEnvelope[], subjectUri: string, currentTrustLabel: z.infer<typeof trustLabelSchema>): Pick<DirectoryEntity, 'verificationStatus' | 'verifiedBy' | 'verificationReason' | 'trustLabel'> {
  const assertions = records.filter((record): record is RecordEnvelope & { record: VerificationAssertionRecord } => {
    const parsed = verificationAssertionSchema.safeParse(record.record);
    return record.collection === 'org.dsa.verification.assertion' && parsed.success && parsed.data.subjectUri === subjectUri;
  });
  const latest = assertions.at(-1);
  if (!latest) {
    const verificationStatusMap: Record<z.infer<typeof trustLabelSchema>, VerificationStatus> = {
      official: 'verified',
      'verified-by-national': 'verified',
      'verified-by-chapter': 'verified',
      'verified-by-caucus': 'verified',
      'self-declared': 'self-declared',
      'community-submitted': 'community-submitted',
      'secondary-source': 'uncertain',
      uncertain: 'uncertain',
    };
    const verificationStatus = verificationStatusMap[currentTrustLabel];
    return { trustLabel: currentTrustLabel, verificationStatus };
  }
  const statusMap: Record<VerificationAssertionRecord['assertion'], VerificationStatus> = {
    verified: 'verified',
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
