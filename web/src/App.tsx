import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { buildChapterFixtureEnvelope, buildVerificationFixtureEnvelope, createDefaultChapterDraft, createDefaultVerificationDraft, type ChapterDraft, type VerificationDraft } from './publisher';
import FoundationEventsApp from './FoundationEventsApp';

export type DirectoryCard = {
  id: string;
  name: string;
  shortName: string;
  type: 'chapter' | 'caucus' | 'org-unit' | 'member-affiliation';
  collection: string;
  handle: string;
  did: string;
  jurisdiction: string;
  jurisdictionState?: string;
  jurisdictionType?: string;
  trustLabel: string;
  verificationStatus: string;
  verifiedBy?: string;
  verificationReason?: string;
  status: string;
  focusArea?: string;
  publicRole?: string;
  memberHandle?: string;
  organizationHandle?: string;
  record: { record: Record<string, unknown> };
};

export type OrgChartUnit = { uri: string; name: string; shortName: string; kind: string; description: string; status: string; website?: string };
export type OrgChartRelationship = { uri: string; subjectUri: string; relationship: string; objectUri: string; description: string; sourceUrl: string; status: string; createdAt: string };
export type OrgChartPayload = { prototype: boolean; sourceUrl: string; updatedLabel: string; units: OrgChartUnit[]; relationships: OrgChartRelationship[] };
export type RegistryHealthPayload = {
  prototype: boolean;
  file: string;
  fileLabel: string;
  status: 'ok' | 'warning' | 'fail';
  totalRecords: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  directoryCountsByCollection: Record<string, number>;
  directoryCountsByType: Record<string, number>;
  invalidRecords: Array<{ index: number; reason: string }>;
  duplicates: Record<string, Array<{ value: string; indexes: number[] }>>;
};

export type PublicStatementCard = {
  uri: string;
  did: string;
  handle: string;
  collection: string;
  indexedAt: string;
  trustLabel: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  issuerUri: string;
  issuerName: string;
  publishedAt: string;
  topics: string[];
  relatedEntityUris: string[];
  status: string;
  record: { record: Record<string, unknown> };
};

export type PublicationProfileCard = {
  uri: string;
  did: string;
  handle: string;
  collection: string;
  indexedAt: string;
  trustLabel: string;
  name: string;
  shortName: string;
  publisherUri: string;
  publisherName: string;
  website?: string;
  status: string;
  record: { record: Record<string, unknown> };
};

export type PublicationArticleCard = {
  uri: string;
  did: string;
  handle: string;
  collection: string;
  indexedAt: string;
  trustLabel: string;
  publicationUri: string;
  publicationName: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  authorName?: string;
  publishedAt: string;
  topics: string[];
  relatedEntityUris: string[];
  status: string;
  record: { record: Record<string, unknown> };
};

export type PublicEndorsementCard = {
  uri: string;
  did: string;
  handle: string;
  collection: string;
  indexedAt: string;
  trustLabel: string;
  endorsingEntityUri: string;
  endorsingEntityName: string;
  candidateOrMeasureName: string;
  officeOrMeasure: string;
  jurisdiction: string;
  electionDate: string;
  status: string;
  statementUri?: string;
  sourceUrl?: string;
  topics: string[];
  relatedEntityUris: string[];
  record: { record: Record<string, unknown> };
};

export type PublicEventCard = {
  uri: string;
  did: string;
  handle: string;
  collection: string;
  indexedAt: string;
  trustLabel: string;
  title: string;
  hostEntityUri: string;
  hostEntityName: string;
  startsAt: string;
  endsAt?: string;
  mode: string;
  publicUrl?: string;
  locationLabel?: string;
  status: string;
  topics: string[];
  relatedEntityUris: string[];
  record: { record: Record<string, unknown> };
};


export type CivicActivityCard = {
  uri: string;
  type: 'statement' | 'article' | 'endorsement' | 'event';
  title: string;
  summary: string;
  actorName: string;
  actorUri?: string;
  date: string;
  status: string;
  topics: string[];
  relatedEntityUris: string[];
  collection: string;
  trustLabel: string;
};

export type ResolvedRecordAuthority = {
  record?: { uri: string; collection: string; trustLabel: string; record: Record<string, unknown> };
  revisions: Array<{ uri: string; cid: string; indexedAt: string }>;
  status: 'valid' | 'expired' | 'revoked' | 'disputed' | 'unresolved';
  authorityRecords: Array<{ uri: string; collection: string; record: Record<string, unknown> }>;
  caveats: string[];
};

type FoundationEntityView = {
  entityUri: string;
  profile?: { displayName?: string; description?: string; links?: Array<{ uri?: string }> };
  dsaUnit?: { unitKind?: string; jurisdiction?: { kind?: string; name?: string; region?: string } };
  provenance: { repoDid: string; cid: string; observedAt: string };
  authority: { status: string; chain: Array<{ uri: string; cid: string }>; reasons: string[] };
  lifecycle: string;
};

function foundationEntityToCard(entity: FoundationEntityView): DirectoryCard {
  const unitKind = entity.dsaUnit?.unitKind ?? 'other';
  const type: DirectoryCard['type'] = unitKind === 'chapter' || unitKind === 'organizingCommittee' ? 'chapter' : unitKind === 'caucus' ? 'caucus' : 'org-unit';
  const name = entity.profile?.displayName ?? entity.entityUri;
  const jurisdiction = entity.dsaUnit?.jurisdiction;
  return {
    id: entity.entityUri,
    name,
    shortName: name,
    type,
    collection: 'us.dsaslate.temp.orgEntity',
    handle: entity.provenance.repoDid,
    did: entity.provenance.repoDid,
    jurisdiction: jurisdiction ? [jurisdiction.name, jurisdiction.region].filter(Boolean).join(', ') : unitKind,
    jurisdictionState: jurisdiction?.region,
    jurisdictionType: jurisdiction?.kind,
    trustLabel: entity.authority.status,
    verificationStatus: entity.authority.status,
    verificationReason: entity.authority.reasons.join('; '),
    status: entity.lifecycle,
    record: { record: entity.profile ?? {} },
  };
}

export async function fetchResolvedAuthority(apiBase: string, recordUri: string, foundationV1 = false) {
  const url = new URL(`${apiBase}${foundationV1 ? '/api/v1/records/resolve' : '/api/records/resolve'}`);
  url.searchParams.set('uri', recordUri);
  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const payload = await response.json() as { data?: ResolvedRecordAuthority | { uri: string; provenance?: { cid: string; observedAt: string }; authority: { status: string; chain: Array<{ uri: string; cid: string }>; reasons: string[] } } };
  if (!foundationV1) return payload.data as ResolvedRecordAuthority ?? null;
  const data = payload.data as { uri: string; provenance?: { cid: string; observedAt: string }; authority: { status: string; chain: Array<{ uri: string; cid: string }>; reasons: string[] } } | undefined;
  if (!data) return null;
  const status = ['expired', 'revoked', 'disputed', 'unresolved'].includes(data.authority.status) ? data.authority.status as ResolvedRecordAuthority['status'] : 'valid';
  return {
    record: { uri: data.uri, collection: data.uri.split('/')[3] ?? 'unknown', trustLabel: data.authority.status, record: {} },
    revisions: data.provenance ? [{ uri: data.uri, cid: data.provenance.cid, indexedAt: data.provenance.observedAt }] : [],
    status,
    authorityRecords: data.authority.chain.map((item) => ({ uri: item.uri, collection: item.uri.split('/')[3] ?? 'unknown', record: { cid: item.cid } })),
    caveats: data.authority.reasons,
  };
}

const orgChartKindLabels: Record<string, string> = {
  'national-committee': 'National committees',
  'steering-committee': 'Steering committees',
  staff: 'Staff',
  publication: 'Publications',
  'priority-committee': 'Priority committees',
  'working-group': 'Working groups and commissions',
  commission: 'Working groups and commissions',
  'chapter-network': 'Chapter network',
  'membership-body': 'Membership',
  'delegate-body': 'Delegates',
  'youth-committee': 'Youth committee',
  'staff-role': 'Staff',
};

const fallbackEntities: DirectoryCard[] = [
  {
    id: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
    name: 'New York City DSA',
    shortName: 'NYC-DSA',
    type: 'chapter',
    collection: 'org.dsa.profile.chapter',
    handle: 'nyc.dsausa.org',
    did: 'did:plc:nycdsa',
    jurisdiction: 'New York City, NY',
    trustLabel: 'official',
    verificationStatus: 'verified',
    verifiedBy: 'dsausa.org',
    verificationReason: 'Prototype national verification assertion for the NYC chapter example.',
    status: 'active',
    record: { record: { $type: 'org.dsa.profile.chapter', name: 'New York City DSA', shortName: 'NYC-DSA' } },
  },
  {
    id: 'at://did:plc:climatecaucus/org.dsa.profile.caucus/self',
    name: 'DSA Climate Caucus',
    shortName: 'Climate Caucus',
    type: 'caucus',
    collection: 'org.dsa.profile.caucus',
    handle: 'climate.dsausa.org',
    did: 'did:plc:climatecaucus',
    jurisdiction: 'climate justice organizing',
    trustLabel: 'community-submitted',
    verificationStatus: 'disputed',
    verifiedBy: 'nyc.dsausa.org',
    verificationReason: 'Experimental caucus status is shown as disputed for prototype trust-state coverage.',
    status: 'active',
    focusArea: 'climate justice organizing',
    record: { record: { $type: 'org.dsa.profile.caucus', name: 'DSA Climate Caucus', shortName: 'Climate Caucus' } },
  },
  {
    id: 'at://did:plc:memberalpha/org.dsa.affiliation.member/self',
    name: 'Alex Rivera',
    shortName: 'neighborhood canvass volunteer',
    type: 'member-affiliation',
    collection: 'org.dsa.affiliation.member',
    handle: 'member.alpha.example',
    did: 'did:plc:memberalpha',
    jurisdiction: 'affiliated with nyc.dsausa.org',
    trustLabel: 'self-declared',
    verificationStatus: 'self-declared',
    status: 'active',
    publicRole: 'neighborhood canvass volunteer',
    memberHandle: 'member.alpha.example',
    organizationHandle: 'nyc.dsausa.org',
    record: { record: { $type: 'org.dsa.affiliation.member', displayName: 'Alex Rivera' } },
  },
];

const fallbackOrgChart: OrgChartPayload = {
  prototype: true,
  sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg',
  updatedLabel: 'Last updated June 2020',
  units: [{ uri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', name: 'National Political Committee', shortName: 'NPC', kind: 'national-committee', description: 'National governing committee elected by chapter delegates at convention.', status: 'active' }],
  relationships: [{ uri: 'at://did:plc:chapterdelegates/org.dsa.relationship.governance/npc-elects', subjectUri: 'at://did:plc:chapterdelegates/org.dsa.profile.orgUnit/self', relationship: 'elects', objectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', description: 'Chapter delegates elect the National Political Committee at convention.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' }],
};

const fallbackRegistryHealth: RegistryHealthPayload = {
  prototype: true,
  file: 'fixtures/records.json',
  fileLabel: 'fixtures/records.json',
  status: 'ok',
  totalRecords: 247,
  validCount: 247,
  invalidCount: 0,
  duplicateCount: 0,
  directoryCountsByCollection: { 'org.dsa.profile.chapter': 233, 'org.dsa.profile.caucus': 14 },
  directoryCountsByType: { chapter: 233, caucus: 14 },
  invalidRecords: [],
  duplicates: { uri: [], did: [], handle: [], name: [] },
};

const fallbackStatements: PublicStatementCard[] = [
  { uri: 'at://did:plc:nycdsa/org.dsa.statement.public/welcome-note', did: 'did:plc:nycdsa', handle: 'nyc.dsausa.org', collection: 'org.dsa.statement.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', title: 'Welcome to the prototype chapter feed', summary: 'A safe sample statement for the local demo.', bodyMarkdown: 'This prototype statement shows how a chapter post can point back to the registry.', issuerUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', issuerName: 'New York City DSA', publishedAt: '2026-07-01T00:00:00.000Z', topics: ['prototype', 'directory'], relatedEntityUris: ['at://did:plc:nycdsa/org.dsa.profile.chapter/self'], status: 'published', record: { record: { $type: 'org.dsa.statement.public' } } },
  { uri: 'at://did:plc:climatecaucus/org.dsa.statement.public/community-note', did: 'did:plc:climatecaucus', handle: 'climate.dsausa.org', collection: 'org.dsa.statement.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'community-submitted', title: 'Climate caucus demo update', summary: 'Prototype caucus note linking back to the public directory.', bodyMarkdown: 'This is a short demo statement about public-facing organizing and education.', issuerUri: 'at://did:plc:climatecaucus/org.dsa.profile.caucus/self', issuerName: 'DSA Climate Caucus', publishedAt: '2026-07-01T00:00:00.000Z', topics: ['climate', 'prototype'], relatedEntityUris: ['at://did:plc:climatecaucus/org.dsa.profile.caucus/self'], status: 'published', record: { record: { $type: 'org.dsa.statement.public' } } },
  { uri: 'at://did:plc:npc/org.dsa.statement.public/governance-note', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.statement.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', title: 'Public governance demo note', summary: 'A short org-unit statement for the prototype feed.', bodyMarkdown: 'Public prototype note for governance and publication examples only.', issuerUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', issuerName: 'National Political Committee', publishedAt: '2026-07-01T00:00:00.000Z', topics: ['governance', 'publication'], relatedEntityUris: ['at://did:plc:npc/org.dsa.profile.orgUnit/self', 'at://did:plc:demleft/org.dsa.profile.orgUnit/self'], status: 'published', record: { record: { $type: 'org.dsa.statement.public' } } },
];

const fallbackPublications: PublicationProfileCard[] = [
  { uri: 'at://did:plc:demleft/org.dsa.publication.profile/self', did: 'did:plc:demleft', handle: 'dsausa.org', collection: 'org.dsa.publication.profile', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', name: 'Democratic Left', shortName: 'Dem Left', publisherUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', publisherName: 'National Political Committee', website: 'https://www.dsausa.org/democratic-left/', status: 'active', record: { record: { $type: 'org.dsa.publication.profile' } } },
];

const fallbackArticles: PublicationArticleCard[] = [
  { uri: 'at://did:plc:demleft/org.dsa.publication.article/welcome-piece', did: 'did:plc:demleft', handle: 'dsausa.org', collection: 'org.dsa.publication.article', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', publicationUri: 'at://did:plc:demleft/org.dsa.publication.profile/self', publicationName: 'Democratic Left', title: 'A public demo article for the prototype', summary: 'Example article showing publication/article records end-to-end.', bodyMarkdown: 'This prototype article links the publication layer back to a chapter and the org chart.', authorName: 'DSA editorial collective', publishedAt: '2026-07-01T00:00:00.000Z', topics: ['prototype', 'publication'], relatedEntityUris: ['at://did:plc:npc/org.dsa.profile.orgUnit/self', 'at://did:plc:nycdsa/org.dsa.profile.chapter/self'], status: 'published', record: { record: { $type: 'org.dsa.publication.article' } } },
];

const fallbackEndorsements: PublicEndorsementCard[] = [
  { uri: 'at://did:plc:nycdsa/org.dsa.endorsement.public/mock-nyc-city-council', did: 'did:plc:nycdsa', handle: 'nyc.dsausa.org', collection: 'org.dsa.endorsement.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', endorsingEntityUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', endorsingEntityName: 'New York City DSA', candidateOrMeasureName: 'Prototype candidate endorsement sample', officeOrMeasure: 'City Council District 1', jurisdiction: 'New York City, NY', electionDate: '2026-11-03', status: 'active', statementUri: 'at://did:plc:nycdsa/org.dsa.statement.public/welcome-note', sourceUrl: 'https://example.org/public-prototype/endorsements/nyc-city-council', topics: ['prototype', 'elections', 'municipal'], relatedEntityUris: ['at://did:plc:nycdsa/org.dsa.profile.chapter/self', 'at://did:plc:nycdsa/org.dsa.statement.public/welcome-note'], record: { record: { $type: 'org.dsa.endorsement.public' } } },
  { uri: 'at://did:plc:npc/org.dsa.endorsement.public/mock-proposal-measure', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.endorsement.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', endorsingEntityUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', endorsingEntityName: 'National Political Committee', candidateOrMeasureName: 'Prototype public campaign endorsement sample', officeOrMeasure: 'Housing and tenant protections measure', jurisdiction: 'National / prototype', electionDate: '2026-11-03', status: 'archived', statementUri: 'at://did:plc:npc/org.dsa.statement.public/governance-note', sourceUrl: 'https://example.org/public-prototype/endorsements/npc-measure', topics: ['prototype', 'campaign', 'housing'], relatedEntityUris: ['at://did:plc:npc/org.dsa.profile.orgUnit/self', 'at://did:plc:demleft/org.dsa.publication.article/welcome-piece'], record: { record: { $type: 'org.dsa.endorsement.public' } } },
];

const fallbackEvents: PublicEventCard[] = [
  { uri: 'at://did:plc:nycdsa/org.dsa.event.public/orientation', did: 'did:plc:nycdsa', handle: 'nyc.dsausa.org', collection: 'org.dsa.event.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', title: 'NYC DSA public orientation', hostEntityUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', hostEntityName: 'New York City DSA', startsAt: '2026-07-15T18:00:00.000Z', mode: 'online', publicUrl: 'https://example.org/public-prototype/events/nyc-orientation', status: 'scheduled', topics: ['welcome', 'membership', 'prototype'], relatedEntityUris: ['at://did:plc:nycdsa/org.dsa.profile.chapter/self'], record: { record: { $type: 'org.dsa.event.public' } } },
  { uri: 'at://did:plc:climatecaucus/org.dsa.event.public/briefing', did: 'did:plc:climatecaucus', handle: 'climate.dsausa.org', collection: 'org.dsa.event.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'community-submitted', title: 'Climate caucus public briefing', hostEntityUri: 'at://did:plc:climatecaucus/org.dsa.profile.caucus/self', hostEntityName: 'DSA Climate Caucus', startsAt: '2026-07-20T00:00:00.000Z', endsAt: '2026-07-20T01:00:00.000Z', mode: 'hybrid', publicUrl: 'https://example.org/public-prototype/events/climate-briefing', locationLabel: 'Public demo location shared for the prototype only', status: 'scheduled', topics: ['climate', 'education', 'prototype'], relatedEntityUris: ['at://did:plc:climatecaucus/org.dsa.profile.caucus/self'], record: { record: { $type: 'org.dsa.event.public' } } },
  { uri: 'at://did:plc:npc/org.dsa.event.public/governance-forum', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.event.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'official', title: 'NPC public governance forum', hostEntityUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', hostEntityName: 'National Political Committee', startsAt: '2026-07-25T22:00:00.000Z', mode: 'in-person', locationLabel: 'Prototype public session room', status: 'archived', topics: ['governance', 'public process', 'prototype'], relatedEntityUris: ['at://did:plc:npc/org.dsa.profile.orgUnit/self', 'at://did:plc:demleft/org.dsa.profile.orgUnit/self'], record: { record: { $type: 'org.dsa.event.public' } } },
];


const fallbackActivity: CivicActivityCard[] = [
  { uri: fallbackStatements[0].uri, type: 'statement', title: fallbackStatements[0].title, summary: fallbackStatements[0].summary, actorName: fallbackStatements[0].issuerName, actorUri: fallbackStatements[0].issuerUri, date: fallbackStatements[0].publishedAt, status: fallbackStatements[0].status, topics: fallbackStatements[0].topics, relatedEntityUris: fallbackStatements[0].relatedEntityUris, collection: fallbackStatements[0].collection, trustLabel: fallbackStatements[0].trustLabel },
  { uri: fallbackStatements[1].uri, type: 'statement', title: fallbackStatements[1].title, summary: fallbackStatements[1].summary, actorName: fallbackStatements[1].issuerName, actorUri: fallbackStatements[1].issuerUri, date: fallbackStatements[1].publishedAt, status: fallbackStatements[1].status, topics: fallbackStatements[1].topics, relatedEntityUris: fallbackStatements[1].relatedEntityUris, collection: fallbackStatements[1].collection, trustLabel: fallbackStatements[1].trustLabel },
  { uri: fallbackStatements[2].uri, type: 'statement', title: fallbackStatements[2].title, summary: fallbackStatements[2].summary, actorName: fallbackStatements[2].issuerName, actorUri: fallbackStatements[2].issuerUri, date: fallbackStatements[2].publishedAt, status: fallbackStatements[2].status, topics: fallbackStatements[2].topics, relatedEntityUris: fallbackStatements[2].relatedEntityUris, collection: fallbackStatements[2].collection, trustLabel: fallbackStatements[2].trustLabel },
  { uri: fallbackArticles[0].uri, type: 'article', title: fallbackArticles[0].title, summary: fallbackArticles[0].summary, actorName: fallbackArticles[0].publicationName, actorUri: fallbackArticles[0].publicationUri, date: fallbackArticles[0].publishedAt, status: fallbackArticles[0].status, topics: fallbackArticles[0].topics, relatedEntityUris: fallbackArticles[0].relatedEntityUris, collection: fallbackArticles[0].collection, trustLabel: fallbackArticles[0].trustLabel },
  { uri: fallbackEndorsements[0].uri, type: 'endorsement', title: fallbackEndorsements[0].candidateOrMeasureName, summary: `${fallbackEndorsements[0].officeOrMeasure} · ${fallbackEndorsements[0].jurisdiction}`, actorName: fallbackEndorsements[0].endorsingEntityName, actorUri: fallbackEndorsements[0].endorsingEntityUri, date: fallbackEndorsements[0].electionDate, status: fallbackEndorsements[0].status, topics: fallbackEndorsements[0].topics, relatedEntityUris: fallbackEndorsements[0].relatedEntityUris, collection: fallbackEndorsements[0].collection, trustLabel: fallbackEndorsements[0].trustLabel },
  { uri: fallbackEvents[0].uri, type: 'event', title: fallbackEvents[0].title, summary: fallbackEvents[0].locationLabel ?? fallbackEvents[0].mode, actorName: fallbackEvents[0].hostEntityName, actorUri: fallbackEvents[0].hostEntityUri, date: fallbackEvents[0].startsAt, status: fallbackEvents[0].status, topics: fallbackEvents[0].topics, relatedEntityUris: fallbackEvents[0].relatedEntityUris, collection: fallbackEvents[0].collection, trustLabel: fallbackEvents[0].trustLabel },
];

// Badge components for consistent UI
function Badge({ children, color }: { children: ReactNode; color: 'cyan' | 'emerald' | 'amber' | 'violet' | 'sky' | 'fuchsia' | 'slate' }) {
  const colors = {
    cyan: 'border-cyan-400/40 text-cyan-200',
    emerald: 'border-emerald-400/40 text-emerald-200',
    amber: 'border-amber-400/40 text-amber-200',
    violet: 'border-violet-400/40 text-violet-200',
    sky: 'border-sky-400/40 text-sky-200',
    fuchsia: 'border-fuchsia-400/40 text-fuchsia-200',
    slate: 'border-zinc-600 text-zinc-400',
  };
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs uppercase tracking-wider ${colors[color]}`}>{children}</span>;
}

function FoundationBadge() {
  return <span className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-200">Foundation Layer</span>;
}

function AppLayerBadge() {
  return <span className="rounded-full border border-violet-400/50 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-200">App Layer</span>;
}

function ReadOnlyBadge() {
  return <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-200">Read-Only Demo</span>;
}

export type AppProps = { initialEntities?: DirectoryCard[]; initialOrgChart?: OrgChartPayload; initialRegistryHealth?: RegistryHealthPayload; initialSearch?: string; initialTypeFilter?: 'all' | DirectoryCard['type']; initialResolvedAuthority?: ResolvedRecordAuthority | null };

function LegacyApp({ initialEntities = fallbackEntities, initialOrgChart = fallbackOrgChart, initialRegistryHealth = fallbackRegistryHealth, initialSearch = '', initialTypeFilter = 'all', initialResolvedAuthority = null }: AppProps) {
  const demoReadOnly = import.meta.env.VITE_DEMO_READ_ONLY === 'true';
  const foundationV1 = import.meta.env.VITE_FOUNDATION_V1 === 'true';
  const [entities, setEntities] = useState(foundationV1 ? [] : initialEntities);
  const [orgChart, setOrgChart] = useState(foundationV1 ? { prototype: false, sourceUrl: '', updatedLabel: 'Tap-synchronized staging graph', units: [], relationships: [] } : initialOrgChart);
  const [registryHealth, setRegistryHealth] = useState(initialRegistryHealth);
  const [search, setSearch] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState<'all' | DirectoryCard['type']>(initialTypeFilter);
  const [stateFilter, setStateFilter] = useState('all');
  const [jurisdictionTypeFilter, setJurisdictionTypeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(foundationV1 ? '' : initialEntities[0]?.id ?? '');
  const [resolverTargetUri, setResolverTargetUri] = useState(foundationV1 ? '' : initialEntities[0]?.id ?? '');
  const [orgChartKindFilter, setOrgChartKindFilter] = useState<string>('all');
  const [orgChartSelectedUnit, setOrgChartSelectedUnit] = useState<string>('');
  const [statements, setStatements] = useState(foundationV1 ? [] : fallbackStatements);
  const [publications, setPublications] = useState(foundationV1 ? [] : fallbackPublications);
  const [articles, setArticles] = useState(foundationV1 ? [] : fallbackArticles);
  const [endorsements, setEndorsements] = useState(foundationV1 ? [] : fallbackEndorsements);
  const [events, setEvents] = useState(foundationV1 ? [] : fallbackEvents);
  const [activity, setActivity] = useState(foundationV1 ? [] : fallbackActivity);
  const [draft, setDraft] = useState<ChapterDraft>(createDefaultChapterDraft());
  const [verificationDraft, setVerificationDraft] = useState<VerificationDraft>(createDefaultVerificationDraft());
  const [submitState, setSubmitState] = useState<string>('');
  const [resolvedAuthority, setResolvedAuthority] = useState<ResolvedRecordAuthority | null>(initialResolvedAuthority);
  const preview = useMemo(() => buildChapterFixtureEnvelope(draft), [draft]);
  const verificationPreview = useMemo(() => buildVerificationFixtureEnvelope(verificationDraft), [verificationDraft]);

  useEffect(() => {
    const url = new URL(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}${foundationV1 ? '/api/v1/entities' : '/api/entities'}`);
    if (typeFilter !== 'all') {
      if (foundationV1 && typeFilter !== 'org-unit') url.searchParams.set('unitKind', typeFilter);
      if (!foundationV1) url.searchParams.set('type', typeFilter);
    }
    if (search.trim()) url.searchParams.set('q', search.trim());
    if (stateFilter !== 'all') url.searchParams.set('state', stateFilter);
    if (jurisdictionTypeFilter !== 'all') url.searchParams.set('jurisdictionType', jurisdictionTypeFilter);
    url.searchParams.set('limit', foundationV1 ? '100' : '1000');
    fetch(url.toString())
      .then((response) => response.json())
      .then((payload) => {
        const nextEntities = foundationV1 ? (payload.data ?? []).map(foundationEntityToCard) : payload.data ?? initialEntities;
        setEntities(nextEntities);
        setSelectedId((current) => (nextEntities.some((entity: DirectoryCard) => entity.id === current) ? current : nextEntities[0]?.id ?? ''));
      })
      .catch(() => setEntities(foundationV1 ? [] : initialEntities));
  }, [foundationV1, initialEntities, search, typeFilter, stateFilter, jurisdictionTypeFilter]);

  useEffect(() => {
    const url = new URL(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}${foundationV1 ? '/api/v1/org-graph' : '/api/org-chart'}`);
    if (orgChartKindFilter !== 'all') url.searchParams.set('kind', orgChartKindFilter);
    if (orgChartSelectedUnit) url.searchParams.set('unit', orgChartSelectedUnit);
    fetch(url.toString()).then((response) => response.json()).then((payload) => {
      if (!foundationV1) return setOrgChart(payload);
      const graph = payload.data ?? { entities: [], relationships: [] };
      const units: OrgChartUnit[] = graph.entities.map((entity: FoundationEntityView) => {
        const card = foundationEntityToCard(entity);
        return { uri: card.id, name: card.name, shortName: card.shortName, kind: entity.dsaUnit?.unitKind ?? 'other', description: entity.profile?.description ?? '', status: card.status, website: entity.profile?.links?.[0]?.uri };
      });
      const relationships: OrgChartRelationship[] = graph.relationships.map((item: { uri: string; record: { subject?: string; object?: string; relationship?: string; description?: string; evidenceUris?: string[]; createdAt?: string } }) => ({ uri: item.uri, subjectUri: item.record.subject ?? '', relationship: item.record.relationship ?? 'relatedTo', objectUri: item.record.object ?? '', description: item.record.description ?? '', sourceUrl: item.record.evidenceUris?.[0] ?? '', status: 'active', createdAt: item.record.createdAt ?? new Date(0).toISOString() }));
      setOrgChart({ prototype: false, sourceUrl: '', updatedLabel: 'Tap-synchronized staging graph', units, relationships });
    }).catch(() => setOrgChart(foundationV1 ? { prototype: false, sourceUrl: '', updatedLabel: 'Tap unavailable', units: [], relationships: [] } : initialOrgChart));
  }, [foundationV1, initialOrgChart, orgChartKindFilter, orgChartSelectedUnit]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/registry/health`).then((response) => response.json()).then((payload) => setRegistryHealth(payload)).catch(() => setRegistryHealth(initialRegistryHealth));
  }, [initialRegistryHealth]);

  useEffect(() => {
    if (selectedId) setResolverTargetUri(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!resolverTargetUri) {
      setResolvedAuthority(null);
      return;
    }
    let cancelled = false;
    const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
    fetchResolvedAuthority(apiBase, resolverTargetUri, foundationV1)
      .then((payload) => {
        if (!cancelled) setResolvedAuthority(payload);
      })
      .catch(() => {
        if (!cancelled) setResolvedAuthority(null);
      });
    return () => { cancelled = true; };
  }, [foundationV1, resolverTargetUri]);

  useEffect(() => {
    if (foundationV1) {
      setStatements([]);
      return;
    }
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/statements`).then((response) => response.json()).then((payload) => setStatements(payload.data ?? fallbackStatements)).catch(() => setStatements(fallbackStatements));
  }, [foundationV1]);

  useEffect(() => {
    if (foundationV1) {
      setPublications([]); setArticles([]); setEndorsements([]);
      fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/v1/activity`).then((response) => response.json()).then((payload) => {
        const nextActivity: CivicActivityCard[] = (payload.data ?? []).map((item: { uri: string; collection: string; record: { title?: string; description?: string; hostEntity?: string; startsAt?: string; status?: string; topics?: string[] }; authority: { status: string } }) => ({ uri: item.uri, type: 'event', title: item.record.title ?? item.uri, summary: item.record.description ?? '', actorName: item.record.hostEntity ?? 'Unknown entity', actorUri: item.record.hostEntity, date: item.record.startsAt ?? new Date(0).toISOString(), status: item.record.status ?? 'unknown', topics: item.record.topics ?? [], relatedEntityUris: item.record.hostEntity ? [item.record.hostEntity] : [], collection: item.collection, trustLabel: item.authority.status }));
        setActivity(nextActivity);
        setEvents([]);
      }).catch(() => { setActivity([]); setEvents([]); });
      return;
    }
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/publications`).then((response) => response.json()).then((payload) => setPublications(payload.data ?? fallbackPublications)).catch(() => setPublications(fallbackPublications));
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/articles`).then((response) => response.json()).then((payload) => setArticles(payload.data ?? fallbackArticles)).catch(() => setArticles(fallbackArticles));
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/endorsements`).then((response) => response.json()).then((payload) => setEndorsements(payload.data ?? fallbackEndorsements)).catch(() => setEndorsements(fallbackEndorsements));
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/events`).then((response) => response.json()).then((payload) => setEvents(payload.data ?? fallbackEvents)).catch(() => setEvents(fallbackEvents));
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/activity`).then((response) => response.json()).then((payload) => setActivity(payload.data ?? fallbackActivity)).catch(() => setActivity(fallbackActivity));
  }, [foundationV1]);

  const chapterStates = useMemo(() => [...new Set(entities.filter((entity) => entity.type === 'chapter' && entity.jurisdictionState).map((entity) => entity.jurisdictionState as string))].sort(), [entities]);
  const totalCount = entities.length;
  const chapterCount = entities.filter((entity) => entity.type === 'chapter').length;
  const caucusCount = entities.filter((entity) => entity.type === 'caucus').length;
  const visibleEntities = useMemo(() => entities.filter((entity) => {
    const matchesType = typeFilter === 'all' || entity.type === typeFilter;
    const matchesSearch = !search.trim() || `${entity.name} ${entity.shortName} ${entity.handle} ${entity.did} ${entity.jurisdiction} ${entity.organizationHandle ?? ''} ${entity.memberHandle ?? ''} ${entity.focusArea ?? ''}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesState = stateFilter === 'all' || entity.jurisdictionState === stateFilter;
    const matchesJurisdictionType = jurisdictionTypeFilter === 'all' || entity.jurisdictionType === jurisdictionTypeFilter;
    return matchesType && matchesSearch && matchesState && matchesJurisdictionType;
  }), [entities, search, typeFilter, stateFilter, jurisdictionTypeFilter]);

  const selectedEntity = visibleEntities.find((entity) => entity.id === selectedId) ?? visibleEntities[0];
  const relatedActivity = useMemo(() => selectedEntity ? activity.filter((item) => item.actorUri === selectedEntity.id || item.relatedEntityUris.includes(selectedEntity.id)) : [], [selectedEntity, activity]);
  const orgChartUnitsByUri = useMemo(() => new Map(orgChart.units.map((unit) => [unit.uri, unit])), [orgChart.units]);
  const orgChartUnitsByKind = useMemo(() => Object.entries(orgChart.units.reduce<Record<string, OrgChartUnit[]>>((acc, unit) => {
    (acc[unit.kind] ??= []).push(unit);
    return acc;
  }, {})).sort(([a], [b]) => (orgChartKindLabels[a] ?? a).localeCompare(orgChartKindLabels[b] ?? b)), [orgChart.units]);
  const selectedOrgUnit = orgChart.units.find((unit) => unit.uri === orgChartSelectedUnit);
  const activeOrgUnit = selectedOrgUnit ?? orgChart.units[0];
  const selectedOrgRelationships = activeOrgUnit ? orgChart.relationships.filter((relationship) => relationship.subjectUri === activeOrgUnit.uri || relationship.objectUri === activeOrgUnit.uri) : [];
  const incomingOrgRelationships = activeOrgUnit ? selectedOrgRelationships.filter((relationship) => relationship.objectUri === activeOrgUnit.uri) : [];
  const outgoingOrgRelationships = activeOrgUnit ? selectedOrgRelationships.filter((relationship) => relationship.subjectUri === activeOrgUnit.uri) : [];

  function unitName(uri: string) {
    return orgChartUnitsByUri.get(uri)?.name ?? uri;
  }

  async function publishPrototypeChapter(event: FormEvent) {
    event.preventDefault();
    setSubmitState('Publishing local prototype fixture...');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/admin/fixtures/ingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ records: [preview] }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'publish_failed');
      setSubmitState(`Accepted ${payload.acceptedCount}, ingested ${payload.ingestedCount}, rejected ${payload.rejected.length}`);
      const refreshed = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/entities`).then((r) => r.json());
      const nextEntities = refreshed.data ?? initialEntities;
      setEntities(nextEntities);
      setSelectedId(preview.uri);
    } catch (error) {
      setSubmitState(`Prototype publish failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  async function publishVerificationAssertion(event: FormEvent) {
    event.preventDefault();
    setSubmitState('Publishing local verification assertion...');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/admin/fixtures/ingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ records: [verificationPreview] }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'publish_failed');
      setSubmitState(`Accepted ${payload.acceptedCount}, ingested ${payload.ingestedCount}, rejected ${payload.rejected.length}`);
      const refreshed = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/entities`).then((r) => r.json());
      const nextEntities = refreshed.data ?? initialEntities;
      setEntities(nextEntities);
      setSelectedId((current) => (nextEntities.some((entity: DirectoryCard) => entity.id === verificationPreview.record.subjectUri) ? verificationPreview.record.subjectUri : current));
    } catch (error) {
      setSubmitState(`Prototype publish failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">DSA Civic Data Layer</h1>
              <FoundationBadge />
              {demoReadOnly && <ReadOnlyBadge />}
              {foundationV1 && <Badge color="amber">Provisional staging</Badge>}
            </div>
            <p className="mt-3 max-w-2xl text-lg text-zinc-300">
              A public foundation-layer dashboard for DSA organizational records. This substrate provides identity, authority, verification, and organizational graph records that other applications build upon.
            </p>
            <p className="mt-2 text-sm text-amber-300">
              {foundationV1 ? 'Every staging record is provisional. Official authority is disabled until formal organizational adoption and stable-namespace activation.' : 'Verification labels are prototype trust metadata only — not real DSA legitimacy or membership proof.'}
            </p>
          </div>
        </div>
      </section>

      {/* Operational Summary Cards */}
      <section className="mx-auto max-w-7xl px-6 pb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Registry Health Card */}
          <div className="rounded-xl border border-emerald-400/30 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">Registry Health</h2>
              <span className={`rounded-full border px-2 py-0.5 text-xs uppercase tracking-wider ${
                registryHealth.status === 'ok' ? 'border-emerald-400/50 text-emerald-200' : 
                registryHealth.status === 'warning' ? 'border-amber-400/50 text-amber-200' : 
                'border-rose-400/50 text-rose-200'
              }`}>{registryHealth.status.toUpperCase()}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold">{registryHealth.totalRecords}</p>
            <p className="text-sm text-zinc-400">Total records</p>
            <div className="mt-3 flex gap-4 text-xs text-zinc-500">
              <span>{registryHealth.directoryCountsByType.chapter ?? 0} chapters</span>
              <span>{registryHealth.directoryCountsByType.caucus ?? 0} caucuses</span>
            </div>
          </div>

          {/* Directory Counts Card */}
          <div className="rounded-xl border border-cyan-400/30 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">Directory Entities</h2>
            <p className="mt-3 text-2xl font-semibold">{totalCount}</p>
            <p className="text-sm text-zinc-400">Active records</p>
            <div className="mt-3 flex gap-4 text-xs text-zinc-500">
              <span>{chapterCount} chapters</span>
              <span>{caucusCount} caucuses</span>
            </div>
          </div>

          {/* Org Units Card */}
          <div className="rounded-xl border border-violet-400/30 bg-zinc-900/50 p-5">
            <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">Organization Units</h2>
            <p className="mt-3 text-2xl font-semibold">{orgChart.units.length}</p>
            <p className="text-sm text-zinc-400">Chart entities</p>
            <div className="mt-3 flex gap-2 flex-wrap">
              {[...new Set(orgChart.units.map(u => u.kind))].slice(0, 3).map(kind => (
                <span key={kind} className="text-xs text-zinc-500">{orgChartKindLabels[kind] ?? kind}</span>
              ))}
            </div>
          </div>

          {/* App Layer Records Card */}
          <div className="rounded-xl border border-amber-400/30 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-400">App-Layer Records</h2>
              <AppLayerBadge />
            </div>
            <p className="mt-3 text-2xl font-semibold">{statements.length + publications.length + articles.length + events.length + endorsements.length}</p>
            <p className="text-sm text-zinc-400">Public records</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
              <span>{statements.length} statements</span>
              <span>{publications.length} Publications</span>
              <span>{articles.length} articles</span>
              <span>{events.length} events</span>
            </div>
          </div>
        </div>
      </section>

      {/* Safety/Readiness Panel */}
      {demoReadOnly && (
        <section className="mx-auto max-w-7xl px-6 pb-8">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10">
                <svg className="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-amber-200">Read-Only Public Demo</h2>
                <p className="mt-1 text-sm text-zinc-300">
                  Publisher controls are disabled. This view only reads curated fixture records. The write gateway is disabled for public access. First writable family (events) is available in staging only.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Primary Workspace: Directory List + Entity Profile */}
      <section className="mx-auto max-w-7xl px-6 pb-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/* Left: Directory List */}
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <label className="block">
                <span className="text-sm font-medium text-zinc-400">Search directory</span>
                <input 
                  aria-label="Search directory" 
                  value={search} 
                  onChange={(event) => setSearch(event.target.value)} 
                  className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder-zinc-500" 
                  placeholder="Names, handles, DIDs, jurisdictions..." 
                />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs text-zinc-500">Type</span>
                  <select 
                    aria-label="Filter by type" 
                    value={typeFilter} 
                    onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} 
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                  >
                    <option value="all">All types</option>
                    <option value="chapter">Chapter</option>
                    <option value="caucus">Caucus</option>
                    {!foundationV1 && <option value="member-affiliation">Member affiliation</option>}
                    {foundationV1 && <option value="org-unit">Other organization unit</option>}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500">State</span>
                  <select 
                    aria-label="Filter by state" 
                    value={stateFilter} 
                    onChange={(event) => setStateFilter(event.target.value)} 
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                  >
                    <option value="all">All states</option>
                    {chapterStates.map((state) => <option key={state} value={state}>{state}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500">Chapter kind</span>
                  <select
                    aria-label="Filter by chapter kind"
                    value={jurisdictionTypeFilter}
                    onChange={(event) => setJurisdictionTypeFilter(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                  >
                    <option value="all">All kinds</option>
                    <option value="chapter">Chapter</option>
                    <option value="organizing-committee">Organizing committee</option>
                  </select>
                </label>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Showing {visibleEntities.length} of {totalCount} records
              </p>
            </div>

            {/* Entity List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {visibleEntities.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => setSelectedId(entity.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    entity.id === selectedEntity?.id 
                      ? 'border-cyan-400 bg-zinc-900' 
                      : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{entity.name}</h3>
                    <div className="flex gap-1.5">
                      <Badge color={entity.type === 'chapter' ? 'cyan' : entity.type === 'caucus' ? 'violet' : 'slate'}>{entity.type}</Badge>
                    </div>
                  </div>
                  <p className="mt-1.5 text-sm text-zinc-400">{entity.shortName} · {entity.jurisdiction}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge color={entity.verificationStatus === 'verified' ? 'emerald' : entity.verificationStatus === 'disputed' ? 'amber' : 'slate'}>{entity.verificationStatus}</Badge>
                    <span className="text-xs text-zinc-500">{entity.status}</span>
                  </div>
                  {entity.type === 'member-affiliation' && (
                    <p className="mt-2 text-xs text-amber-300">Public prototype member affiliation record; not verified membership.</p>
                  )}
                  {entity.type === 'caucus' && (
                    <p className="mt-2 text-xs text-amber-300">Mock / prototype caucus or working-group data</p>
                  )}
                </button>
              ))}
              {!visibleEntities.length && (
                <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center">
                  <p className="text-sm text-zinc-400">No records match your filters.</p>
                  <p className="mt-1 text-xs text-zinc-500">Try clearing search, type, or state filters.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Entity Profile */}
          <div className="rounded-xl border border-cyan-400/30 bg-zinc-900/50 p-6">
            {selectedEntity ? (
              <div>
                <div className="flex items-center gap-2">
                  <FoundationBadge />
                  <span className="text-xs uppercase tracking-wider text-zinc-500">Foundation Layer</span>
                </div>
                <h2 className="mt-3 text-2xl font-bold">{selectedEntity.name}</h2>
                
                {/* Trust & Status */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="self-center text-xs font-medium uppercase tracking-wider text-zinc-500">{foundationV1 ? 'Authority' : 'Trust label'}</span>
                  <Badge color={selectedEntity.trustLabel === 'official' ? 'emerald' : selectedEntity.trustLabel === 'community-submitted' ? 'violet' : 'slate'}>
                    {selectedEntity.trustLabel}
                  </Badge>
                  <Badge color={selectedEntity.verificationStatus === 'verified' ? 'emerald' : selectedEntity.verificationStatus === 'disputed' ? 'amber' : 'slate'}>
                    {selectedEntity.verificationStatus}
                  </Badge>
                  <Badge color="slate">{selectedEntity.status}</Badge>
                </div>

                {/* Key Details */}
                <dl className="mt-5 grid gap-2 text-sm">
                  <div className="flex justify-between border-b border-zinc-800 pb-2">
                    <dt className="text-zinc-500">Handle</dt>
                    <dd className="font-mono text-cyan-200">{selectedEntity.handle}</dd>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800 pb-2">
                    <dt className="text-zinc-500">DID</dt>
                    <dd className="font-mono text-zinc-300">{selectedEntity.did}</dd>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800 pb-2">
                    <dt className="text-zinc-500">Collection</dt>
                    <dd className="text-zinc-300">{selectedEntity.collection}</dd>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800 pb-2">
                    <dt className="text-zinc-500">Jurisdiction</dt>
                    <dd className="text-zinc-300">{selectedEntity.jurisdiction}</dd>
                  </div>
                  {selectedEntity.verifiedBy && (
                    <div className="flex justify-between border-b border-zinc-800 pb-2">
                      <dt className="text-zinc-500">Verified by</dt>
                      <dd className="text-emerald-200">{selectedEntity.verifiedBy}</dd>
                    </div>
                  )}
                </dl>

                {/* Authority & Status Panel */}
                <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <h3 className="text-lg font-semibold text-cyan-100">Authority & Status</h3>
                  {resolvedAuthority ? (
                    <div className="mt-3 space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Authority status:</span>
                        <Badge color={
                          resolvedAuthority.status === 'valid' ? 'emerald' : 
                          resolvedAuthority.status === 'expired' ? 'amber' : 
                          resolvedAuthority.status === 'revoked' ? 'fuchsia' : 
                          resolvedAuthority.status === 'disputed' ? 'amber' : 'slate'
                        }>{resolvedAuthority.status}</Badge>
                      </div>
                      {resolvedAuthority.record && (
                        <div className="rounded border border-zinc-800 bg-zinc-900 p-2">
                          <p className="text-xs text-zinc-500 mb-1">Current record</p>
                          <p className="font-mono text-xs text-cyan-200 truncate">{resolvedAuthority.record.uri}</p>
                        </div>
                      )}
                      {resolvedAuthority.revisions.length > 0 && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1">Revisions ({resolvedAuthority.revisions.length})</p>
                          <ul className="space-y-1 text-xs text-zinc-400">
                            {resolvedAuthority.revisions.map((revision) => (
                              <li key={`${revision.uri}-${revision.cid}`} className="font-mono">{revision.cid}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {resolvedAuthority.caveats.length > 0 && (
                        <div className="text-xs text-amber-300">
                          {resolvedAuthority.caveats.map(caveat => <p key={caveat}>{caveat}</p>)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">No resolver data loaded.</p>
                  )}
                </section>

                {/* Related Activity Preview */}
                {relatedActivity.length > 0 && (
                  <section className="mt-5">
                    <div className="flex items-center gap-2">
                      <AppLayerBadge />
                      <h3 className="text-lg font-semibold">Related Activity</h3>
                    </div>
                    <div className="mt-3 space-y-2">
                      {relatedActivity.slice(0, 3).map((item) => (
                        <div key={item.uri} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.title}</span>
                            <Badge color={item.type === 'statement' ? 'sky' : item.type === 'event' ? 'amber' : item.type === 'endorsement' ? 'emerald' : 'violet'}>{item.type}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-zinc-400">{item.actorName} · {new Date(item.date).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Record JSON Preview */}
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-400">View record JSON</summary>
                  <pre className="mt-3 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300 max-h-48">
                    {JSON.stringify(selectedEntity.record.record, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center py-12">
                <p className="text-zinc-500">Select an entity to view details</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Org Graph Explorer */}
      <section className="mx-auto max-w-7xl px-6 pb-8">
        <div className="rounded-xl border border-emerald-400/30 bg-zinc-900/30 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FoundationBadge />
                <h2 className="text-xl font-bold">Organization Graph Explorer</h2>
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                Source-linked public organization chart slice · <a href={orgChart.sourceUrl} className="text-cyan-300 hover:underline">Original chart</a> · {orgChart.updatedLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button 
                type="button" 
                onClick={() => { setOrgChartKindFilter('all'); setOrgChartSelectedUnit(''); }} 
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  orgChartKindFilter === 'all' ? 'border-emerald-300 bg-emerald-500/10 text-emerald-200' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                All
              </button>
              {[...new Set(orgChart.units.map((unit) => unit.kind))].map((kind) => (
                <button 
                  key={kind} 
                  type="button" 
                  onClick={() => { setOrgChartKindFilter(kind); setOrgChartSelectedUnit(''); }} 
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    orgChartKindFilter === kind ? 'border-emerald-300 bg-emerald-500/10 text-emerald-200' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {orgChartKindLabels[kind] ?? kind}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
            {/* Unit List */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {orgChartUnitsByKind.map(([kind, units]) => (
                <div key={kind} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <h3 className="text-sm font-medium text-emerald-200">{orgChartKindLabels[kind] ?? kind}</h3>
                  <div className="mt-2 space-y-1">
                    {units.map((unit) => (
                      <button
                        key={unit.uri}
                        type="button"
                        onClick={() => setOrgChartSelectedUnit(unit.uri)}
                        className={`w-full rounded border p-2 text-left text-sm transition ${
                          activeOrgUnit?.uri === unit.uri 
                            ? 'border-cyan-400 bg-zinc-900' 
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <span className="font-medium">{unit.shortName}</span>
                        <span className="text-zinc-500"> — {unit.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Unit Details */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
              {activeOrgUnit ? (
                <div>
                  <h3 className="text-lg font-semibold">{activeOrgUnit.name}</h3>
                  <p className="text-sm text-zinc-500">{orgChartKindLabels[activeOrgUnit.kind] ?? activeOrgUnit.kind}</p>
                  <p className="mt-3 text-sm text-zinc-300">{activeOrgUnit.description}</p>
                  {activeOrgUnit.website && (
                    <a href={activeOrgUnit.website} className="mt-2 inline-block text-sm text-cyan-300 hover:underline">Website →</a>
                  )}
                  
                  <div className="mt-5 grid gap-4">
                    {incomingOrgRelationships.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Incoming ({incomingOrgRelationships.length})</h4>
                        <ul className="mt-2 space-y-1">
                          {incomingOrgRelationships.map((rel) => (
                            <li key={rel.uri} className="rounded border border-zinc-800 bg-zinc-900 p-2 text-xs">
                              <span className="text-emerald-200">{unitName(rel.subjectUri)}</span>
                              <span className="text-zinc-500"> {rel.relationship} </span>
                              <span className="text-cyan-200">{unitName(rel.objectUri)}</span>
                              <p className="mt-1 text-zinc-400">{rel.description}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {outgoingOrgRelationships.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Outgoing ({outgoingOrgRelationships.length})</h4>
                        <ul className="mt-2 space-y-1">
                          {outgoingOrgRelationships.map((rel) => (
                            <li key={rel.uri} className="rounded border border-zinc-800 bg-zinc-900 p-2 text-xs">
                              <span className="text-emerald-200">{unitName(rel.subjectUri)}</span>
                              <span className="text-zinc-500"> {rel.relationship} </span>
                              <span className="text-cyan-200">{unitName(rel.objectUri)}</span>
                              <p className="mt-1 text-zinc-400">{rel.description}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-xs text-amber-300">Prototype caveat: public alignment slice only.</p>
                </div>
              ) : (
                <p className="text-zinc-500">Select a unit to view details</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Public Activity Feed */}
      <section className="mx-auto max-w-7xl px-6 pb-8">
        <div className="rounded-xl border border-violet-400/30 bg-zinc-900/30 p-6">
          <div className="flex items-center gap-2">
            <AppLayerBadge />
            <h2 className="text-xl font-bold">Public Activity Feed</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Unified feed of public statements, articles, endorsements, and events from the app layer built on this foundation.
          </p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {activity.map((item) => (
              <article key={item.uri} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{item.title}</h3>
                  <Badge color={
                    item.type === 'statement' ? 'sky' : 
                    item.type === 'event' ? 'amber' : 
                    item.type === 'endorsement' ? 'emerald' : 'violet'
                  }>{item.type}</Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{item.summary}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                  <span>{item.actorName}</span>
                  <span>·</span>
                  <span>{new Date(item.date).toLocaleDateString()}</span>
                  <span>·</span>
                  <Badge color={item.trustLabel === 'official' ? 'emerald' : 'slate'}>{item.trustLabel}</Badge>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Developer Workbench (only when not read-only) */}
      {!demoReadOnly && !foundationV1 && (
        <section className="mx-auto max-w-7xl px-6 pb-12">
          <div className="rounded-xl border border-fuchsia-400/30 bg-zinc-900/30 p-6">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-fuchsia-400/50 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-fuchsia-200">Developer</span>
              <h2 className="text-xl font-bold">Local Publisher Workbench</h2>
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Local prototype publishing only — creates safe fixture records for the local backend, not real ATProto/PDS publishing or real DSA legitimacy.
            </p>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* Chapter Publisher */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="text-lg font-semibold text-fuchsia-200">Publish Chapter Fixture</h3>
                <p className="mt-1 text-xs text-zinc-500">Create a chapter fixture and send to /api/admin/fixtures/ingest</p>
                <form className="mt-4 grid gap-3" onSubmit={publishPrototypeChapter}>
                  {(['name', 'shortName', 'handle', 'did', 'website', 'jurisdictionName', 'jurisdictionState'] as const).map((field) => (
                    <label key={field} className="block">
                      <span className="text-xs text-zinc-500">{field}</span>
                      <input 
                        aria-label={field} 
                        value={draft[field]} 
                        onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} 
                        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" 
                      />
                    </label>
                  ))}
                  <button type="submit" className="mt-2 rounded-lg border border-fuchsia-400/50 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-500/30">
                    Publish Fixture
                  </button>
                </form>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">Preview JSON</summary>
                  <pre className="mt-2 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-300 max-h-32">
                    {JSON.stringify(preview, null, 2)}
                  </pre>
                </details>
              </div>

              {/* Verification Publisher */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="text-lg font-semibold text-cyan-200">Publish Verification Assertion</h3>
                <p className="mt-1 text-xs text-zinc-500">Create a verification/dispute assertion fixture</p>
                <p className="mt-1 text-xs text-amber-300">Does not create real DSA legitimacy or membership proof.</p>
                <form className="mt-4 grid gap-3" onSubmit={publishVerificationAssertion}>
                  {(['subjectUri', 'subjectDid', 'issuerDid', 'issuerHandle', 'reason'] as const).map((field) => (
                    <label key={field} className="block">
                      <span className="text-xs text-zinc-500">{field}</span>
                      <input 
                        aria-label={field} 
                        value={verificationDraft[field]} 
                        onChange={(event) => setVerificationDraft((current) => ({ ...current, [field]: event.target.value }))} 
                        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" 
                      />
                    </label>
                  ))}
                  <label className="block">
                    <span className="text-xs text-zinc-500">assertion</span>
                    <select 
                      aria-label="assertion" 
                      value={verificationDraft.assertion} 
                      onChange={(event) => setVerificationDraft((current) => ({ ...current, assertion: event.target.value as VerificationDraft['assertion'] }))} 
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    >
                      <option value="verified">verified</option>
                      <option value="disputed">disputed</option>
                      <option value="revoked">revoked</option>
                      <option value="self-declared">self-declared</option>
                    </select>
                  </label>
                  <button type="submit" className="mt-2 rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/30">
                    Publish Assertion
                  </button>
                </form>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">Preview JSON</summary>
                  <pre className="mt-2 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-300 max-h-32">
                    {JSON.stringify(verificationPreview, null, 2)}
                  </pre>
                </details>
              </div>
            </div>

            {submitState && (
              <div className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-500/5 p-3">
                <p className="text-sm text-cyan-200">{submitState}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Read-only message when demoReadOnly */}
      {demoReadOnly && (
        <section className="mx-auto max-w-7xl px-6 pb-12">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-400">Developer</span>
              <h2 className="text-xl font-bold text-zinc-400">Publishing unavailable</h2>
            </div>
            <p className="mt-3 text-sm text-zinc-500">
              Publisher controls are disabled for the public demo. This view only reads curated fixture records.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

export default function App(props: AppProps) {
  if (import.meta.env.VITE_FOUNDATION_V1 === 'true') {
    return <FoundationEventsApp apiBase={import.meta.env.VITE_API_URL ?? 'http://localhost:8080'} />;
  }
  return <LegacyApp {...props} />;
}
