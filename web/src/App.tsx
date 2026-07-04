import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { buildChapterFixtureEnvelope, createDefaultChapterDraft, type ChapterDraft } from './publisher';

export type DirectoryCard = {
  id: string;
  name: string;
  shortName: string;
  type: 'chapter' | 'caucus' | 'member-affiliation';
  collection: string;
  handle: string;
  did: string;
  jurisdiction: string;
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

export default function App({ initialEntities = fallbackEntities, initialSearch = '', initialTypeFilter = 'all' }: { initialEntities?: DirectoryCard[]; initialSearch?: string; initialTypeFilter?: 'all' | DirectoryCard['type'] }) {
  const [entities, setEntities] = useState(initialEntities);
  const [search, setSearch] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState<'all' | DirectoryCard['type']>(initialTypeFilter);
  const [selectedId, setSelectedId] = useState(initialEntities[0]?.id ?? '');
  const [draft, setDraft] = useState<ChapterDraft>(createDefaultChapterDraft());
  const [submitState, setSubmitState] = useState<string>('');
  const preview = useMemo(() => buildChapterFixtureEnvelope(draft), [draft]);

  useEffect(() => {
    const url = new URL(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/entities`);
    if (typeFilter !== 'all') url.searchParams.set('type', typeFilter);
    if (search.trim()) url.searchParams.set('q', search.trim());
    fetch(url.toString())
      .then((response) => response.json())
      .then((payload) => {
        const nextEntities = payload.data ?? initialEntities;
        setEntities(nextEntities);
        setSelectedId((current) => (nextEntities.some((entity: DirectoryCard) => entity.id === current) ? current : nextEntities[0]?.id ?? ''));
      })
      .catch(() => setEntities(initialEntities));
  }, [initialEntities, search, typeFilter]);

  const visibleEntities = useMemo(() => entities.filter((entity) => {
    const matchesType = typeFilter === 'all' || entity.type === typeFilter;
    const matchesSearch = !search.trim() || `${entity.name} ${entity.shortName} ${entity.handle} ${entity.did} ${entity.jurisdiction} ${entity.organizationHandle ?? ''} ${entity.memberHandle ?? ''} ${entity.focusArea ?? ''}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesType && matchesSearch;
  }), [entities, search, typeFilter]);

  const selectedEntity = visibleEntities.find((entity) => entity.id === selectedId) ?? visibleEntities[0];

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

  return (
    <main className="min-h-screen bg-zinc-950 px-8 py-12 text-zinc-100">
      <section className="mx-auto max-w-6xl rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-300">DSA ATProto prototype</p>
        <h1 className="mt-4 text-4xl font-bold">Directory entities</h1>
        <p className="mt-4 text-zinc-300">Mocked public chapter, caucus, member-affiliation, and verification assertion records are shown below as prototype data.</p>
        <p className="mt-2 text-sm text-amber-300">Verification labels are prototype trust metadata only, not real DSA legitimacy or membership proof.</p>
        <p className="mt-2 text-sm text-cyan-300">Local prototype publishing only: this form creates a safe fixture record for the mock backend, not real ATProto/PDS publishing or real DSA verification.</p>
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
        </div>
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
            {!visibleEntities.length ? <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">No directory records match the current search and type filters.</p> : null}
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
                <pre className="mt-4 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-200">{JSON.stringify(selectedEntity.record.record, null, 2)}</pre>
              </>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
