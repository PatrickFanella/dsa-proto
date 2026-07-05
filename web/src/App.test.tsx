import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';
import { buildChapterFixtureEnvelope, buildVerificationFixtureEnvelope, createDefaultChapterDraft, createDefaultVerificationDraft } from './publisher';

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
    expect(html).toContain('How DSA operates');
    expect(html).toContain('Organization chart source');
    expect(html).toContain('Public statements');
    expect(html).toContain('Welcome to the prototype chapter feed');
    expect(html).toContain('Public governance demo note');
  });

  it('renders the org chart section with source and relationships', () => {
    const html = renderToString(<App initialEntities={[]} initialOrgChart={{ prototype: true, sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', updatedLabel: 'Last updated June 2020', units: [{ uri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', name: 'National Political Committee', shortName: 'NPC', kind: 'national-committee', description: 'National governing committee elected by chapter delegates at convention.', status: 'active' }, { uri: 'at://did:plc:demleft/org.dsa.profile.orgUnit/self', name: 'Democratic Left', shortName: 'Dem Left', kind: 'publication', description: 'National publication that accepts pitches and submissions from members.', status: 'active' }], relationships: [{ uri: 'at://did:plc:chapterdelegates/org.dsa.relationship.governance/npc-elects', subjectUri: 'at://did:plc:chapterdelegates/org.dsa.profile.orgUnit/self', relationship: 'elects', objectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', description: 'Chapter delegates elect the National Political Committee at convention.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' }, { uri: 'at://did:plc:npc/org.dsa.relationship.governance/appoints-publications', subjectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', relationship: 'appoints', objectUri: 'at://did:plc:demleft/org.dsa.profile.orgUnit/self', description: 'NPC appoints the editorial board for publications.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' }] }} />);
    expect(html).toContain('How DSA operates');
    expect(html).toContain('Organization chart source');
    expect(html).toContain('Last updated June 2020');
    expect(html).toContain('National Political Committee');
    expect(html).toContain('Chapter delegates elect the National Political Committee at convention.');
    expect(html).toContain('National committees');
    expect(html).toContain('Publications');
    expect(html).toContain('NPC appoints the editorial board for publications.');
  });

  it('renders the registry health panel', () => {
    const html = renderToString(<App initialEntities={[]} />);
    expect(html).toContain('Registry health');
    expect(html).toContain('OK');
    expect(html).toContain('233');
    expect(html).toContain('chapters');
    expect(html).toContain('14');
    expect(html).toContain('caucuses');
    expect(html).toContain('247');
    expect(html).toContain('total records');
    expect(html).toContain('Invalid:');
    expect(html).toContain('Duplicates:');
    expect(html).toContain('Last checked from fixture file');
  });

  it('renders focused org unit details and relationship directions', () => {
    const html = renderToString(<App initialEntities={[]} initialOrgChart={{ prototype: true, sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', updatedLabel: 'Last updated June 2020', units: [{ uri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', name: 'National Political Committee', shortName: 'NPC', kind: 'national-committee', description: 'National governing committee elected by chapter delegates at convention.', status: 'active', website: 'https://www.dsausa.org/' }, { uri: 'at://did:plc:chapterdelegates/org.dsa.profile.orgUnit/self', name: 'Chapter Delegates', shortName: 'Chapter Delegates', kind: 'delegate-body', description: 'Delegates elected by membership to convention who elect the NPC.', status: 'active' }], relationships: [{ uri: 'at://did:plc:chapterdelegates/org.dsa.relationship.governance/npc-elects', subjectUri: 'at://did:plc:chapterdelegates/org.dsa.profile.orgUnit/self', relationship: 'elects', objectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', description: 'Chapter delegates elect the National Political Committee at convention.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' }] }} />);
    expect(html).toContain('National Political Committee');
    expect(html).toContain('National committees');
    expect(html).toContain('Source link');
    expect(html).toContain('Prototype caveat');
    expect(html).toContain('Incoming relationships');
    expect(html).toContain('Outgoing relationships');
    expect(html).toContain('Chapter delegates elect the National Political Committee at convention.');
    expect(html).toContain('elects');
  });

  it('renders related public statements for the selected entity', () => {
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
      status: 'active',
      record: { record: { $type: 'org.dsa.profile.chapter', name: 'New York City DSA' } },
    }, {
      id: 'at://did:plc:miunit/org.dsa.profile.chapter/self',
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
    }]} initialSearch="" />);

    expect(html).toContain('Related public statements');
    expect(html).toContain('Welcome to the prototype chapter feed');
  });

  it('renders related public statements empty state when none are linked', () => {
    const html = renderToString(<App initialEntities={[{
      id: 'at://did:plc:miunit/org.dsa.profile.chapter/self',
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
    }]} initialSearch="Michigan" />);

    expect(html).toContain('Related public statements');
    expect(html).toContain('No public statements linked to this entity yet.');
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
    expect(html).toContain('Filter by state');
    expect(html).toContain('Filter by chapter kind');
    expect(html).toContain('Showing');
    expect(html).toContain('Michigan DSA');
  });

  it('renders chapter counts and empty-state guidance', () => {
    const html = renderToString(<App initialEntities={[]} initialSearch="zzz" />);
    expect(html).toContain('Showing');
    expect(html).toContain('0');
    expect(html).toContain('No records match these filters');
  });

  it('renders the local prototype publisher and chapter preview', () => {
    const preview = buildChapterFixtureEnvelope(createDefaultChapterDraft());
    const verificationPreview = buildVerificationFixtureEnvelope(createDefaultVerificationDraft());
    const html = renderToString(<App initialEntities={[]} />);
    expect(html).toContain('Local prototype publisher');
    expect(html).toContain('Local prototype publishing only');
    expect(html).toContain('Local verification assertion publisher');
    expect(html).toContain('This does not create real DSA legitimacy');
    expect(html).toContain('/api/admin/fixtures/ingest');
    expect(html).toContain(preview.uri);
    expect(html).toContain(preview.record.jurisdiction.name);
    expect(html).toContain(preview.record.jurisdiction.state);
    expect(html).toContain(verificationPreview.record.subjectUri);
    expect(html).toContain('org.dsa.verification.assertion');
  });

  it('builds verification assertion fixture envelopes', () => {
    const preview = buildVerificationFixtureEnvelope(createDefaultVerificationDraft());
    expect(preview).toMatchObject({
      collection: 'org.dsa.verification.assertion',
      trustLabel: 'mock-official',
      record: {
        $type: 'org.dsa.verification.assertion',
        assertion: 'verified',
      },
    });
    expect(preview.uri).toContain(preview.record.subjectUri);
  });
});
