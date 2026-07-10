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

function validateSelfRecord(collection: string, recordInput: unknown) {
  if (!SELF_WRITABLE_COLLECTIONS.has(collection as FoundationCollection)) throw new Error(`collection ${collection} is not self-writable`);
  if (!recordInput || typeof recordInput !== 'object' || Array.isArray(recordInput)) throw new Error('record must be an object');
  const record = recordInput as FoundationRecordValue;
  if (record.$type !== collection) throw new Error('collection must match record $type');
  for (const key of FORBIDDEN_RECORD_FIELDS) if (Object.prototype.hasOwnProperty.call(record, key)) throw new Error(`client-controlled ${key} is not accepted`);
  const issues = validateFoundationRecordValue(record);
  if (issues.length) throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
  return record;
}

function parseSelfTarget(did: string, uriValue: string) {
  ensureValidAtUri(uriValue);
  const uri = new AtUri(uriValue);
  if (uri.host !== did) throw new Error('record URI authority must match the authenticated DID');
  if (!SELF_WRITABLE_COLLECTIONS.has(uri.collection as FoundationCollection)) throw new Error(`collection ${uri.collection} is not self-writable`);
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

export async function writeSelfAuthoredRecord(fetchHandler: PdsFetchHandler, did: string, input: SelfRecordWriteInput): Promise<SelfRecordWriteResult> {
  ensureValidDid(did);
  if (input.action === 'create') {
    const record = validateSelfRecord(input.collection, input.record);
    const response = await fetchHandler('/xrpc/com.atproto.repo.createRecord', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ repo: did, collection: input.collection, record }),
    });
    const output = await pdsOutput(response, input.action);
    if (typeof output.uri !== 'string' || typeof output.cid !== 'string') throw new Error('PDS returned an invalid createRecord response');
    const outputUri = parseSelfTarget(did, output.uri);
    if (outputUri.collection !== input.collection) throw new Error('PDS returned a record in the wrong collection');
    validateExpectedCid(output.cid);
    return { action: input.action, uri: output.uri, cid: output.cid, ...(output.commit ? { commit: output.commit } : {}), ...(typeof output.validationStatus === 'string' ? { validationStatus: output.validationStatus } : {}) };
  }

  const uri = parseSelfTarget(did, input.uri);
  const expectedCid = validateExpectedCid(input.expectedCid);
  if (input.action === 'update') {
    const record = validateSelfRecord(uri.collection, input.record);
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
  allowHttp?: boolean;
};

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
  const registryScope = 'atproto include:us.dsaslate.temp.authRegistryPublish';
  const delegationScope = 'atproto include:us.dsaslate.temp.authManageDelegations';
  return { userScope, registryScope, delegationScope, declaredScope: `${userScope} include:us.dsaslate.temp.authRegistryPublish include:us.dsaslate.temp.authManageDelegations` };
}

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

  private constructor(private readonly pool: Pool, private readonly client: NodeOAuthClient, private readonly config: OAuthServiceConfig, metadata: OAuthClientMetadataInput, private readonly userScope: string, private readonly registryScope: string, private readonly delegationScope: string) {
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
    return new OAuthService(pool, client, config, metadata, scopes.userScope, scopes.registryScope, scopes.delegationScope);
  }

  get jwks() {
    return this.client.jwks;
  }

  async begin(handle: string, mode: 'user' | 'registry' | 'delegations' = 'user') {
    const state = randomBytes(24).toString('base64url');
    const scope = mode === 'registry' ? this.registryScope : mode === 'delegations' ? this.delegationScope : this.userScope;
    return this.client.authorize(handle, { state, prompt: 'consent', scope: scope as AtprotoOAuthScope });
  }

  async complete(params: URLSearchParams) {
    const { session } = await this.client.callback(params);
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
