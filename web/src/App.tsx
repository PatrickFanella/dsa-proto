import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { buildChapterFixtureEnvelope, buildVerificationFixtureEnvelope, createDefaultChapterDraft, createDefaultVerificationDraft, type ChapterDraft, type VerificationDraft } from './publisher';

export type DirectoryCard = {
  id: string;
  name: string;
  shortName: string;
  type: 'chapter' | 'caucus' | 'member-affiliation';
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
    trustLabel: 'mock-official',
    verificationStatus: 'mock-verified',
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
    trustLabel: 'experimental',
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
  { uri: 'at://did:plc:nycdsa/org.dsa.statement.public/welcome-note', did: 'did:plc:nycdsa', handle: 'nyc.dsausa.org', collection: 'org.dsa.statement.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'mock-official', title: 'Welcome to the prototype chapter feed', summary: 'A safe sample statement for the local demo.', bodyMarkdown: 'This prototype statement shows how a chapter post can point back to the registry.', issuerUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', issuerName: 'New York City DSA', publishedAt: '2026-07-01T00:00:00.000Z', topics: ['prototype', 'directory'], relatedEntityUris: ['at://did:plc:nycdsa/org.dsa.profile.chapter/self'], status: 'published', record: { record: { $type: 'org.dsa.statement.public' } } },
  { uri: 'at://did:plc:climatecaucus/org.dsa.statement.public/community-note', did: 'did:plc:climatecaucus', handle: 'climate.dsausa.org', collection: 'org.dsa.statement.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'experimental', title: 'Climate caucus demo update', summary: 'Prototype caucus note linking back to the public directory.', bodyMarkdown: 'This is a short demo statement about public-facing organizing and education.', issuerUri: 'at://did:plc:climatecaucus/org.dsa.profile.caucus/self', issuerName: 'DSA Climate Caucus', publishedAt: '2026-07-01T00:00:00.000Z', topics: ['climate', 'prototype'], relatedEntityUris: ['at://did:plc:climatecaucus/org.dsa.profile.caucus/self'], status: 'published', record: { record: { $type: 'org.dsa.statement.public' } } },
  { uri: 'at://did:plc:npc/org.dsa.statement.public/governance-note', did: 'did:plc:npc', handle: 'dsausa.org', collection: 'org.dsa.statement.public', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'mock-official', title: 'Public governance demo note', summary: 'A short org-unit statement for the prototype feed.', bodyMarkdown: 'Public prototype note for governance and publication examples only.', issuerUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', issuerName: 'National Political Committee', publishedAt: '2026-07-01T00:00:00.000Z', topics: ['governance', 'publication'], relatedEntityUris: ['at://did:plc:npc/org.dsa.profile.orgUnit/self', 'at://did:plc:demleft/org.dsa.profile.orgUnit/self'], status: 'published', record: { record: { $type: 'org.dsa.statement.public' } } },
];

const fallbackPublications: PublicationProfileCard[] = [
  { uri: 'at://did:plc:demleft/org.dsa.publication.profile/self', did: 'did:plc:demleft', handle: 'dsausa.org', collection: 'org.dsa.publication.profile', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'mock-official', name: 'Democratic Left', shortName: 'Dem Left', publisherUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', publisherName: 'National Political Committee', website: 'https://www.dsausa.org/democratic-left/', status: 'active', record: { record: { $type: 'org.dsa.publication.profile' } } },
];

const fallbackArticles: PublicationArticleCard[] = [
  { uri: 'at://did:plc:demleft/org.dsa.publication.article/welcome-piece', did: 'did:plc:demleft', handle: 'dsausa.org', collection: 'org.dsa.publication.article', indexedAt: '2026-07-01T00:00:00.000Z', trustLabel: 'mock-official', publicationUri: 'at://did:plc:demleft/org.dsa.publication.profile/self', publicationName: 'Democratic Left', title: 'A public demo article for the prototype', summary: 'Example article showing publication/article records end-to-end.', bodyMarkdown: 'This prototype article links the publication layer back to a chapter and the org chart.', authorName: 'DSA editorial collective', publishedAt: '2026-07-01T00:00:00.000Z', topics: ['prototype', 'publication'], relatedEntityUris: ['at://did:plc:npc/org.dsa.profile.orgUnit/self', 'at://did:plc:nycdsa/org.dsa.profile.chapter/self'], status: 'published', record: { record: { $type: 'org.dsa.publication.article' } } },
];

export default function App({ initialEntities = fallbackEntities, initialOrgChart = fallbackOrgChart, initialRegistryHealth = fallbackRegistryHealth, initialSearch = '', initialTypeFilter = 'all' }: { initialEntities?: DirectoryCard[]; initialOrgChart?: OrgChartPayload; initialRegistryHealth?: RegistryHealthPayload; initialSearch?: string; initialTypeFilter?: 'all' | DirectoryCard['type'] }) {
  const [entities, setEntities] = useState(initialEntities);
  const [orgChart, setOrgChart] = useState(initialOrgChart);
  const [registryHealth, setRegistryHealth] = useState(initialRegistryHealth);
  const [search, setSearch] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState<'all' | DirectoryCard['type']>(initialTypeFilter);
  const [stateFilter, setStateFilter] = useState('all');
  const [jurisdictionTypeFilter, setJurisdictionTypeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(initialEntities[0]?.id ?? '');
  const [orgChartKindFilter, setOrgChartKindFilter] = useState<string>('all');
  const [orgChartSelectedUnit, setOrgChartSelectedUnit] = useState<string>('');
  const [statements, setStatements] = useState(fallbackStatements);
  const [publications, setPublications] = useState(fallbackPublications);
  const [articles, setArticles] = useState(fallbackArticles);
  const [draft, setDraft] = useState<ChapterDraft>(createDefaultChapterDraft());
  const [verificationDraft, setVerificationDraft] = useState<VerificationDraft>(createDefaultVerificationDraft());
  const [submitState, setSubmitState] = useState<string>('');
  const preview = useMemo(() => buildChapterFixtureEnvelope(draft), [draft]);
  const verificationPreview = useMemo(() => buildVerificationFixtureEnvelope(verificationDraft), [verificationDraft]);

  useEffect(() => {
    const url = new URL(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/entities`);
    if (typeFilter !== 'all') url.searchParams.set('type', typeFilter);
    if (search.trim()) url.searchParams.set('q', search.trim());
    if (stateFilter !== 'all') url.searchParams.set('state', stateFilter);
    if (jurisdictionTypeFilter !== 'all') url.searchParams.set('jurisdictionType', jurisdictionTypeFilter);
    url.searchParams.set('limit', '1000');
    fetch(url.toString())
      .then((response) => response.json())
      .then((payload) => {
        const nextEntities = payload.data ?? initialEntities;
        setEntities(nextEntities);
        setSelectedId((current) => (nextEntities.some((entity: DirectoryCard) => entity.id === current) ? current : nextEntities[0]?.id ?? ''));
      })
      .catch(() => setEntities(initialEntities));
  }, [initialEntities, search, typeFilter, stateFilter, jurisdictionTypeFilter]);

  useEffect(() => {
    const url = new URL(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/org-chart`);
    if (orgChartKindFilter !== 'all') url.searchParams.set('kind', orgChartKindFilter);
    if (orgChartSelectedUnit) url.searchParams.set('unit', orgChartSelectedUnit);
    fetch(url.toString()).then((response) => response.json()).then((payload) => setOrgChart(payload)).catch(() => setOrgChart(initialOrgChart));
  }, [initialOrgChart, orgChartKindFilter, orgChartSelectedUnit]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/registry/health`).then((response) => response.json()).then((payload) => setRegistryHealth(payload)).catch(() => setRegistryHealth(initialRegistryHealth));
  }, [initialRegistryHealth]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/statements`).then((response) => response.json()).then((payload) => setStatements(payload.data ?? fallbackStatements)).catch(() => setStatements(fallbackStatements));
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/publications`).then((response) => response.json()).then((payload) => setPublications(payload.data ?? fallbackPublications)).catch(() => setPublications(fallbackPublications));
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/articles`).then((response) => response.json()).then((payload) => setArticles(payload.data ?? fallbackArticles)).catch(() => setArticles(fallbackArticles));
  }, []);

  const chapterStates = useMemo(() => [...new Set(entities.filter((entity) => entity.type === 'chapter' && entity.jurisdictionState).map((entity) => entity.jurisdictionState as string))].sort(), [entities]);
  const totalCount = entities.length;
  const chapterCount = entities.filter((entity) => entity.type === 'chapter').length;
  const visibleEntities = useMemo(() => entities.filter((entity) => {
    const matchesType = typeFilter === 'all' || entity.type === typeFilter;
    const matchesSearch = !search.trim() || `${entity.name} ${entity.shortName} ${entity.handle} ${entity.did} ${entity.jurisdiction} ${entity.organizationHandle ?? ''} ${entity.memberHandle ?? ''} ${entity.focusArea ?? ''}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesState = stateFilter === 'all' || entity.jurisdictionState === stateFilter;
    const matchesJurisdictionType = jurisdictionTypeFilter === 'all' || entity.jurisdictionType === jurisdictionTypeFilter;
    return matchesType && matchesSearch && matchesState && matchesJurisdictionType;
  }), [entities, search, typeFilter, stateFilter, jurisdictionTypeFilter]);

  const selectedEntity = visibleEntities.find((entity) => entity.id === selectedId) ?? visibleEntities[0];
  const relatedStatements = useMemo(() => selectedEntity ? statements.filter((statement) => statement.issuerUri === selectedEntity.id || statement.relatedEntityUris.includes(selectedEntity.id)) : [], [selectedEntity, statements]);
  const relatedArticles = useMemo(() => selectedEntity ? articles.filter((article) => article.relatedEntityUris.includes(selectedEntity.id)) : [], [selectedEntity, articles]);
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
    <main className="min-h-screen bg-zinc-950 px-8 py-12 text-zinc-100">
      <section className="mx-auto max-w-6xl rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-300">DSA ATProto prototype</p>
        <h1 className="mt-4 text-4xl font-bold">Directory entities</h1>
        <p className="mt-4 text-zinc-300">Mocked public chapter, caucus, member-affiliation, and verification assertion records are shown below as prototype data.</p>
        <p className="mt-2 text-sm text-amber-300">Verification labels are prototype trust metadata only, not real DSA legitimacy or membership proof.</p>
        <p className="mt-2 text-sm text-cyan-300">Local prototype publishing only: these forms create safe fixture records for the mock backend, not real ATProto/PDS publishing or real DSA legitimacy.</p>
        <section className="mt-8 rounded-xl border border-emerald-400/30 bg-zinc-950 p-5">
          <h2 className="text-2xl font-semibold">How DSA operates</h2>
          <p className="mt-2 text-sm text-zinc-300">Source-linked public organization chart slice.</p>
          <p className="mt-1 text-sm text-emerald-200"><a href={orgChart.sourceUrl} className="underline">Organization chart source</a> · {orgChart.updatedLabel}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <button type="button" onClick={() => { setOrgChartKindFilter('all'); setOrgChartSelectedUnit(''); }} className={`rounded-full border px-3 py-1 ${orgChartKindFilter === 'all' ? 'border-emerald-300 text-emerald-100' : 'border-zinc-700 text-zinc-300'}`}>All kinds</button>
            {[...new Set(orgChart.units.map((unit) => unit.kind))].map((kind) => <button key={kind} type="button" onClick={() => { setOrgChartKindFilter(kind); setOrgChartSelectedUnit(''); }} className={`rounded-full border px-3 py-1 ${orgChartKindFilter === kind ? 'border-emerald-300 text-emerald-100' : 'border-zinc-700 text-zinc-300'}`}>{orgChartKindLabels[kind] ?? kind}</button>)}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-4">
              {orgChartUnitsByKind.map(([kind, units]) => (
                <section key={kind} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                  <h3 className="text-lg font-semibold">{orgChartKindLabels[kind] ?? kind}</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {units.map((unit) => <li key={unit.uri}><button type="button" onClick={() => setOrgChartSelectedUnit(unit.uri)} className={`w-full rounded-lg border px-3 py-2 text-left ${activeOrgUnit?.uri === unit.uri ? 'border-cyan-400 bg-zinc-950' : 'border-zinc-800 bg-zinc-950'}`}><strong>{unit.shortName}</strong> — {unit.name}<div className="text-zinc-400">{unit.description}</div></button></li>)}
                  </ul>
                </section>
              ))}
            </div>
            <aside className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
              {activeOrgUnit ? (
                <>
                  <h3 className="text-xl font-semibold">{activeOrgUnit.name}</h3>
                  <p className="mt-1 text-zinc-400">{orgChartKindLabels[activeOrgUnit.kind] ?? activeOrgUnit.kind}</p>
                  <p className="mt-3 text-zinc-200">{activeOrgUnit.description}</p>
                  {activeOrgUnit.website ? <p className="mt-2"><a href={activeOrgUnit.website} className="underline">Source link</a></p> : null}
                  <p className="mt-2 text-amber-300">Prototype caveat: public alignment slice only.</p>
                  <div className="mt-4 grid gap-4">
                    <div>
                      <h4 className="font-semibold">Incoming relationships</h4>
                      <ul className="mt-2 space-y-2">{incomingOrgRelationships.map((relationship) => <li key={relationship.uri} className="rounded border border-zinc-800 bg-zinc-950 p-2">{unitName(relationship.subjectUri)} {relationship.relationship} {unitName(relationship.objectUri)}</li>)}</ul>
                    </div>
                    <div>
                      <h4 className="font-semibold">Outgoing relationships</h4>
                      <ul className="mt-2 space-y-2">{outgoingOrgRelationships.map((relationship) => <li key={relationship.uri} className="rounded border border-zinc-800 bg-zinc-950 p-2">{unitName(relationship.subjectUri)} {relationship.relationship} {unitName(relationship.objectUri)}</li>)}</ul>
                    </div>
                    <div>
                      <h4 className="font-semibold">Relationships summary</h4>
                      <ul className="mt-2 space-y-2">{selectedOrgRelationships.map((relationship) => <li key={relationship.uri} className="rounded border border-zinc-800 bg-zinc-950 p-2">{relationship.description}</li>)}</ul>
                    </div>
                  </div>
                </>
              ) : null}
            </aside>
          </div>
        </section>
        <section className="mt-8 rounded-xl border border-lime-400/30 bg-zinc-950 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl font-semibold">Registry health</h2>
            <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${registryHealth.status === 'ok' ? 'border-emerald-400/50 text-emerald-200' : registryHealth.status === 'warning' ? 'border-amber-400/50 text-amber-200' : 'border-rose-400/50 text-rose-200'}`}>{registryHealth.status.toUpperCase()}</span>
          </div>
          <p className="mt-2 text-sm text-zinc-300">Last checked from fixture file: {registryHealth.fileLabel}</p>
          <p className="mt-3 text-sm text-zinc-200">{registryHealth.directoryCountsByType.chapter ?? 0} chapters, {registryHealth.directoryCountsByType.caucus ?? 0} caucuses, {registryHealth.totalRecords} total records</p>
          <p className="mt-1 text-sm text-zinc-400">Invalid: {registryHealth.invalidCount} · Duplicates: {registryHealth.duplicateCount}</p>
          {registryHealth.invalidRecords.length || registryHealth.duplicateCount ? (
            <div className="mt-4 grid gap-2 text-sm text-amber-200">
              {registryHealth.invalidRecords.length ? <p>Invalid records present in the canonical fixture file.</p> : null}
              {Object.entries(registryHealth.duplicates).flatMap(([label, entries]) => entries.map((entry) => <p key={`${label}-${entry.value}`}>Duplicate {label}: {entry.value}</p>))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-emerald-200">Canonical registry fixture set is healthy.</p>
          )}
        </section>
        <section className="mt-8 rounded-xl border border-sky-400/30 bg-zinc-950 p-5">
          <h2 className="text-2xl font-semibold">Public publications</h2>
          <p className="mt-2 text-sm text-zinc-300">Publication profiles and articles are loaded from the prototype backend and kept out of directory entities.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {publications.map((publication) => (
              <article key={publication.uri} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{publication.name}</h3>
                  <span className="rounded-full border border-violet-400/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-violet-200">{publication.status}</span>
                </div>
                <p className="mt-2 text-zinc-300">{publication.shortName}</p>
                <p className="mt-2 text-zinc-400">Publisher: {publication.publisherName}</p>
                <p className="mt-1 text-zinc-500">{publication.collection} · {publication.trustLabel}</p>
                {publication.website ? <p className="mt-1 text-zinc-500"><a className="underline" href={publication.website}>Website</a></p> : null}
              </article>
            ))}
            {articles.map((article) => (
              <article key={article.uri} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{article.title}</h3>
                  <span className="rounded-full border border-sky-400/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-sky-200">{article.status}</span>
                </div>
                <p className="mt-2 text-zinc-300">{article.summary}</p>
                <p className="mt-2 text-zinc-400">Publication: {article.publicationName}</p>
                <p className="mt-1 text-zinc-500">Topics: {article.topics.join(', ')}</p>
                <p className="mt-1 text-zinc-500">Related URIs: {article.relatedEntityUris.join(', ')}</p>
                <p className="mt-1 text-zinc-500">{article.collection} · {article.trustLabel}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="mt-8 rounded-xl border border-sky-400/30 bg-zinc-950 p-5">
          <h2 className="text-2xl font-semibold">Public statements</h2>
          <p className="mt-2 text-sm text-zinc-300">Public statement records are loaded from the prototype backend and kept out of directory entities.</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {statements.map((statement) => (
              <article key={statement.uri} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{statement.title}</h3>
                  <span className="rounded-full border border-sky-400/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-sky-200">{statement.status}</span>
                </div>
                <p className="mt-2 text-zinc-300">{statement.summary}</p>
                <p className="mt-2 text-zinc-400">Issuer: {statement.issuerName}</p>
                <p className="mt-1 text-zinc-500">Published: {statement.publishedAt}</p>
                <p className="mt-1 text-zinc-500">Topics: {statement.topics.join(', ')}</p>
                <p className="mt-1 text-zinc-500">Related URIs: {statement.relatedEntityUris.join(', ')}</p>
                <p className="mt-1 text-zinc-500">{statement.collection} · {statement.trustLabel}</p>
              </article>
            ))}
          </div>
        </section>
        <div className="mt-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-[1fr_auto]">
          <label className="grid gap-2 text-sm text-zinc-300">
            Search
            <input aria-label="Search directory" value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" placeholder="Search names, handles, DIDs, jurisdictions" />
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Type
            <select aria-label="Filter by type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100">
              <option value="all">All</option>
              <option value="chapter">Chapter</option>
              <option value="caucus">Caucus</option>
              <option value="member-affiliation">Member affiliation</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            State
            <select aria-label="Filter by state" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100">
              <option value="all">All states</option>
              {chapterStates.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-zinc-300">
            Chapter kind
            <select aria-label="Filter by chapter kind" value={jurisdictionTypeFilter} onChange={(event) => setJurisdictionTypeFilter(event.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100">
              <option value="all">All kinds</option>
              <option value="chapter">Chapter</option>
              <option value="organizing-committee">Organizing committee</option>
            </select>
          </label>
        </div>
        <p className="mt-4 text-sm text-zinc-300">Showing {visibleEntities.length} of {totalCount} records{typeFilter === 'chapter' ? ` · ${chapterCount} chapters total` : ''}</p>
        <section className="mt-8 rounded-xl border border-fuchsia-400/30 bg-zinc-950 p-5">
          <h2 className="text-2xl font-semibold">Local prototype publisher</h2>
          <p className="mt-2 text-sm text-zinc-300">Create a chapter fixture and send it to <code>/api/admin/fixtures/ingest</code>.</p>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={publishPrototypeChapter}>
            {(['name', 'shortName', 'handle', 'did', 'website', 'jurisdictionName', 'jurisdictionState'] as const).map((field) => (
              <label key={field} className="grid gap-2 text-sm text-zinc-300">
                {field}
                <input aria-label={field} value={draft[field]} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" />
              </label>
            ))}
            <button type="submit" className="rounded-lg border border-fuchsia-400/50 bg-fuchsia-500/20 px-4 py-2 text-sm font-semibold text-fuchsia-100 md:col-span-2">Publish local fixture</button>
          </form>
          <p className="mt-3 text-sm text-amber-300">Member-affiliation safety copy still applies; this publisher only emits a chapter fixture.</p>
          {submitState ? <p className="mt-3 text-sm text-cyan-200">{submitState}</p> : null}
          <pre className="mt-4 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-200">{JSON.stringify(preview, null, 2)}</pre>
        </section>
        <section className="mt-8 rounded-xl border border-cyan-400/30 bg-zinc-950 p-5">
          <h2 className="text-2xl font-semibold">Local verification assertion publisher</h2>
          <p className="mt-2 text-sm text-zinc-300">Create a local mock verification/dispute assertion and send it to <code>/api/admin/fixtures/ingest</code>.</p>
          <p className="mt-2 text-sm text-amber-300">This does not create real DSA legitimacy, membership proof, or real PDS records.</p>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={publishVerificationAssertion}>
            {(['subjectUri', 'subjectDid', 'issuerDid', 'issuerHandle', 'reason'] as const).map((field) => (
              <label key={field} className="grid gap-2 text-sm text-zinc-300">
                {field}
                <input aria-label={field} value={verificationDraft[field]} onChange={(event) => setVerificationDraft((current) => ({ ...current, [field]: event.target.value }))} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100" />
              </label>
            ))}
            <label className="grid gap-2 text-sm text-zinc-300">
              assertion
              <select aria-label="assertion" value={verificationDraft.assertion} onChange={(event) => setVerificationDraft((current) => ({ ...current, assertion: event.target.value as VerificationDraft['assertion'] }))} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100">
                <option value="verified">verified</option>
                <option value="disputed">disputed</option>
                <option value="revoked">revoked</option>
                <option value="self-declared">self-declared</option>
              </select>
            </label>
            <button type="submit" className="rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 md:col-span-2">Publish verification assertion</button>
          </form>
          <p className="mt-3 text-sm text-amber-300">Member-affiliation safety copy still applies; this publisher only emits a local verification assertion fixture.</p>
          <pre className="mt-4 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-200">{JSON.stringify(verificationPreview, null, 2)}</pre>
        </section>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="grid gap-4">
            {visibleEntities.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => setSelectedId(entity.id)}
                className={`rounded-xl border p-5 text-left transition ${entity.id === selectedEntity?.id ? 'border-fuchsia-400 bg-zinc-950' : 'border-zinc-800 bg-zinc-950'}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold">{entity.name}</h2>
                  <div className="flex gap-2 text-xs uppercase tracking-[0.2em]">
                    <span className="rounded-full border border-fuchsia-400/40 px-3 py-1 text-fuchsia-200">{entity.type}</span>
                    <span className="rounded-full border border-cyan-400/40 px-3 py-1 text-cyan-200">{entity.verificationStatus}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{entity.shortName} · {entity.jurisdiction} · {entity.status}</p>
                {entity.type === 'caucus' ? <p className="mt-2 text-sm text-amber-300">Mock / prototype caucus or working-group data</p> : null}
                {entity.type === 'member-affiliation' ? <p className="mt-2 text-sm text-amber-300">Public prototype member affiliation record; not verified membership.</p> : null}
                <dl className="mt-3 grid gap-2 text-sm text-zinc-300">
                  <div><dt className="inline text-zinc-500">Handle:</dt> <dd className="inline">{entity.handle}</dd></div>
                  <div><dt className="inline text-zinc-500">Record type:</dt> <dd className="inline">{entity.collection}</dd></div>
                  <div><dt className="inline text-zinc-500">Entity type:</dt> <dd className="inline">{entity.type}</dd></div>
                  <div><dt className="inline text-zinc-500">DID:</dt> <dd className="inline">{entity.did}</dd></div>
                  <div><dt className="inline text-zinc-500">AT URI:</dt> <dd className="inline">{entity.id}</dd></div>
                  {entity.type === 'member-affiliation' ? <div><dt className="inline text-zinc-500">Public role:</dt> <dd className="inline">{entity.publicRole ?? 'self-declared'}</dd></div> : null}
                  <div><dt className="inline text-zinc-500">Verification:</dt> <dd className="inline">{entity.verificationStatus}</dd></div>
                  {entity.verifiedBy ? <div><dt className="inline text-zinc-500">Verified by:</dt> <dd className="inline">{entity.verifiedBy}</dd></div> : null}
                </dl>
              </button>
            ))}
            {!visibleEntities.length ? <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">No records match these filters. Try clearing state, kind, search, or type.</p> : null}
          </div>
          <aside className="rounded-xl border border-cyan-400/40 bg-zinc-950 p-5">
            {selectedEntity ? (
              <>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Protocol provenance</p>
                <h2 className="mt-3 text-2xl font-semibold">{selectedEntity.name}</h2>
                <dl className="mt-4 grid gap-2 text-sm text-zinc-300">
                  <div><dt className="inline text-zinc-500">Entity type:</dt> <dd className="inline">{selectedEntity.type}</dd></div>
                  <div><dt className="inline text-zinc-500">DID:</dt> <dd className="inline">{selectedEntity.did}</dd></div>
                  <div><dt className="inline text-zinc-500">Handle:</dt> <dd className="inline">{selectedEntity.handle}</dd></div>
                  <div><dt className="inline text-zinc-500">Collection:</dt> <dd className="inline">{selectedEntity.collection}</dd></div>
                  <div><dt className="inline text-zinc-500">AT URI:</dt> <dd className="inline">{selectedEntity.id}</dd></div>
                  <div><dt className="inline text-zinc-500">Trust label:</dt> <dd className="inline">{selectedEntity.trustLabel}</dd></div>
                  <div><dt className="inline text-zinc-500">Verification status:</dt> <dd className="inline">{selectedEntity.verificationStatus}</dd></div>
                  {selectedEntity.verifiedBy ? <div><dt className="inline text-zinc-500">Verified by:</dt> <dd className="inline">{selectedEntity.verifiedBy}</dd></div> : null}
                </dl>
                <p className="mt-4 text-sm text-amber-300">{selectedEntity.verificationReason ?? (selectedEntity.type === 'member-affiliation' ? 'Public prototype member affiliation record; not verified membership.' : selectedEntity.type === 'caucus' ? 'Mock / prototype caucus or working-group data' : 'Public chapter directory record.')}</p>
                <section className="mt-5 rounded-lg border border-sky-400/30 bg-zinc-900 p-4">
                  <h3 className="text-lg font-semibold">Related public statements</h3>
                  {relatedStatements.length ? (
                    <div className="mt-3 grid gap-3">
                      {relatedStatements.map((statement) => (
                        <article key={statement.uri} className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="font-semibold">{statement.title}</h4>
                            <span className="rounded-full border border-sky-400/40 px-2 py-0.5 text-xs uppercase tracking-[0.2em] text-sky-200">{statement.status}</span>
                          </div>
                          <p className="mt-2 text-zinc-300">{statement.summary}</p>
                          <p className="mt-2 text-zinc-400">Issuer: {statement.issuerName}</p>
                          <p className="mt-1 text-zinc-500">Topics: {statement.topics.join(', ')}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-400">No public statements linked to this entity yet.</p>
                  )}
                </section>
                <section className="mt-5 rounded-lg border border-violet-400/30 bg-zinc-900 p-4">
                  <h3 className="text-lg font-semibold">Related publication articles</h3>
                  {relatedArticles.length ? (
                    <div className="mt-3 grid gap-3">
                      {relatedArticles.map((article) => (
                        <article key={article.uri} className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="font-semibold">{article.title}</h4>
                            <span className="rounded-full border border-violet-400/40 px-2 py-0.5 text-xs uppercase tracking-[0.2em] text-violet-200">{article.status}</span>
                          </div>
                          <p className="mt-2 text-zinc-300">{article.summary}</p>
                          <p className="mt-2 text-zinc-400">Publication: {article.publicationName}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-400">No publication articles linked to this entity yet.</p>
                  )}
                </section>
                <pre className="mt-4 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-200">{JSON.stringify(selectedEntity.record.record, null, 2)}</pre>
              </>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
