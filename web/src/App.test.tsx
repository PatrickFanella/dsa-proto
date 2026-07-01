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
      status: 'active',
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
      status: 'active',
      focusArea: 'climate justice organizing',
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
      status: 'active',
      publicRole: 'neighborhood canvass volunteer',
    }]} />);
    expect(html).toContain('Directory entities');
    expect(html).toContain('Mocked public chapter, caucus, and member-affiliation records');
    expect(html).toContain('public prototype records, not verified membership records');
    expect(html).toContain('org.dsa.profile.caucus');
    expect(html).toContain('Public prototype member affiliation record; not verified membership.');
  });
});
