import { useEffect, useState } from 'react';

export type ChapterCard = {
  id: string;
  name: string;
  shortName: string;
  collection: string;
  handle: string;
  did: string;
  jurisdiction: string;
  trustLabel: string;
  status: string;
};

const fallbackChapters: ChapterCard[] = [
  {
    id: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
    name: 'New York City DSA',
    shortName: 'NYC-DSA',
    collection: 'org.dsa.profile.chapter',
    handle: 'nyc.dsausa.org',
    did: 'did:plc:nycdsa',
    jurisdiction: 'New York City, NY',
    trustLabel: 'mock-official',
    status: 'active',
  },
];

export default function App({ initialChapters = fallbackChapters }: { initialChapters?: ChapterCard[] }) {
  const [chapters, setChapters] = useState(initialChapters);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080'}/api/chapters`)
      .then((response) => response.json())
      .then((payload) => setChapters(payload.data ?? initialChapters))
      .catch(() => setChapters(initialChapters));
  }, [initialChapters]);

  return (
    <main className="min-h-screen bg-zinc-950 px-8 py-12 text-zinc-100">
      <section className="mx-auto max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-300">DSA ATProto prototype</p>
        <h1 className="mt-4 text-4xl font-bold">Chapter directory</h1>
        <p className="mt-4 text-zinc-300">Mocked public chapter records are shown below as prototype data.</p>
        <div className="mt-6 grid gap-4">
          {chapters.map((chapter) => (
            <article key={chapter.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">{chapter.name}</h2>
                <span className="rounded-full border border-fuchsia-400/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-fuchsia-200">
                  {chapter.trustLabel}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">{chapter.shortName} · {chapter.jurisdiction} · {chapter.status}</p>
              <dl className="mt-3 grid gap-2 text-sm text-zinc-300">
                <div><dt className="inline text-zinc-500">Handle:</dt> <dd className="inline">{chapter.handle}</dd></div>
                <div><dt className="inline text-zinc-500">Record type:</dt> <dd className="inline">{chapter.collection}</dd></div>
                <div><dt className="inline text-zinc-500">DID:</dt> <dd className="inline">{chapter.did}</dd></div>
                <div><dt className="inline text-zinc-500">AT URI:</dt> <dd className="inline">{chapter.id}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
