import { describe, expect, it } from 'vitest';
import { accountHandle, DEFAULT_SEED_MEMBERS, getOrganizationSeedConfig } from './organization-seed.js';

describe('organization seed', () => {
  it('creates a realistic private-role distribution', () => {
    expect(DEFAULT_SEED_MEMBERS).toHaveLength(10);
    expect(DEFAULT_SEED_MEMBERS.filter((member) => member.role === 'owner')).toHaveLength(1);
    expect(DEFAULT_SEED_MEMBERS.filter((member) => member.role === 'admin')).toHaveLength(2);
    expect(DEFAULT_SEED_MEMBERS.filter((member) => member.role === 'event_planner')).toHaveLength(3);
  });

  it('builds portable handles under the staging PDS domain', () => {
    const config = getOrganizationSeedConfig({
      SEED_ORGANIZATION_SLUG: 'lakefront',
      SEED_HANDLE_DOMAIN: 'pds-staging.dsaslate.us',
    });
    expect(accountHandle(config, DEFAULT_SEED_MEMBERS[0])).toBe('lakefront-alex-rivera.pds-staging.dsaslate.us');
    expect(config.createdAt).toBe('2026-07-10T00:00:00.000Z');
  });

  it('keeps all role names out of repository record construction', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('./organization-seed.ts', import.meta.url), 'utf8'));
    expect(source).not.toContain('$type: \'org.dsa.affiliation.member\'');
  });
});
