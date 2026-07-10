import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const accountSessionSchema = z.object({
  accessJwt: z.string(),
  refreshJwt: z.string(),
  handle: z.string(),
  did: z.string().startsWith('did:'),
});

const recordResponseSchema = z.object({ uri: z.string().startsWith('at://'), cid: z.string().min(1) });

export const seedMemberSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  displayName: z.string().min(1),
  role: z.enum(['owner', 'admin', 'event_planner', 'media_manager', 'data_manager', 'viewer']),
});

export type SeedMember = z.infer<typeof seedMemberSchema>;

export const DEFAULT_SEED_MEMBERS: SeedMember[] = [
  { id: 'alex-rivera', displayName: 'Alex Rivera', role: 'owner' },
  { id: 'jordan-lee', displayName: 'Jordan Lee', role: 'admin' },
  { id: 'morgan-patel', displayName: 'Morgan Patel', role: 'admin' },
  { id: 'casey-williams', displayName: 'Casey Williams', role: 'event_planner' },
  { id: 'riley-kim', displayName: 'Riley Kim', role: 'event_planner' },
  { id: 'taylor-brooks', displayName: 'Taylor Brooks', role: 'event_planner' },
  { id: 'jamie-nguyen', displayName: 'Jamie Nguyen', role: 'media_manager' },
  { id: 'avery-johnson', displayName: 'Avery Johnson', role: 'data_manager' },
  { id: 'quinn-davis', displayName: 'Quinn Davis', role: 'viewer' },
  { id: 'skyler-martin', displayName: 'Skyler Martin', role: 'viewer' },
];

export interface OrganizationSeedConfig {
  cloudflareApiToken?: string;
  cloudflareZoneId?: string;
  createdAt: string;
  pdsUrl: string;
  handleDomain: string;
  organizationSlug: string;
  organizationName: string;
  secretsDirectory: string;
  registryHandle: string;
  registryPasswordFile: string;
  members: SeedMember[];
}

export function getOrganizationSeedConfig(env: NodeJS.ProcessEnv = process.env): OrganizationSeedConfig {
  const parsed = z.object({
    PDS_PUBLIC_URL: z.string().url().default('https://pds-staging.dsaslate.us'),
    SEED_HANDLE_DOMAIN: z.string().default('pds-staging.dsaslate.us'),
    SEED_ORGANIZATION_SLUG: z.string().regex(/^[a-z0-9-]+$/).default('lakefront-chapter'),
    SEED_ORGANIZATION_NAME: z.string().min(1).default('Lakefront DSA'),
    SEED_SECRET_DIR: z.string().default('deploy/almaz-staging/secrets/organization-seed'),
    REGISTRY_HANDLE: z.string().default('registry.pds-staging.dsaslate.us'),
    REGISTRY_PASSWORD_FILE: z.string().default('deploy/almaz-staging/secrets/registry-account-password'),
    CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
    CLOUDFLARE_ZONE_ID: z.string().min(1).optional(),
    SEED_CREATED_AT: z.string().datetime().default('2026-07-10T00:00:00.000Z'),
  }).parse(env);
  return {
    cloudflareApiToken: parsed.CLOUDFLARE_API_TOKEN,
    cloudflareZoneId: parsed.CLOUDFLARE_ZONE_ID,
    createdAt: parsed.SEED_CREATED_AT,
    pdsUrl: parsed.PDS_PUBLIC_URL.replace(/\/$/, ''),
    handleDomain: parsed.SEED_HANDLE_DOMAIN,
    organizationSlug: parsed.SEED_ORGANIZATION_SLUG,
    organizationName: parsed.SEED_ORGANIZATION_NAME,
    secretsDirectory: parsed.SEED_SECRET_DIR,
    registryHandle: parsed.REGISTRY_HANDLE,
    registryPasswordFile: parsed.REGISTRY_PASSWORD_FILE,
    members: DEFAULT_SEED_MEMBERS,
  };
}

export function accountHandle(config: Pick<OrganizationSeedConfig, 'handleDomain' | 'organizationSlug'>, member: SeedMember) {
  return `${config.organizationSlug}-${member.id}.${config.handleDomain}`;
}

async function postJson(fetchHandler: typeof fetch, url: string, body: unknown, token?: string) {
  return fetchHandler(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

async function passwordAt(file: string) {
  try {
    return (await readFile(file, 'utf8')).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const password = randomBytes(36).toString('base64url');
    await writeFile(file, `${password}\n`, { mode: 0o600 });
    return password;
  }
}

async function createOrResumeAccount(fetchHandler: typeof fetch, config: OrganizationSeedConfig, member: SeedMember) {
  const handle = accountHandle(config, member);
  const memberDirectory = join(config.secretsDirectory, 'accounts', member.id);
  await mkdir(memberDirectory, { recursive: true, mode: 0o700 });
  const password = await passwordAt(join(memberDirectory, 'password'));
  let response = await postJson(fetchHandler, `${config.pdsUrl}/xrpc/com.atproto.server.createAccount`, {
    email: `${config.organizationSlug}+${member.id}@example.invalid`,
    handle,
    password,
  });
  if (response.status === 400 || response.status === 409) {
    response = await postJson(fetchHandler, `${config.pdsUrl}/xrpc/com.atproto.server.createSession`, { identifier: handle, password });
  }
  if (!response.ok) throw new Error(`account ${handle} failed with HTTP ${response.status}: ${await response.text()}`);
  const session = accountSessionSchema.parse(await response.json());
  await writeFile(join(memberDirectory, 'session.json'), `${JSON.stringify(session)}\n`, { mode: 0o600 });
  const profileResponse = await postJson(fetchHandler, `${config.pdsUrl}/xrpc/com.atproto.repo.putRecord`, {
    repo: session.did,
    collection: 'app.bsky.actor.profile',
    rkey: 'self',
    validate: true,
    record: {
      $type: 'app.bsky.actor.profile',
      displayName: member.displayName,
      description: `Synthetic staging identity for ${config.organizationName}.`,
      createdAt: config.createdAt,
    },
  }, session.accessJwt);
  if (!profileResponse.ok) throw new Error(`profile ${handle} failed with HTTP ${profileResponse.status}: ${await profileResponse.text()}`);
  recordResponseSchema.parse(await profileResponse.json());
  return { id: member.id, displayName: member.displayName, intendedRole: member.role, handle: session.handle, did: session.did };
}

async function publishHandleDns(fetchHandler: typeof fetch, config: OrganizationSeedConfig, handle: string, did: string) {
  if (!config.cloudflareApiToken || !config.cloudflareZoneId) {
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are required to make seeded handles portable');
  }
  const name = `_atproto.${handle}`;
  const headers = { authorization: `Bearer ${config.cloudflareApiToken}`, 'content-type': 'application/json' };
  const query = new URLSearchParams({ type: 'TXT', name });
  const baseUrl = `https://api.cloudflare.com/client/v4/zones/${config.cloudflareZoneId}/dns_records`;
  const existingResponse = await fetchHandler(`${baseUrl}?${query}`, { headers });
  if (!existingResponse.ok) throw new Error(`handle DNS lookup for ${handle} failed with HTTP ${existingResponse.status}`);
  const existing = z.object({ success: z.boolean(), result: z.array(z.object({ id: z.string() })) }).parse(await existingResponse.json());
  if (!existing.success) throw new Error(`handle DNS lookup for ${handle} was rejected`);
  const body = JSON.stringify({ type: 'TXT', name, content: `did=${did}`, ttl: 1 });
  const recordId = existing.result[0]?.id;
  const response = await fetchHandler(recordId ? `${baseUrl}/${recordId}` : baseUrl, {
    method: recordId ? 'PUT' : 'POST',
    headers,
    body,
  });
  if (!response.ok) throw new Error(`handle DNS publication for ${handle} failed with HTTP ${response.status}`);
  const result = z.object({ success: z.boolean() }).parse(await response.json());
  if (!result.success) throw new Error(`handle DNS publication for ${handle} was rejected`);
  return { name, value: `did=${did}` };
}

async function registrySession(fetchHandler: typeof fetch, config: OrganizationSeedConfig) {
  const password = (await readFile(config.registryPasswordFile, 'utf8')).trim();
  const response = await postJson(fetchHandler, `${config.pdsUrl}/xrpc/com.atproto.server.createSession`, {
    identifier: config.registryHandle,
    password,
  });
  if (!response.ok) throw new Error(`registry session failed with HTTP ${response.status}: ${await response.text()}`);
  return accountSessionSchema.parse(await response.json());
}

async function putRecord(fetchHandler: typeof fetch, config: OrganizationSeedConfig, session: z.infer<typeof accountSessionSchema>, collection: string, rkey: string, record: unknown) {
  const response = await postJson(fetchHandler, `${config.pdsUrl}/xrpc/com.atproto.repo.putRecord`, {
    repo: session.did,
    collection,
    rkey,
    validate: false,
    record,
  }, session.accessJwt);
  if (!response.ok) throw new Error(`${collection}/${rkey} failed with HTTP ${response.status}: ${await response.text()}`);
  return recordResponseSchema.parse(await response.json());
}

export async function seedOrganization(config = getOrganizationSeedConfig(), fetchHandler: typeof fetch = fetch) {
  await mkdir(config.secretsDirectory, { recursive: true, mode: 0o700 });
  const members = [];
  const handleDns = [];
  for (const member of config.members.map((value) => seedMemberSchema.parse(value))) {
    const account = await createOrResumeAccount(fetchHandler, config, member);
    members.push(account);
    handleDns.push(await publishHandleDns(fetchHandler, config, account.handle, account.did));
  }
  const owners = members.filter((member) => member.intendedRole === 'owner');
  if (owners.length !== 1) throw new Error('organization seed requires exactly one owner');
  const owner = owners[0];
  const registry = await registrySession(fetchHandler, config);
  const entity = await putRecord(fetchHandler, config, registry, 'us.dsaslate.temp.orgEntity', `seed-${config.organizationSlug}`, {
    $type: 'us.dsaslate.temp.orgEntity',
    displayName: config.organizationName,
    entityType: 'organization',
    createdAt: config.createdAt,
  });
  const rootDelegation = await putRecord(fetchHandler, config, registry, 'us.dsaslate.temp.authorityDelegation', `seed-${config.organizationSlug}-chapter`, {
    $type: 'us.dsaslate.temp.authorityDelegation',
    delegateDid: owner.did,
    entityUris: [entity.uri],
    collections: ['us.dsaslate.temp.authorityDelegation', 'us.dsaslate.temp.publicEvent'],
    actions: ['create', 'update', 'delegate'],
    effectiveFrom: config.createdAt,
    createdAt: config.createdAt,
  });
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    pdsUrl: config.pdsUrl,
    organization: { slug: config.organizationSlug, displayName: config.organizationName, entity },
    chapterController: { handle: owner.handle, did: owner.did },
    rootDelegation,
    handleDns,
    members,
  };
  await writeFile(join(config.secretsDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = await seedOrganization();
  console.info(JSON.stringify({
    status: 'ready',
    organization: manifest.organization,
    chapterController: manifest.chapterController,
    rootDelegation: manifest.rootDelegation,
    memberCount: manifest.members.length,
    manifest: join(getOrganizationSeedConfig().secretsDirectory, 'manifest.json'),
  }));
}
