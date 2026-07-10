import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FoundationClient, FoundationClientError, type ActivityView, type EntityView, type PublicEventRecord, type SelfRecordWriteInput, type SessionInfo, type SyncStatus } from '@dsaslate/foundation-client';

export type FoundationEventsSnapshot = { entities: EntityView[]; activity: ActivityView[]; sync: SyncStatus };
export type EventDraft = {
  uri?: string;
  expectedCid?: string;
  hostEntity: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  mode: 'online' | 'inPerson' | 'hybrid';
  publicUrl: string;
  locationLabel: string;
  status: 'scheduled' | 'cancelled' | 'archived';
  createdAt?: string;
};

type LoadState = { status: 'loading' } | { status: 'error'; message: string; requestId?: string } | { status: 'ready'; snapshot: FoundationEventsSnapshot; session: SessionInfo };
export type WriteState = { status: 'idle' } | { status: 'publishing'; message: string } | { status: 'awaiting'; message: string } | { status: 'observed'; message: string } | { status: 'error'; message: string; requestId?: string };

const emptyDraft: EventDraft = { hostEntity: '', title: '', description: '', startsAt: '', endsAt: '', mode: 'online', publicUrl: '', locationLabel: '', status: 'scheduled' };

function authorityClasses(status: string) {
  if (status === 'official' || status === 'provisional' || status === 'attested') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
  if (status === 'disputed' || status === 'expired') return 'border-amber-400/40 bg-amber-500/10 text-amber-200';
  if (status === 'revoked') return 'border-rose-400/40 bg-rose-500/10 text-rose-200';
  return 'border-zinc-600 bg-zinc-800 text-zinc-300';
}

function AuthorityBadge({ status }: { status: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${authorityClasses(status)}`}>{status}</span>;
}

function profileName(entity: EntityView) {
  return typeof entity.profile?.displayName === 'string' ? entity.profile.displayName : entity.entityUri;
}

function eventRecord(item: ActivityView) {
  return item.collection === 'us.dsaslate.temp.publicEvent' ? item.record as PublicEventRecord : undefined;
}

function toLocalDateTime(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string, field: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new Error(`${field} must be a valid date and time`);
  return new Date(timestamp).toISOString();
}

export function buildEventWriteInput(draft: EventDraft, now = new Date().toISOString()): SelfRecordWriteInput {
  if (!draft.hostEntity) throw new Error('host organization is required');
  if (!draft.title.trim()) throw new Error('title is required');
  const record = {
    $type: 'us.dsaslate.temp.publicEvent' as const,
    hostEntity: draft.hostEntity,
    title: draft.title.trim(),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    startsAt: toIso(draft.startsAt, 'startsAt'),
    ...(draft.endsAt ? { endsAt: toIso(draft.endsAt, 'endsAt') } : {}),
    mode: draft.mode,
    ...(draft.publicUrl.trim() ? { publicUrl: draft.publicUrl.trim() } : {}),
    ...(draft.locationLabel.trim() ? { locationLabel: draft.locationLabel.trim() } : {}),
    status: draft.status,
    createdAt: draft.createdAt ?? now,
  } as PublicEventRecord;
  if (draft.uri && draft.expectedCid) return { action: 'update', uri: draft.uri, expectedCid: draft.expectedCid, record };
  return { action: 'create', collection: 'us.dsaslate.temp.publicEvent', record };
}

function draftFromActivity(item: ActivityView): EventDraft {
  const record = eventRecord(item);
  if (!record) return emptyDraft;
  const mode = String(record.mode);
  const status = String(record.status);
  return {
    uri: item.uri,
    expectedCid: item.provenance.cid,
    hostEntity: String(record.hostEntity),
    title: String(record.title),
    description: typeof record.description === 'string' ? record.description : '',
    startsAt: toLocalDateTime(record.startsAt),
    endsAt: toLocalDateTime(record.endsAt),
    mode: mode === 'inPerson' || mode === 'hybrid' ? mode : 'online',
    publicUrl: typeof record.publicUrl === 'string' ? record.publicUrl : '',
    locationLabel: typeof record.locationLabel === 'string' ? record.locationLabel : '',
    status: status === 'cancelled' || status === 'archived' ? status : 'scheduled',
    createdAt: String(record.createdAt),
  };
}

type EventsViewProps = {
  snapshot: FoundationEventsSnapshot;
  session?: SessionInfo;
  draft?: EventDraft;
  writeState?: WriteState;
  initialSearch?: string;
  onDraftChange?: (draft: EventDraft) => void;
  onSubmit?: () => void;
  onCancelEdit?: () => void;
  onEdit?: (item: ActivityView) => void;
  onDelete?: (item: ActivityView) => void;
  onLogin?: (handle: string) => void;
  onLogout?: () => void;
};

export function FoundationEventsView({ snapshot, session, draft = emptyDraft, writeState = { status: 'idle' }, initialSearch = '', onDraftChange, onSubmit, onCancelEdit, onEdit, onDelete, onLogin, onLogout }: EventsViewProps) {
  const [search, setSearch] = useState(initialSearch);
  const [loginHandle, setLoginHandle] = useState('');
  const entityByUri = useMemo(() => new Map<string, EntityView>(snapshot.entities.map((entity) => [entity.entityUri, entity])), [snapshot.entities]);
  const normalizedSearch = search.trim().toLowerCase();
  const entities = useMemo(() => snapshot.entities.filter((entity) => !normalizedSearch || `${profileName(entity)} ${entity.entityUri} ${entity.dsaUnit?.unitKind ?? ''}`.toLowerCase().includes(normalizedSearch)), [normalizedSearch, snapshot.entities]);
  const events = useMemo(() => snapshot.activity.filter((item) => item.collection === 'us.dsaslate.temp.publicEvent').filter((item) => {
    const record = eventRecord(item);
    const host = typeof record?.hostEntity === 'string' ? entityByUri.get(record.hostEntity) : undefined;
    return !normalizedSearch || `${String(record?.title ?? '')} ${String(record?.description ?? '')} ${host ? profileName(host) : String(record?.hostEntity ?? '')}`.toLowerCase().includes(normalizedSearch);
  }).sort((left, right) => String(eventRecord(left)?.startsAt ?? '').localeCompare(String(eventRecord(right)?.startsAt ?? ''))), [entityByUri, normalizedSearch, snapshot.activity]);
  const controlledEntities = useMemo(() => session?.did ? snapshot.entities.filter((entity) => entity.profileProvenance?.repoDid === session.did || entity.provenance.repoDid === session.did) : [], [session?.did, snapshot.entities]);

  function change<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    onDraftChange?.({ ...draft, [key]: value });
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight">DSA Slate Events</h1><span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-200">Provisional staging</span></div><p className="mt-3 max-w-2xl text-zinc-300">A public application backed by organization-controlled AT Protocol repositories.</p><p className="mt-2 text-sm text-amber-300">Authority, provenance, lifecycle, and write observation are separate. No temporary record is official.</p></div>
          <div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"><div className="text-xl font-semibold">{snapshot.entities.length}</div><div className="text-xs text-zinc-500">organizations</div></div><div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"><div className="text-xl font-semibold">{events.length}</div><div className="text-xs text-zinc-500">events</div></div><div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"><div className="text-sm font-semibold capitalize">{snapshot.sync.status}</div><div className="text-xs text-zinc-500">sync</div></div></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {session && <section className="mb-8 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-5" aria-labelledby="publishing-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 id="publishing-heading" className="text-xl font-bold">Organization publishing</h2><p className="mt-1 text-sm text-zinc-400">OAuth writes go to the controller’s PDS first, then appear here after Tap indexes the commit.</p></div>
            {session.authenticated ? <div className="text-right"><p className="text-xs text-zinc-500">Signed in</p><p className="break-all text-sm text-cyan-200">{session.did}</p><button type="button" onClick={onLogout} className="mt-2 text-xs text-zinc-400 underline hover:text-zinc-200">Sign out</button></div> : session.oauthEnabled ? <form onSubmit={(event) => { event.preventDefault(); if (loginHandle.trim()) onLogin?.(loginHandle); }} className="flex flex-wrap items-end gap-2"><label><span className="block text-xs text-zinc-400">Organization handle</span><input aria-label="Organization handle" value={loginHandle} onChange={(event) => setLoginHandle(event.target.value)} className="mt-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" placeholder="chapter.example.org" /></label><button className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100">Sign in with ATProto</button></form> : <p className="text-sm text-zinc-400">OAuth publishing is not configured in this environment.</p>}
          </div>

          {session.authenticated && <form onSubmit={(event: FormEvent) => { event.preventDefault(); onSubmit?.(); }} className="mt-5 grid gap-3 border-t border-cyan-400/10 pt-5 lg:grid-cols-2">
            <label><span className="text-xs text-zinc-400">Host organization</span><select aria-label="Host organization" value={draft.hostEntity} onChange={(event) => change('hostEntity', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"><option value="">Select an organization</option>{controlledEntities.map((entity) => <option key={entity.entityUri} value={entity.entityUri}>{profileName(entity)}</option>)}</select></label>
            <label><span className="text-xs text-zinc-400">Title</span><input aria-label="Event title" value={draft.title} onChange={(event) => change('title', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" /></label>
            <label className="lg:col-span-2"><span className="text-xs text-zinc-400">Public description</span><textarea aria-label="Public description" value={draft.description} onChange={(event) => change('description', event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" /></label>
            <label><span className="text-xs text-zinc-400">Starts</span><input aria-label="Event starts" type="datetime-local" value={draft.startsAt} onChange={(event) => change('startsAt', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" /></label>
            <label><span className="text-xs text-zinc-400">Ends</span><input aria-label="Event ends" type="datetime-local" value={draft.endsAt} onChange={(event) => change('endsAt', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" /></label>
            <label><span className="text-xs text-zinc-400">Mode</span><select aria-label="Event mode" value={draft.mode} onChange={(event) => change('mode', event.target.value as EventDraft['mode'])} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"><option value="online">Online</option><option value="inPerson">In person</option><option value="hybrid">Hybrid</option></select></label>
            <label><span className="text-xs text-zinc-400">Status</span><select aria-label="Event status" value={draft.status} onChange={(event) => change('status', event.target.value as EventDraft['status'])} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"><option value="scheduled">Scheduled</option><option value="cancelled">Cancelled</option><option value="archived">Archived</option></select></label>
            <label><span className="text-xs text-zinc-400">Public URL</span><input aria-label="Public URL" type="url" value={draft.publicUrl} onChange={(event) => change('publicUrl', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" /></label>
            <label><span className="text-xs text-zinc-400">Public location label</span><input aria-label="Public location label" value={draft.locationLabel} onChange={(event) => change('locationLabel', event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" /></label>
            {!controlledEntities.length && <p className="lg:col-span-2 text-sm text-amber-300">No authority-selected organization profile is currently controlled by this DID. Publishing remains unavailable until the profile is indexed.</p>}
            <div className="flex flex-wrap items-center gap-3 lg:col-span-2"><button disabled={!controlledEntities.length || writeState.status === 'publishing' || writeState.status === 'awaiting'} className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">{draft.uri ? 'Update event' : 'Publish event'}</button>{draft.uri && <button type="button" onClick={onCancelEdit} className="text-sm text-zinc-400 underline">Cancel edit</button>}<span className={`text-sm ${writeState.status === 'error' ? 'text-rose-300' : writeState.status === 'observed' ? 'text-emerald-300' : 'text-zinc-400'}`}>{writeState.status !== 'idle' ? writeState.message : ''}</span></div>
          </form>}
        </section>}

        <label className="block max-w-xl"><span className="text-sm font-medium text-zinc-300">Search public organizations and events</span><input aria-label="Search public organizations and events" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Organization, event, or unit kind" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-cyan-400" /></label>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
          <section aria-labelledby="events-heading"><div className="flex items-end justify-between gap-4"><div><h2 id="events-heading" className="text-2xl font-bold">Public events</h2><p className="mt-1 text-sm text-zinc-400">Tap-synchronized records published by enrolled repositories.</p></div><span className="text-sm text-zinc-500">{events.length} shown</span></div><div className="mt-4 space-y-4">
            {events.map((item) => { const record = eventRecord(item)!; const hostUri = String(record.hostEntity); const host = entityByUri.get(hostUri); const owned = session?.authenticated && item.provenance.repoDid === session.did; return <article key={item.uri} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wider text-cyan-300">{host ? profileName(host) : hostUri}</p><h3 className="mt-1 text-xl font-semibold">{String(record.title ?? item.uri)}</h3></div><AuthorityBadge status={item.authority.status} /></div>{typeof record.description === 'string' && record.description && <p className="mt-3 text-sm leading-6 text-zinc-300">{record.description}</p>}<dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs uppercase tracking-wider text-zinc-500">Starts</dt><dd className="mt-1">{new Date(String(record.startsAt)).toLocaleString()}</dd></div><div><dt className="text-xs uppercase tracking-wider text-zinc-500">Mode</dt><dd className="mt-1">{String(record.mode)}</dd></div><div><dt className="text-xs uppercase tracking-wider text-zinc-500">Lifecycle</dt><dd className="mt-1">{String(record.status)}</dd></div></dl><div className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 text-xs sm:grid-cols-2"><div><span className="text-zinc-500">Provenance</span><p className="mt-1 break-all text-zinc-300">{item.provenance.status} · {item.provenance.repoDid}</p></div><div><span className="text-zinc-500">Authority reason</span><p className="mt-1 text-zinc-300">{item.authority.reasons.join('; ')}</p></div></div>{owned && <div className="mt-4 flex gap-3"><button type="button" onClick={() => onEdit?.(item)} className="text-sm text-cyan-300 underline">Edit</button><button type="button" onClick={() => onDelete?.(item)} className="text-sm text-rose-300 underline">Delete</button></div>}</article>; })}
            {!events.length && <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-400">No public events match this search.</div>}
          </div></section>

          <aside aria-labelledby="organizations-heading"><h2 id="organizations-heading" className="text-xl font-bold">Organizations</h2><p className="mt-1 text-sm text-zinc-400">Current authority-selected profiles.</p><div className="mt-4 space-y-3">{entities.map((entity) => <article key={entity.entityUri} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{profileName(entity)}</h3><AuthorityBadge status={entity.authority.status} /></div><p className="mt-2 text-sm text-zinc-400">{String(entity.dsaUnit?.unitKind ?? 'organization')} · {entity.lifecycle}</p><div className="mt-3 space-y-1 text-xs text-zinc-500"><p className="break-all">Entity: {entity.entityUri}</p>{entity.profileProvenance && <p className="break-all">Profile source: {entity.profileProvenance.repoDid}</p>}{entity.profileAuthority && <p>Profile authority: {entity.profileAuthority.status}</p>}</div></article>)}{!entities.length && <div className="rounded-xl border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">No organizations match this search.</div>}</div></aside>
        </div>
      </div>
    </main>
  );
}

async function loadSnapshot(client: FoundationClient, signal?: AbortSignal): Promise<FoundationEventsSnapshot> {
  const [entities, activity, sync] = await Promise.all([client.listAllEntities({ limit: 100 }, { signal }), client.listAllActivity({ limit: 100 }, { signal }), client.getSyncStatus({}, { signal })]);
  return { entities, activity, sync: sync.sync };
}

export default function FoundationEventsApp({ apiBase }: { apiBase: string }) {
  const client = useMemo(() => new FoundationClient(apiBase, { credentials: 'include' }), [apiBase]);
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [writeState, setWriteState] = useState<WriteState>({ status: 'idle' });

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([loadSnapshot(client, controller.signal), client.getSession({ signal: controller.signal })]).then(([snapshot, session]) => {
      setLoadState({ status: 'ready', snapshot, session });
      if (session.did) setDraft((current) => current.hostEntity ? current : { ...current, hostEntity: snapshot.entities.find((entity) => entity.profileProvenance?.repoDid === session.did || entity.provenance.repoDid === session.did)?.entityUri ?? '' });
    }).catch((error: unknown) => { if (!controller.signal.aborted) setLoadState({ status: 'error', message: error instanceof Error ? error.message : 'The AppView could not be loaded.', requestId: error instanceof FoundationClientError ? error.requestId : undefined }); });
    return () => controller.abort();
  }, [client]);

  async function refresh(session: SessionInfo) {
    const snapshot = await loadSnapshot(client);
    setLoadState({ status: 'ready', snapshot, session });
    return snapshot;
  }

  async function submit() {
    if (loadState.status !== 'ready' || !loadState.session.authenticated) return;
    try {
      const input = buildEventWriteInput(draft);
      setWriteState({ status: 'publishing', message: `${input.action === 'create' ? 'Publishing' : 'Updating'} on the controller PDS…` });
      const write = await client.writeRecord(input);
      setWriteState({ status: 'awaiting', message: 'PDS committed the record; waiting for Tap and the AppView…' });
      await client.waitForObservation(write);
      const snapshot = await refresh(loadState.session);
      setDraft({ ...emptyDraft, hostEntity: snapshot.entities.find((entity) => entity.profileProvenance?.repoDid === loadState.session.did || entity.provenance.repoDid === loadState.session.did)?.entityUri ?? '' });
      setWriteState({ status: 'observed', message: `AppView observed ${write.uri}.` });
    } catch (error) {
      setWriteState({ status: 'error', message: error instanceof Error ? error.message : 'Event publication failed.', requestId: error instanceof FoundationClientError ? error.requestId : undefined });
    }
  }

  async function remove(item: ActivityView) {
    if (loadState.status !== 'ready' || !loadState.session.authenticated) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${String(eventRecord(item)?.title ?? item.uri)}?`)) return;
    try {
      setWriteState({ status: 'publishing', message: 'Deleting from the controller PDS…' });
      const write = await client.writeRecord({ action: 'delete', uri: item.uri, expectedCid: item.provenance.cid });
      setWriteState({ status: 'awaiting', message: 'PDS committed the deletion; waiting for the AppView tombstone…' });
      await client.waitForObservation(write);
      await refresh(loadState.session);
      setWriteState({ status: 'observed', message: `AppView observed deletion of ${write.uri}.` });
    } catch (error) {
      setWriteState({ status: 'error', message: error instanceof Error ? error.message : 'Event deletion failed.', requestId: error instanceof FoundationClientError ? error.requestId : undefined });
    }
  }

  async function logout() {
    await client.logout();
    if (loadState.status === 'ready') setLoadState({ ...loadState, session: { oauthEnabled: true, authenticated: false, capabilities: { selfWrite: false, reviewSubmission: false, registryReview: false, collections: [], actions: [] } } });
    setDraft(emptyDraft);
  }

  if (loadState.status === 'loading') return <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100"><div className="mx-auto max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900 p-8"><h1 className="text-2xl font-bold">DSA Slate Events</h1><p className="mt-3 text-zinc-400">Loading the provisional AppView…</p></div></main>;
  if (loadState.status === 'error') return <main className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100"><div className="mx-auto max-w-3xl rounded-xl border border-rose-400/30 bg-rose-500/5 p-8"><h1 className="text-2xl font-bold">Events temporarily unavailable</h1><p className="mt-3 text-zinc-300">{loadState.message}</p>{loadState.requestId && <p className="mt-2 text-xs text-zinc-500">Request ID: {loadState.requestId}</p>}</div></main>;
  return <FoundationEventsView snapshot={loadState.snapshot} session={loadState.session} draft={draft} writeState={writeState} onDraftChange={setDraft} onSubmit={submit} onCancelEdit={() => setDraft({ ...emptyDraft, hostEntity: draft.hostEntity })} onEdit={(item) => { setDraft(draftFromActivity(item)); setWriteState({ status: 'idle' }); }} onDelete={remove} onLogin={(handle) => { window.location.assign(client.loginUrl(handle)); }} onLogout={logout} />;
}
