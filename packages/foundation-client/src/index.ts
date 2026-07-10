import type * as TempDefs from './lexicons/us/dsaslate/temp/defs.defs.js';
import type * as OrgProfile from './lexicons/us/dsaslate/temp/orgProfile.defs.js';
import type * as DsaUnit from './lexicons/us/dsaslate/temp/dsaUnit.defs.js';
import type * as PublicEvent from './lexicons/us/dsaslate/temp/publicEvent.defs.js';
import type { $Params as GeneratedListEntitiesParams, $OutputBody as GeneratedListEntitiesResult } from './lexicons/us/dsaslate/temp/listEntities.defs.js';
import type { $OutputBody as GeneratedGetEntityResult } from './lexicons/us/dsaslate/temp/getEntity.defs.js';
import type { $Params as GeneratedGetOrgGraphParams, $OutputBody as GeneratedOrgGraphResult } from './lexicons/us/dsaslate/temp/getOrgGraph.defs.js';
import type { $Params as ResolveAuthorityParams, $OutputBody as ResolveAuthorityResult } from './lexicons/us/dsaslate/temp/resolveAuthority.defs.js';
import type { $Params as GeneratedListActivityParams, $OutputBody as GeneratedListActivityResult } from './lexicons/us/dsaslate/temp/listActivity.defs.js';
import type { $Params as GetSyncStatusParams, $OutputBody as GetSyncStatusResult } from './lexicons/us/dsaslate/temp/getSyncStatus.defs.js';
import type { $InputBody as SubmitForReviewInput, $OutputBody as SubmitForReviewResult } from './lexicons/us/dsaslate/temp/submitForReview.defs.js';
import type { $Params as GetReviewOperationParams, $OutputBody as GetReviewOperationResult } from './lexicons/us/dsaslate/temp/getReviewOperation.defs.js';

export type Provenance = TempDefs.Provenance;
export type AuthorityDecision = TempDefs.AuthorityDecision;
export type SyncStatus = TempDefs.SyncStatus;
export type ReviewOperation = TempDefs.ReviewOperation;
export type OrgProfileRecord = OrgProfile.Main;
export type DsaUnitRecord = DsaUnit.Main;
export type PublicEventRecord = PublicEvent.Main;

export type EntityView = Omit<TempDefs.EntityView, 'profile' | 'dsaUnit'> & {
  profile?: OrgProfileRecord;
  dsaUnit?: DsaUnitRecord;
};

export type ActivityView = Omit<TempDefs.ActivityView, 'record'> & {
  record: PublicEventRecord | Record<string, unknown>;
};

export type ListEntitiesParams = Omit<GeneratedListEntitiesParams, 'limit'> & { limit?: number };
export type GetOrgGraphParams = Omit<GeneratedGetOrgGraphParams, 'limit'> & { limit?: number };
export type ListActivityParams = Omit<GeneratedListActivityParams, 'limit'> & { limit?: number };

export type ListEntitiesResult = Omit<GeneratedListEntitiesResult, 'entities'> & { entities: EntityView[] };
export type GetEntityResult = Omit<GeneratedGetEntityResult, 'entity'> & { entity: EntityView };
export type OrgGraphResult = Omit<GeneratedOrgGraphResult, 'entities'> & { entities: EntityView[] };
export type ListActivityResult = Omit<GeneratedListActivityResult, 'items'> & { items: ActivityView[] };
export type { GetReviewOperationParams, GetSyncStatusParams, ResolveAuthorityParams, ResolveAuthorityResult, SubmitForReviewInput, SubmitForReviewResult, GetReviewOperationResult, GetSyncStatusResult };

export type FoundationRequestOptions = { signal?: AbortSignal };
export type FoundationClientOptions = {
  fetch?: typeof globalThis.fetch;
  credentials?: RequestCredentials;
  maxPages?: number;
};

type ErrorPayload = { error?: unknown; message?: unknown; requestId?: unknown; retryable?: unknown };

export type SessionInfo = {
  oauthEnabled: boolean;
  authenticated: boolean;
  did?: string;
  expiresAt?: string;
  capabilities: {
    selfWrite: boolean;
    reviewSubmission: boolean;
    registryReview: boolean;
    collections: string[];
    actions: string[];
  };
};

export type SelfRecordWriteInput =
  | { action: 'create'; collection: 'us.dsaslate.temp.publicEvent' | 'us.dsaslate.temp.orgProfile'; record: PublicEventRecord | OrgProfileRecord }
  | { action: 'update'; uri: string; expectedCid: string; record: PublicEventRecord | OrgProfileRecord }
  | { action: 'delete'; uri: string; expectedCid: string };

export type SelfRecordWriteResult = { action: SelfRecordWriteInput['action']; uri: string; cid?: string; commit?: unknown; validationStatus?: string };
export type ObservationOptions = FoundationRequestOptions & { timeoutMs?: number; intervalMs?: number };

export class FoundationClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'FoundationClientError';
  }
}

function addParams(url: URL, params: Record<string, unknown>) {
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
}

export class FoundationClient {
  private readonly fetch: typeof globalThis.fetch;
  private readonly credentials: RequestCredentials;
  private readonly maxPages: number;
  private readonly baseUrl: URL;

  constructor(baseUrl: string | URL, options: FoundationClientOptions = {}) {
    this.baseUrl = new URL(String(baseUrl).replace(/\/?$/, '/'));
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.credentials = options.credentials ?? 'same-origin';
    this.maxPages = options.maxPages ?? 100;
  }

  listEntities(params: ListEntitiesParams = {}, options: FoundationRequestOptions = {}) {
    return this.query<ListEntitiesResult>('us.dsaslate.temp.listEntities', params, options);
  }

  getEntity(entityUri: string, options: FoundationRequestOptions = {}) {
    return this.query<GetEntityResult>('us.dsaslate.temp.getEntity', { entityUri }, options);
  }

  getOrgGraph(params: GetOrgGraphParams = {}, options: FoundationRequestOptions = {}) {
    return this.query<OrgGraphResult>('us.dsaslate.temp.getOrgGraph', params, options);
  }

  resolveAuthority(params: ResolveAuthorityParams, options: FoundationRequestOptions = {}) {
    return this.query<ResolveAuthorityResult>('us.dsaslate.temp.resolveAuthority', params, options);
  }

  listActivity(params: ListActivityParams = {}, options: FoundationRequestOptions = {}) {
    return this.query<ListActivityResult>('us.dsaslate.temp.listActivity', params, options);
  }

  getSyncStatus(params: GetSyncStatusParams = {}, options: FoundationRequestOptions = {}) {
    return this.query<GetSyncStatusResult>('us.dsaslate.temp.getSyncStatus', params, options);
  }

  submitForReview(input: SubmitForReviewInput, options: FoundationRequestOptions = {}) {
    return this.procedure<SubmitForReviewResult>('us.dsaslate.temp.submitForReview', input, options);
  }

  getReviewOperation(params: GetReviewOperationParams, options: FoundationRequestOptions = {}) {
    return this.query<GetReviewOperationResult>('us.dsaslate.temp.getReviewOperation', params, options);
  }

  getSession(options: FoundationRequestOptions = {}) {
    return this.rest<{ contractVersion: 'v1'; data: SessionInfo }>('api/v1/session', { method: 'GET', signal: options.signal }).then((output) => output.data);
  }

  loginUrl(handle: string) {
    const url = new URL('oauth/login', this.baseUrl);
    url.searchParams.set('handle', handle.trim());
    return url;
  }

  logout(options: FoundationRequestOptions = {}) {
    return this.rest<{ status: 'signed_out' }>('oauth/logout', { method: 'POST', signal: options.signal });
  }

  writeRecord(input: SelfRecordWriteInput, options: FoundationRequestOptions = {}) {
    return this.rest<{ contractVersion: 'v1'; data: SelfRecordWriteResult }>('api/v1/self/records', { method: 'POST', signal: options.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }).then((output) => output.data);
  }

  async waitForObservation(write: SelfRecordWriteResult, options: ObservationOptions = {}) {
    const timeoutMs = options.timeoutMs ?? 30_000;
    const intervalMs = options.intervalMs ?? 750;
    const deadline = Date.now() + timeoutMs;
    do {
      options.signal?.throwIfAborted();
      const resolved = await this.resolveAuthority({ uri: write.uri as ResolveAuthorityParams['uri'], depth: 16 }, options);
      if (write.action === 'delete' ? !!resolved.deletedAt : resolved.provenance?.cid === write.cid && !resolved.deletedAt) return resolved;
      if (Date.now() >= deadline) break;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, intervalMs);
        options.signal?.addEventListener('abort', () => { clearTimeout(timeout); reject(options.signal?.reason); }, { once: true });
      });
    } while (Date.now() <= deadline);
    throw new FoundationClientError(504, 'observation_timeout', 'PDS write was not observed by the AppView before the timeout', undefined, true);
  }

  async listAllEntities(params: Omit<ListEntitiesParams, 'cursor'> = {}, options: FoundationRequestOptions = {}) {
    return this.collectPages((cursor) => this.listEntities({ ...params, cursor }, options), 'entities');
  }

  async listAllActivity(params: Omit<ListActivityParams, 'cursor'> = {}, options: FoundationRequestOptions = {}) {
    return this.collectPages((cursor) => this.listActivity({ ...params, cursor }, options), 'items');
  }

  private async collectPages<T, K extends 'entities' | 'items'>(load: (cursor?: string) => Promise<{ cursor?: string } & Record<K, T[]>>, key: K) {
    const items: T[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < this.maxPages; page += 1) {
      const output = await load(cursor);
      items.push(...output[key]);
      if (!output.cursor) return items;
      if (seen.has(output.cursor)) throw new FoundationClientError(502, 'cursor_loop', 'AppView repeated an opaque cursor', undefined, true);
      seen.add(output.cursor);
      cursor = output.cursor;
    }
    throw new FoundationClientError(502, 'page_limit_exceeded', `AppView pagination exceeded ${this.maxPages} pages`, undefined, true);
  }

  private query<T>(method: string, params: object, options: FoundationRequestOptions) {
    const url = new URL(`xrpc/${method}`, this.baseUrl);
    addParams(url, params as Record<string, unknown>);
    return this.request<T>(url, { method: 'GET', signal: options.signal });
  }

  private procedure<T>(method: string, input: unknown, options: FoundationRequestOptions) {
    const url = new URL(`xrpc/${method}`, this.baseUrl);
    return this.request<T>(url, { method: 'POST', signal: options.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  }

  private rest<T>(path: string, init: RequestInit) {
    return this.request<T>(new URL(path, this.baseUrl), init);
  }

  private async request<T>(url: URL, init: RequestInit) {
    const response = await this.fetch(url, { ...init, credentials: this.credentials, headers: { accept: 'application/json', ...init.headers } });
    const payload = await response.json().catch(() => undefined) as T | ErrorPayload | undefined;
    if (!response.ok) {
      const error = payload as ErrorPayload | undefined;
      throw new FoundationClientError(
        response.status,
        typeof error?.error === 'string' ? error.error : 'request_failed',
        typeof error?.message === 'string' ? error.message : `Foundation request failed with status ${response.status}`,
        typeof error?.requestId === 'string' ? error.requestId : response.headers.get('x-request-id') ?? undefined,
        error?.retryable === true,
      );
    }
    if (payload === undefined) throw new FoundationClientError(502, 'invalid_response', 'Foundation returned an empty or non-JSON response', response.headers.get('x-request-id') ?? undefined, true);
    return payload as T;
  }
}
