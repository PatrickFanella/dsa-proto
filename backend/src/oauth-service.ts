import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Pool } from 'pg';
import {
  JoseKey,
  NodeOAuthClient,
  type AtprotoOAuthScope,
  type NodeSavedSession,
  type NodeSavedSessionStore,
  type NodeSavedState,
  type NodeSavedStateStore,
  type OAuthClientMetadataInput,
} from '@atproto/oauth-client-node';
import { AtUri, ensureValidAtUri, ensureValidDid } from '@atproto/syntax';
import { CID } from 'multiformats/cid';
import { validateFoundationRecordValue, type FoundationCollection, type FoundationRecordValue } from './foundation-model.js';
import type { FoundationRecord } from './foundation-model.js';
import { publishFoundationRecords } from './foundation-publisher.js';

const SELF_WRITABLE_COLLECTIONS = new Set<FoundationCollection>(['us.dsaslate.temp.orgProfile', 'us.dsaslate.temp.publicEvent']);
const DELEGATION_WRITABLE_COLLECTIONS = new Set<FoundationCollection>(['us.dsaslate.temp.authorityDelegation']);
const FORBIDDEN_RECORD_FIELDS = ['uri', 'cid', 'rkey', 'repoDid', 'repoRev', 'sequence', 'trustLabel', 'authority', 'provenance', 'official'];

export type SelfRecordWriteInput =
  | { action: 'create'; collection: FoundationCollection; record: FoundationRecordValue }
  | { action: 'update'; uri: string; expectedCid: string; record: FoundationRecordValue }
  | { action: 'delete'; uri: string; expectedCid: string };

export type SelfRecordWriteResult = {
  action: SelfRecordWriteInput['action'];
  uri: string;
  cid?: string;
  commit?: unknown;
  validationStatus?: string;
};

export type PdsFetchHandler = (pathname: string, init?: RequestInit) => Promise<Response>;

export class PdsWriteError extends Error {
  constructor(readonly status: number, readonly code: string, action: SelfRecordWriteInput['action']) {
    super(`PDS rejected ${action} with ${code}`);
    this.name = 'PdsWriteError';
  }
}

function validateWritableRecord(collection: string, recordInput: unknown, allowedCollections: ReadonlySet<FoundationCollection>) {
  if (!allowedCollections.has(collection as FoundationCollection)) throw new Error(`collection ${collection} is not writable for this authorization`);
  if (!recordInput || typeof recordInput !== 'object' || Array.isArray(recordInput)) throw new Error('record must be an object');
  const record = recordInput as FoundationRecordValue;
  if (record.$type !== collection) throw new Error('collection must match record $type');
  for (const key of FORBIDDEN_RECORD_FIELDS) if (Object.prototype.hasOwnProperty.call(record, key)) throw new Error(`client-controlled ${key} is not accepted`);
  const issues = validateFoundationRecordValue(record);
  if (issues.length) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
  return record;
}

function parseWritableTarget(did: string, uriValue: string, allowedCollections: ReadonlySet<FoundationCollection>) {
  ensureValidAtUri(uriValue);
  const uri = new AtUri(uriValue);
  if (uri.host !== did) throw new Error('record URI authority must match the authenticated DID');
  if (!allowedCollections.has(uri.collection as FoundationCollection)) throw new Error(`collection ${uri.collection} is not writable for this authorization`);
  return uri;
}

function validateExpectedCid(value: string) {
  const cid = CID.parse(value);
  if (cid.toString() !== value) throw new Error('expectedCid must be a normalized CID');
  return value;
}

async function pdsOutput(response: Response, action: SelfRecordWriteInput['action']) {
  const output = await response.json().catch(() => ({})) as { uri?: unknown; cid?: unknown; commit?: unknown; validationStatus?: unknown; error?: unknown };
  if (!response.ok) throw new PdsWriteError(response.status, typeof output.error === 'string' ? output.error : `HTTP_${response.status}`, action);
  return output;
}

async function writeAuthorizedRecord(fetchHandler: PdsFetchHandler, did: string, input: SelfRecordWriteInput, allowedCollections: ReadonlySet<FoundationCollection>): Promise<SelfRecordWriteResult> {
  ensureValidDid(did);
  if (input.action === 'create') {
    const record = validateWritableRecord(input.collection, input.record, allowedCollections);
    const response = await fetchHandler('/xrpc/com.atproto.repo.createRecord', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repo: did, collection: input.collection, record }),
    });
    const output = await pdsOutput(response, input.action);
    if (typeof output.uri !== 'string' || typeof output.cid !== 'string') throw new Error('PDS returned an invalid createRecord response');
    const outputUri = parseWritableTarget(did, output.uri, allowedCollections);
    if (outputUri.collection !== input.collection) throw new Error('PDS returned a record in the wrong collection');
    validateExpectedCid(output.cid);
    return { action: input.action, uri: output.uri, cid: output.cid, ...(output.commit ? { commit: output.commit } : {}), ...(typeof output.validationStatus === 'string' ? { validationStatus: output.validationStatus } : {}) };
  }

  const uri = parseWritableTarget(did, input.uri, allowedCollections);
  const expectedCid = validateExpectedCid(input.expectedCid);
  if (input.action === 'update') {
    const record = validateWritableRecord(uri.collection, input.record, allowedCollections);
    const response = await fetchHandler('/xrpc/com.atproto.repo.putRecord', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repo: did, collection: uri.collection, rkey: uri.rkey, record, swapRecord: expectedCid }),
    });
    const output = await pdsOutput(response, input.action);
    if (output.uri !== input.uri || typeof output.cid !== 'string') throw new Error('PDS returned an invalid putRecord response');
    validateExpectedCid(output.cid);
    return { action: input.action, uri: input.uri, cid: output.cid, ...(output.commit ? { commit: output.commit } : {}), ...(typeof output.validationStatus === 'string' ? { validationStatus: output.validationStatus } : {}) };
  }

  const response = await fetchHandler('/xrpc/com.atproto.repo.deleteRecord', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repo: did, collection: uri.collection, rkey: uri.rkey, swapRecord: expectedCid }),
  });
  const output = await pdsOutput(response, input.action);
  return { action: input.action, uri: input.uri, ...(output.commit ? { commit: output.commit } : {}) };
}

export function writeSelfAuthoredRecord(fetchHandler: PdsFetchHandler, did: string, input: SelfRecordWriteInput) {
  return writeAuthorizedRecord(fetchHandler, did, input, SELF_WRITABLE_COLLECTIONS);
}

export function writeDelegationRecord(fetchHandler: PdsFetchHandler, did: string, input: SelfRecordWriteInput) {
  return writeAuthorizedRecord(fetchHandler, did, input, DELEGATION_WRITABLE_COLLECTIONS);
}

export type OAuthServiceConfig = {
  appUrl: string;
  handleResolver: string;
  internalPdsUrl?: string;
  serviceDid: string;
  encryptionKey: Uint8Array;
  privateKey: string;
  privateKeyAlg: 'ES256' | 'ES256K';
  cookieName?: string;
  browserSessionTtlSeconds?: number;
  handoffReturnOrigins?: string[];
  handoffCodeTtlSeconds?: number;
  handoffTokenTtlSeconds?: number;
  allowHttp?: boolean;
};

export function createPkceChallenge(verifier: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new Error('PKCE verifier is invalid');
  return createHash('sha256').update(verifier).digest('base64url');
}

export function validateHandoffReturnUri(returnUri: string, allowedOrigins: readonly string[]) {
  const url = new URL(returnUri);
  if (url.protocol !== 'https:') throw new Error('OAuth handoff return URI must use HTTPS');
  const allowed = new Set(allowedOrigins.map((origin) => new URL(origin).origin));
  if (!allowed.has(url.origin)) throw new Error('OAuth handoff return origin is not allowlisted');
  url.hash = '';
  return url.toString();
}

export function createOAuthFetch(publicPdsUrl: string, internalPdsUrl: string, baseFetch: typeof fetch = globalThis.fetch) {
  const publicOrigin = new URL(publicPdsUrl).origin;
  const publicHost = new URL(publicOrigin).host;
  const publicProtocol = new URL(publicOrigin).protocol.slice(0, -1);
  const internalBase = new URL(internalPdsUrl);
  if (internalBase.protocol !== 'http:' && internalBase.protocol !== 'https:') throw new Error('internal PDS URL must use HTTP or HTTPS');

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== publicOrigin) return baseFetch(request);

    const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, internalBase);
    const headers = new Headers(request.headers);
    headers.set('x-forwarded-host', publicHost);
    headers.set('x-forwarded-proto', publicProtocol);
    return baseFetch(new Request(new Request(target, request), { headers }));
  };
}

export function buildOAuthScopes(serviceDid: string) {
  ensureValidDid(serviceDid);
  const audience = encodeURIComponent(`${serviceDid}#dsaslate_appview`);
  const userScope = `atproto include:us.dsaslate.temp.authSelfPublish include:us.dsaslate.temp.authReviewSubmit?aud=${audience}`;
  const eventScope = 'atproto include:us.dsaslate.temp.authSelfPublish';
  const registryScope = 'atproto include:us.dsaslate.temp.authRegistryPublish';
  const delegationScope = 'atproto include:us.dsaslate.temp.authManageDelegations';
  return { userScope, eventScope, registryScope, delegationScope, declaredScope: `${userScope} include:us.dsaslate.temp.authRegistryPublish include:us.dsaslate.temp.authManageDelegations` };
}

export type HandoffPermissionSet = 'us.dsaslate.temp.authManageDelegations' | 'us.dsaslate.temp.authSelfPublish';

type EncryptedPayload = { iv: Buffer; authTag: Buffer; ciphertext: Buffer };

function keyHash(namespace: string, key: string) {
  return createHash('sha256').update(`${namespace}\0${key}`).digest('hex');
}

export function parseEncryptionKey(input: Uint8Array) {
  const key = Buffer.from(input);
  if (key.length !== 32) throw new Error('OAuth encryption key must contain exactly 32 bytes');
  return key;
}

export function encryptJson(value: unknown, keyInput: Uint8Array, associatedData: string): EncryptedPayload {
  const key = parseEncryptionKey(keyInput);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { iv, authTag: cipher.getAuthTag(), ciphertext };
}

export function decryptJson<T>(payload: EncryptedPayload, keyInput: Uint8Array, associatedData: string): T {
  const key = parseEncryptionKey(keyInput);
  const decipher = createDecipheriv('aes-256-gcm', key, payload.iv);
  decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  decipher.setAuthTag(payload.authTag);
  return JSON.parse(Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]).toString('utf8')) as T;
}

class EncryptedPostgresStore<T extends object> {
  constructor(private readonly pool: Pool, private readonly namespace: string, private readonly encryptionKey: Uint8Array) {}

  async get(key: string): Promise<T | undefined> {
    const hash = keyHash(this.namespace, key);
    const result = await this.pool.query('select iv, auth_tag, ciphertext from oauth_encrypted_store_v1 where namespace = $1 and key_hash = $2', [this.namespace, hash]);
    const row = result.rows[0] as { iv: Buffer; auth_tag: Buffer; ciphertext: Buffer } | undefined;
    return row ? decryptJson<T>({ iv: row.iv, authTag: row.auth_tag, ciphertext: row.ciphertext }, this.encryptionKey, `${this.namespace}:${hash}`) : undefined;
  }

  async set(key: string, value: T) {
    const hash = keyHash(this.namespace, key);
    const encrypted = encryptJson(value, this.encryptionKey, `${this.namespace}:${hash}`);
    await this.pool.query(
      `insert into oauth_encrypted_store_v1 (namespace,key_hash,iv,auth_tag,ciphertext,updated_at) values ($1,$2,$3,$4,$5,now())
       on conflict (namespace,key_hash) do update set iv=excluded.iv,auth_tag=excluded.auth_tag,ciphertext=excluded.ciphertext,updated_at=now()`,
      [this.namespace, hash, encrypted.iv, encrypted.authTag, encrypted.ciphertext],
    );
  }

  async del(key: string) {
    await this.pool.query('delete from oauth_encrypted_store_v1 where namespace = $1 and key_hash = $2', [this.namespace, keyHash(this.namespace, key)]);
  }
}

export class OAuthService {
  readonly cookieName: string;
  readonly metadata: OAuthClientMetadataInput;
  private readonly sessionTtlSeconds: number;

  private constructor(private readonly pool: Pool, private readonly client: NodeOAuthClient, private readonly config: OAuthServiceConfig, metadata: OAuthClientMetadataInput, private readonly userScope: string, private readonly eventScope: string, private readonly registryScope: string, private readonly delegationScope: string) {
    this.cookieName = config.cookieName ?? 'dsaslate_oauth';
    this.sessionTtlSeconds = config.browserSessionTtlSeconds ?? 7 * 24 * 60 * 60;
    this.metadata = metadata;
  }

  static async create(pool: Pool, config: OAuthServiceConfig) {
    const appUrl = new URL(config.appUrl);
    const allowHttp = config.allowHttp === true && (appUrl.hostname === '127.0.0.1' || appUrl.hostname === 'localhost' || appUrl.hostname === '[::1]');
    if (appUrl.protocol !== 'https:' && !allowHttp) throw new Error('OAuth app URL must use HTTPS outside loopback development');
    ensureValidDid(config.serviceDid);
    parseEncryptionKey(config.encryptionKey);
    const key = await JoseKey.fromImportable(config.privateKey, 'dsaslate-oauth-client');
    const clientId = new URL('/oauth/client-metadata.json', appUrl).toString();
    const callback = new URL('/oauth/callback', appUrl).toString();
    const jwksUri = new URL('/oauth/jwks.json', appUrl).toString();
    const scopes = buildOAuthScopes(config.serviceDid);
    const metadata = {
      client_id: clientId,
      client_name: 'DSA Slate staging',
      client_uri: appUrl.toString(),
      redirect_uris: [callback],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'web',
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_signing_alg: config.privateKeyAlg,
      dpop_bound_access_tokens: true,
      jwks_uri: jwksUri,
      scope: scopes.declaredScope,
    } as OAuthClientMetadataInput;
    const stateStore = new EncryptedPostgresStore<NodeSavedState>(pool, 'state', config.encryptionKey) as NodeSavedStateStore;
    const sessionStore = new EncryptedPostgresStore<NodeSavedSession>(pool, 'session', config.encryptionKey) as NodeSavedSessionStore;
    const client = new NodeOAuthClient({
      clientMetadata: metadata,
      responseMode: 'query',
      handleResolver: config.handleResolver,
      allowHttp,
      stateStore,
      sessionStore,
      keyset: [key],
      ...(config.internalPdsUrl ? { fetch: createOAuthFetch(config.handleResolver, config.internalPdsUrl) } : {}),
    });
    return new OAuthService(pool, client, config, metadata, scopes.userScope, scopes.eventScope, scopes.registryScope, scopes.delegationScope);
  }

  get jwks() {
    return this.client.jwks;
  }

  async begin(handle: string, mode: 'user' | 'registry' | 'delegations' | 'events' = 'user', handoff?: { returnUri: string; clientState: string; codeChallenge: string }) {
    const state = randomBytes(24).toString('base64url');
    const scope = mode === 'registry' ? this.registryScope : mode === 'delegations' ? this.delegationScope : mode === 'events' ? this.eventScope : this.userScope;
    if (handoff) {
      if (mode !== 'delegations' && mode !== 'events') throw new Error('OAuth handoff mode is invalid');
      const permissionSet: HandoffPermissionSet = mode === 'delegations' ? 'us.dsaslate.temp.authManageDelegations' : 'us.dsaslate.temp.authSelfPublish';
      const returnUri = validateHandoffReturnUri(handoff.returnUri, this.config.handoffReturnOrigins ?? []);
      if (!/^[A-Za-z0-9._~-]{16,256}$/.test(handoff.clientState)) throw new Error('OAuth handoff client state is invalid');
      if (!/^[A-Za-z0-9_-]{43}$/.test(handoff.codeChallenge)) throw new Error('OAuth handoff PKCE challenge is invalid');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await this.pool.query('delete from oauth_handoff_requests_v1 where expires_at <= now()');
      await this.pool.query(
        'insert into oauth_handoff_requests_v1 (state_hash,return_uri,client_state,code_challenge,permission_set,expires_at) values ($1,$2,$3,$4,$5,$6)',
        [keyHash('handoff-state', state), returnUri, handoff.clientState, handoff.codeChallenge, permissionSet, expiresAt],
      );
    }
    try {
      return await this.client.authorize(handle, { state, prompt: 'consent', scope: scope as AtprotoOAuthScope });
    } catch (error) {
      if (handoff) await this.pool.query('delete from oauth_handoff_requests_v1 where state_hash = $1', [keyHash('handoff-state', state)]).catch(() => undefined);
      throw error;
    }
  }

  async complete(params: URLSearchParams) {
    // The OAuth client owns the protocol state and returns our state option as
    // application state after validating the callback. Hashing the raw query
    // state here would compare two different values and strand every handoff.
    const { session, state } = await this.client.callback(params);
    const handoff = state ? await this.pool.query(
      `delete from oauth_handoff_requests_v1
       where state_hash = $1 and expires_at > now()
       returning return_uri, client_state, code_challenge, permission_set`,
      [keyHash('handoff-state', state)],
    ) : undefined;
    const handoffRow = handoff?.rows[0] as { return_uri: string; client_state: string; code_challenge: string; permission_set: HandoffPermissionSet } | undefined;
    if (handoffRow) {
      const code = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + (this.config.handoffCodeTtlSeconds ?? 60) * 1000);
      await this.pool.query('delete from oauth_handoff_codes_v1 where expires_at <= now() or consumed_at is not null');
      await this.pool.query(
        'insert into oauth_handoff_codes_v1 (code_hash,account_did,return_uri,code_challenge,permission_set,expires_at) values ($1,$2,$3,$4,$5,$6)',
        [keyHash('handoff-code', code), session.did, handoffRow.return_uri, handoffRow.code_challenge, handoffRow.permission_set, expiresAt],
      );
      const location = new URL(handoffRow.return_uri);
      location.searchParams.set('code', code);
      location.searchParams.set('state', handoffRow.client_state);
      return { did: session.did, handoff: { location: location.toString() } };
    }
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTtlSeconds * 1000);
    await this.pool.query('delete from oauth_browser_sessions_v1 where expires_at <= now()');
    await this.pool.query(
      'insert into oauth_browser_sessions_v1 (token_hash,account_did,created_at,expires_at) values ($1,$2,$3,$4)',
      [this.hashBrowserToken(token), session.did, now.toISOString(), expiresAt.toISOString()],
    );
    return { did: session.did, token, expiresAt: expiresAt.toISOString() };
  }

  async exchangeHandoff(code: string, verifier: string) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await client.query(
        `select account_did, code_challenge, permission_set
         from oauth_handoff_codes_v1
         where code_hash = $1 and consumed_at is null and expires_at > now()
         for update`,
        [keyHash('handoff-code', code)],
      );
      const row = result.rows[0] as { account_did?: string; code_challenge?: string; permission_set?: HandoffPermissionSet } | undefined;
      if (!row?.account_did || row.code_challenge !== createPkceChallenge(verifier)) throw new Error('OAuth handoff code is invalid or expired');
      await client.query('update oauth_handoff_codes_v1 set consumed_at = now() where code_hash = $1', [keyHash('handoff-code', code)]);
      const accessToken = randomBytes(32).toString('base64url');
      const expiresIn = this.config.handoffTokenTtlSeconds ?? 300;
      await client.query(
        'insert into oauth_handoff_tokens_v1 (token_hash,account_did,permission_set,expires_at) values ($1,$2,$3,$4)',
        [keyHash('handoff-token', accessToken), row.account_did, row.permission_set, new Date(Date.now() + expiresIn * 1000)],
      );
      await client.query('commit');
      return { accessToken, did: row.account_did, expiresIn, permissionSet: row.permission_set };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async consumeHandoffToken(token: string, expectedPermissionSet: HandoffPermissionSet) {
    const result = await this.pool.query(
      `update oauth_handoff_tokens_v1
       set consumed_at = now()
       where token_hash = $1 and consumed_at is null and expires_at > now()
       returning account_did, permission_set`,
      [keyHash('handoff-token', token)],
    );
    const row = result.rows[0] as { account_did?: string; permission_set?: string } | undefined;
    const did = row?.account_did;
    if (!did || row.permission_set !== expectedPermissionSet) throw new Error('OAuth handoff token is invalid, expired, or out of scope');
    ensureValidDid(did);
    return did;
  }

  async authenticateRequest(req: IncomingMessage) {
    const session = await this.getBrowserSession(req);
    if (!session) throw new Error('missing or expired OAuth browser session');
    return session.did;
  }

  async getBrowserSession(req: IncomingMessage) {
    const token = this.readCookie(req.headers.cookie);
    if (!token) return undefined;
    await this.pool.query('delete from oauth_browser_sessions_v1 where expires_at <= now()');
    const result = await this.pool.query('select account_did, expires_at from oauth_browser_sessions_v1 where token_hash = $1 and expires_at > now()', [this.hashBrowserToken(token)]);
    const row = result.rows[0] as { account_did?: string; expires_at?: Date | string } | undefined;
    const did = row?.account_did;
    if (!did || !row?.expires_at) return undefined;
    ensureValidDid(did);
    return { did, expiresAt: new Date(row.expires_at).toISOString() };
  }

  assertTrustedOrigin(req: IncomingMessage) {
    const origin = req.headers.origin;
    if (origin && origin !== new URL(this.config.appUrl).origin) throw new Error('request origin is not allowed for OAuth writes');
  }

  async logout(req: IncomingMessage) {
    const token = this.readCookie(req.headers.cookie);
    if (!token) return;
    const result = await this.pool.query('delete from oauth_browser_sessions_v1 where token_hash = $1 returning account_did', [this.hashBrowserToken(token)]);
    const did = result.rows[0]?.account_did as string | undefined;
    if (did) await this.client.revoke(did).catch(() => undefined);
  }

  sessionCookie(token: string, expiresAt: string) {
    const secure = new URL(this.config.appUrl).protocol === 'https:' ? '; Secure' : '';
    return `${this.cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=${new Date(expiresAt).toUTCString()}`;
  }

  clearSessionCookie() {
    const secure = new URL(this.config.appUrl).protocol === 'https:' ? '; Secure' : '';
    return `${this.cookieName}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
  }

  async writeSelfAuthoredRecord(did: string, input: SelfRecordWriteInput) {
    const session = await this.client.restore(did);
    return writeSelfAuthoredRecord(session.fetchHandler.bind(session), did, input);
  }

  async writeHandoffDelegation(token: string, input: SelfRecordWriteInput) {
    const did = await this.consumeHandoffToken(token, 'us.dsaslate.temp.authManageDelegations');
    const session = await this.client.restore(did);
    return writeDelegationRecord(session.fetchHandler.bind(session), did, input);
  }

  async writeHandoffEvent(token: string, input: SelfRecordWriteInput) {
    const did = await this.consumeHandoffToken(token, 'us.dsaslate.temp.authSelfPublish');
    const collection = input.action === 'create' ? input.collection : new AtUri(input.uri).collection;
    if (collection !== 'us.dsaslate.temp.publicEvent') throw new Error('collection is not writable for event handoff authorization');
    const session = await this.client.restore(did);
    return writeSelfAuthoredRecord(session.fetchHandler.bind(session), did, input);
  }

  async publishRegistryRecords(rootDid: string, records: FoundationRecord[]) {
    ensureValidDid(rootDid);
    if (records.some((record) => record.repoDid !== rootDid)) throw new Error('registry publication contains a record authored by another DID');
    const session = await this.client.restore(rootDid);
    return publishFoundationRecords(session.fetchHandler.bind(session), rootDid, records);
  }

  async publishRegistryRecord(rootDid: string, collection: string, recordInput: unknown) {
    ensureValidDid(rootDid);
    if (!recordInput || typeof recordInput !== 'object' || Array.isArray(recordInput)) throw new Error('registry record must be an object');
    const record = recordInput as FoundationRecordValue;
    if (record.$type !== collection) throw new Error('collection must match registry record $type');
    const issues = validateFoundationRecordValue(record);
    if (issues.length) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    const session = await this.client.restore(rootDid);
    const response = await session.fetchHandler('/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repo: rootDid, collection, record, validate: true }),
    });
    if (!response.ok) throw new Error(`registry PDS rejected record creation with status ${response.status}`);
    const output = await response.json() as { uri?: unknown; cid?: unknown; commit?: unknown };
    if (typeof output.uri !== 'string' || typeof output.cid !== 'string') throw new Error('registry PDS returned an invalid createRecord response');
    return { uri: output.uri, cid: output.cid, ...(output.commit ? { commit: output.commit } : {}) };
  }

  private hashBrowserToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private readCookie(header: string | undefined) {
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const [name, ...value] = part.trim().split('=');
      if (name === this.cookieName) return value.join('=');
    }
    return undefined;
  }
}
