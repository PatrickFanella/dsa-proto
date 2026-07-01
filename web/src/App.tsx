import { useEffect, useState } from 'react';

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
  status: string;
  focusArea?: string;
  publicRole?: string;
  memberHandle?: string;
  organizationHandle?: string;
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
    status: 'active',
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
    status: 'active',
    focusArea: 'climate justice organizing',
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
    status: 'active',
    publicRole: 'neighborhood canvass volunteer',
    memberHandle: 'member.alpha.example',
    organizationHandle: 'nyc.dsausa.org',
  },
];

export default function App({ initialEntities = fallbackEntities }: { initialEntities?: DirectoryCard[] }) {
  const [entities, setEntities] = useState(initialEntities);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/entities`)
      .then((response) => response.json())
      .then((payload) => setEntities(payload.data ?? initialEntities))
      .catch(() => setEntities(initialEntities));
  }, [initialEntities]);

  return (
    <main className="min-h-screen bg-zinc-950 px-8 py-12 text-zinc-100">
      <section className="mx-auto max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-300">DSA ATProto prototype</p>
        <h1 className="mt-4 text-4xl font-bold">Directory entities</h1>
        <p className="mt-4 text-zinc-300">Mocked public chapter, caucus, and member-affiliation records are shown below as prototype data.</p>
        <p className="mt-2 text-sm text-amber-300">Member examples are public prototype records, not verified membership records, and exclude private roster data.</p>
        <div className="mt-6 grid gap-4">
          {entities.map((entity) => (
            <article key={entity.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">{entity.name}</h2>
                <div className="flex gap-2 text-xs uppercase tracking-[0.2em]">
                  <span className="rounded-full border border-fuchsia-400/40 px-3 py-1 text-fuchsia-200">{entity.type}</span>
                  <span className="rounded-full border border-cyan-400/40 px-3 py-1 text-cyan-200">{entity.trustLabel}</span>
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
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
