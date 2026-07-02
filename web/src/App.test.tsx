import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders mixed directory entities and labels member prototype data', () => {
    const html = renderToString(<App initialEntities={[{
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
      record: { record: { $type: 'org.dsa.profile.chapter', name: 'New York City DSA' } },
    }, {
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
      record: { record: { $type: 'org.dsa.profile.caucus', name: 'DSA Climate Caucus' } },
    }, {
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
      record: { record: { $type: 'org.dsa.affiliation.member', displayName: 'Alex Rivera' } },
    }]} />);
    expect(html).toContain('Directory entities');
    expect(html).toContain('Mocked public chapter, caucus, member-affiliation, and verification assertion records');
    expect(html).toContain('prototype trust metadata only');
    expect(html).toContain('org.dsa.profile.caucus');
    expect(html).toContain('Verification status:');
    expect(html).toContain('Public prototype member affiliation record; not verified membership.');
    expect(html).toContain('Protocol provenance');
    expect(html).toContain('Collection:');
    expect(html).toContain('AT URI:');
    expect(html).toContain('Trust label:');
    expect(html).toContain('org.dsa.profile.chapter');
  });

  it('renders search and type filters with filtered results', () => {
    const html = renderToString(<App initialSearch="michigan" initialTypeFilter="chapter" initialEntities={[{
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
      status: 'active',
      record: { record: { $type: 'org.dsa.profile.chapter', name: 'New York City DSA' } },
    }, {
      id: 'at://did:plc:midsa/org.dsa.profile.chapter/self',
      name: 'Michigan DSA',
      shortName: 'MI-DSA',
      type: 'chapter',
      collection: 'org.dsa.profile.chapter',
      handle: 'michigan.socialists.org',
      did: 'did:plc:midsa',
      jurisdiction: 'Michigan, MI',
      trustLabel: 'self-declared',
      verificationStatus: 'self-declared',
      status: 'active',
      record: { record: { $type: 'org.dsa.profile.chapter', name: 'Michigan DSA' } },
    }]} />);
    expect(html).toContain('Search');
    expect(html).toContain('Filter by type');
    expect(html).toContain('Michigan DSA');
    expect(html).not.toContain('New York City DSA');
  });
});
