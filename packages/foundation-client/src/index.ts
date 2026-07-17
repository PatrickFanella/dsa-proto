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
export type BeginIdentityHandoffInput = { handle: string; audience: string; returnUri: string };
export type BeginIdentityHandoffResult = { authorizationUrl: URL; verifier: string; state: string };
export type ExchangeIdentityHandoffInput = { code: string; verifier: string; audience: string };
export type IdentityHandoffResult = { did: string; audience: string; authenticatedAt: string; expiresIn: 60 };

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

  async beginIdentityHandoff(input: BeginIdentityHandoffInput): Promise<BeginIdentityHandoffResult> {
    const handle = input.handle.trim();
    if (!handle) throw new FoundationClientError(400, 'invalid_request', 'Identity handoff handle must not be empty');
    const audience = canonicalIdentityAudience(input.audience);
    const returnUri = canonicalIdentityReturnUri(input.returnUri, audience);
    const verifier = bytesToBase64Url(randomBytes(32));
    const challenge = bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    const state = bytesToBase64Url(randomBytes(16));
    const authorizationUrl = new URL('oauth/identity/v1/authorize', this.baseUrl);
    authorizationUrl.searchParams.set('handle', handle);
    authorizationUrl.searchParams.set('audience', audience);
    authorizationUrl.searchParams.set('return_uri', returnUri);
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('code_challenge', challenge);
    return { authorizationUrl, verifier, state };
  }

  async exchangeIdentityHandoff(input: ExchangeIdentityHandoffInput, options: FoundationRequestOptions = {}): Promise<IdentityHandoffResult> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(input.code)) throw new FoundationClientError(400, 'invalid_request', 'Identity handoff code must be exactly 43 base64url characters');
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(input.verifier)) throw new FoundationClientError(400, 'invalid_request', 'Identity handoff verifier must be 43-128 unreserved PKCE characters');
    const canonicalAudience = canonicalIdentityAudience(input.audience);
    const payload = await this.rest<unknown>('oauth/identity/v1/exchange', { method: 'POST', signal: options.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    if (!isIdentityHandoffResult(payload)) throw new FoundationClientError(502, 'invalid_response', 'Foundation returned an invalid identity handoff response', undefined, true);
    if (payload.audience !== canonicalAudience) throw new FoundationClientError(502, 'invalid_response', 'Foundation returned an identity handoff for a different audience', undefined, true);
    return payload;
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

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function canonicalIdentityAudience(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.origin === value) return url.origin;
  } catch { /* converted to the stable client error below */ }
  throw new FoundationClientError(400, 'invalid_request', 'Identity handoff audience must be a canonical HTTPS origin');
}

function canonicalIdentityReturnUri(value: string, audience: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.origin !== audience) throw new Error('invalid return URI');
    url.hash = '';
    return url.toString();
  } catch {
    throw new FoundationClientError(400, 'invalid_request', 'Identity handoff return URI must use HTTPS and match the audience origin');
  }
}

function isIdentityHandoffResult(value: unknown): value is IdentityHandoffResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 4 || !Object.keys(record).every((key) => ['did', 'audience', 'authenticatedAt', 'expiresIn'].includes(key))) return false;
  if (typeof record.did !== 'string' || !/^did:[a-z0-9]+:.+$/i.test(record.did) || typeof record.audience !== 'string' || typeof record.authenticatedAt !== 'string' || record.expiresIn !== 60 || Number.isNaN(Date.parse(record.authenticatedAt))) return false;
  try { const url = new URL(record.audience); return url.protocol === 'https:' && url.origin === record.audience; } catch { return false; }
}
