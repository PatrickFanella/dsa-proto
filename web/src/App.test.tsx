import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App, { fetchResolvedAuthority, type ResolvedRecordAuthority } from './App';
import { buildChapterFixtureEnvelope, buildVerificationFixtureEnvelope, createDefaultChapterDraft, createDefaultVerificationDraft } from './publisher';

describe('App', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('renders the DSA civic data layer dashboard with hero and foundation layer badge', () => {
    const html = renderToString(<App initialEntities={[{
      id: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
      name: 'New York City DSA',
      shortName: 'NYC-DSA',
      type: 'chapter',
      collection: 'org.dsa.profile.chapter',
      handle: 'nyc.dsausa.org',
      did: 'did:plc:nycdsa',
      jurisdiction: 'New York City, NY',
      trustLabel: 'official',
      verificationStatus: 'verified',
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
      trustLabel: 'community-submitted',
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
    // Hero section
    expect(html).toContain('DSA Civic Data Layer');
    expect(html).toContain('Foundation Layer');
    expect(html).toContain('A public foundation-layer dashboard for DSA organizational records');
    expect(html).toContain('This substrate provides identity, authority, verification, and organizational graph records');
    // Trust metadata warning
    expect(html).toContain('Verification labels are prototype trust metadata only');
    // Directory and entity details
    expect(html).toContain('caucus');
    expect(html).toContain('verified');
    expect(html).toContain('Public prototype member affiliation record; not verified membership.');
    expect(html).toContain('Handle');
    expect(html).toContain('DID');
    expect(html).toContain('Collection');
    expect(html).toContain('Trust label');
    expect(html).toContain('org.dsa.profile.chapter');
    // Org chart
    expect(html).toContain('Organization Graph Explorer');
    expect(html).toContain('Original chart');
    expect(html).toContain('National committees');
    expect(html).toContain('Publications');
    // App layer sections
    expect(html).toContain('Public Activity Feed');
    expect(html).toContain('App Layer');
    expect(html).toContain('Welcome to the prototype chapter feed');
    expect(html).toContain('Public governance demo note');
    expect(html).toContain('Democratic Left');
    expect(html).toContain('A public demo article for the prototype');
    expect(html).toContain('Prototype candidate endorsement sample');
    expect(html).toContain('NYC DSA public orientation');
  });

  it('hides publisher controls in the read-only public demo', () => {
    vi.stubEnv('VITE_DEMO_READ_ONLY', 'true');

    const html = renderToString(<App />);

    // Should show read-only badge and message
    expect(html).toContain('Read-Only Demo');
    expect(html).toContain('Publisher controls are disabled');
    expect(html).toContain('write gateway');
    // Should NOT show publisher forms
    expect(html).not.toContain('Local Publisher Workbench');
    expect(html).not.toContain('Publish Chapter Fixture');
    expect(html).not.toContain('Publish Verification Assertion');
    expect(html).not.toContain('/api/admin/fixtures/ingest');
  });

  it('shows publisher workbench when not in read-only mode', () => {
    const html = renderToString(<App />);

    expect(html).toContain('Local Publisher Workbench');
    expect(html).toContain('Publish Chapter Fixture');
    expect(html).toContain('Publish Verification Assertion');
    expect(html).toContain('/api/admin/fixtures/ingest');
  });

  it('renders the org chart section with source and relationships', () => {
    const html = renderToString(<App initialEntities={[]} initialOrgChart={{ prototype: true, sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', updatedLabel: 'Last updated June 2020', units: [{ uri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', name: 'National Political Committee', shortName: 'NPC', kind: 'national-committee', description: 'National governing committee elected by chapter delegates at convention.', status: 'active' }, { uri: 'at://did:plc:demleft/org.dsa.profile.orgUnit/self', name: 'Democratic Left', shortName: 'Dem Left', kind: 'publication', description: 'National publication that accepts pitches and submissions from members.', status: 'active' }], relationships: [{ uri: 'at://did:plc:chapterdelegates/org.dsa.relationship.governance/npc-elects', subjectUri: 'at://did:plc:chapterdelegates/org.dsa.profile.orgUnit/self', relationship: 'elects', objectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', description: 'Chapter delegates elect the National Political Committee at convention.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' }, { uri: 'at://did:plc:npc/org.dsa.relationship.governance/appoints-publications', subjectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', relationship: 'appoints', objectUri: 'at://did:plc:demleft/org.dsa.profile.orgUnit/self', description: 'NPC appoints the editorial board for publications.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' }] }} />);
    expect(html).toContain('Organization Graph Explorer');
    expect(html).toContain('Original chart');
    expect(html).toContain('Last updated June 2020');
    expect(html).toContain('National Political Committee');
    expect(html).toContain('Chapter delegates elect the National Political Committee at convention');
    expect(html).toContain('National committees');
    expect(html).toContain('Publications');
    expect(html).toContain('NPC appoints the editorial board for publications');
  });

  it('renders the registry health panel in operational summary cards', () => {
    const html = renderToString(<App initialEntities={[]} />);
    expect(html).toContain('Registry Health');
    expect(html).toContain('OK');
    expect(html).toContain('247');
    expect(html).toContain('Total records');
    expect(html).toContain('chapters');
    expect(html).toContain('caucuses');
  });

  it('renders directory entities card in operational summary', () => {
    const html = renderToString(<App initialEntities={[]} />);
    expect(html).toContain('Directory Entities');
    expect(html).toContain('Active records');
  });

  it('renders organization units card in operational summary', () => {
    const html = renderToString(<App initialEntities={[]} />);
    expect(html).toContain('Organization Units');
    expect(html).toContain('Chart entities');
  });

  it('renders app-layer records card in operational summary', () => {
    const html = renderToString(<App initialEntities={[]} />);
    expect(html).toContain('App-Layer Records');
    expect(html).toContain('Public records');
    expect(html).toContain('statements');
    expect(html).toContain('events');
  });

it('renders focused org unit details and relationship directions', () => {
    const html = renderToString(<App initialEntities={[]} initialOrgChart={{ prototype: true, sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', updatedLabel: 'Last updated June 2020', units: [{ uri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', name: 'National Political Committee', shortName: 'NPC', kind: 'national-committee', description: 'National governing committee elected by chapter delegates at convention.', status: 'active', website: 'https://www.dsausa.org/' }, { uri: 'at://did:plc:chapterdelegates/org.dsa.profile.orgUnit/self', name: 'Chapter Delegates', shortName: 'Chapter Delegates', kind: 'delegate-body', description: 'Delegates elected by membership to convention who elect the NPC.', status: 'active' }], relationships: [{ uri: 'at://did:plc:chapterdelegates/org.dsa.relationship.governance/npc-elects', subjectUri: 'at://did:plc:chapterdelegates/org.dsa.profile.orgUnit/self', relationship: 'elects', objectUri: 'at://did:plc:npc/org.dsa.profile.orgUnit/self', description: 'Chapter delegates elect the National Political Committee at convention.', sourceUrl: 'https://www.dsausa.org/files/2020/07/National-DSA-Organization-Chart.jpg', status: 'active', createdAt: '2026-07-01T00:00:00.000Z' }] }} />);
    expect(html).toContain('National Political Committee');
    expect(html).toContain('National committees');
    expect(html).toContain('Website');
    expect(html).toContain('Prototype caveat');
    expect(html).toContain('Incoming');
    expect(html).toContain('Chapter delegates elect the National Political Committee at convention.');
    expect(html).toContain('elects');
  });

  it('renders related civic activity for the selected entity', () => {
    const html = renderToString(<App initialEntities={[{
      id: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
      name: 'New York City DSA',
      shortName: 'NYC-DSA',
      type: 'chapter',
      collection: 'org.dsa.profile.chapter',
      handle: 'nyc.dsausa.org',
      did: 'did:plc:nycdsa',
      jurisdiction: 'New York City, NY',
      trustLabel: 'official',
      verificationStatus: 'verified',
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

    expect(html).toContain('Related Activity');
    expect(html).toContain('Welcome to the prototype chapter feed');
    expect(html).toContain('A public demo article for the prototype');
    expect(html).toContain('Prototype candidate endorsement sample');
    expect(html).toContain('NYC DSA public orientation');
  });

  it('renders empty state when no related civic activity is linked', () => {
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

    // The entity should still show with no related activity
    expect(html).toContain('Michigan DSA');
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
      trustLabel: 'official',
      verificationStatus: 'verified',
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
    expect(html).toContain('Search directory');
    expect(html).toContain('Filter by type');
    expect(html).toContain('Filter by state');
    expect(html).toContain('Type');
    expect(html).toContain('State');
    expect(html).toContain('Michigan DSA');
  });

  it('renders chapter counts and empty-state guidance', () => {
    const html = renderToString(<App initialEntities={[]} initialSearch="zzz" />);
    expect(html).toContain('Showing');
    expect(html).toContain('0');
    expect(html).toContain('No records match your filters');
  });

  it('renders the local prototype publisher and chapter preview', () => {
    const preview = buildChapterFixtureEnvelope(createDefaultChapterDraft());
    const verificationPreview = buildVerificationFixtureEnvelope(createDefaultVerificationDraft());
    const html = renderToString(<App initialEntities={[]} />);
    expect(html).toContain('Local Publisher Workbench');
    expect(html).toContain('Publish Chapter Fixture');
    expect(html).toContain('Publish Verification Assertion');
    expect(html).toContain('Does not create real DSA legitimacy');
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
      trustLabel: 'official',
      record: {
        $type: 'org.dsa.verification.assertion',
        assertion: 'verified',
      },
    });
    expect(preview.uri).toContain(preview.record.subjectUri);
  });

  it('fetches record authority from the configured API base', async () => {
    const resolverData: ResolvedRecordAuthority = {
      status: 'valid',
      record: { uri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', collection: 'org.dsa.profile.chapter', trustLabel: 'official', record: {} },
      revisions: [{ uri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', cid: 'bafy-test', indexedAt: '2026-07-01T00:00:00.000Z' }],
      authorityRecords: [{ uri: 'at://did:plc:nationaldsa/org.dsa.authority.charter/nyc-charter', collection: 'org.dsa.authority.charter', record: {} }],
      caveats: ['fixture source of truth; no external source chain'],
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ data: resolverData }) } as Response);

    await expect(fetchResolvedAuthority('http://localhost:8080', resolverData.record!.uri)).resolves.toEqual(resolverData);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/records/resolve?uri=at%3A%2F%2Fdid%3Aplc%3Anycdsa%2Forg.dsa.profile.chapter%2Fself');
  });

it('renders the authority and status panel with full resolver data', () => {
    const resolvedAuthority: ResolvedRecordAuthority = {
      status: 'valid',
      record: { uri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', collection: 'org.dsa.profile.chapter', trustLabel: 'official', record: {} },
      revisions: [
        { uri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', cid: 'bafyrei123', indexedAt: '2026-07-01T00:00:00.000Z' },
        { uri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self', cid: 'bafyrei456', indexedAt: '2026-06-15T00:00:00.000Z' },
      ],
      authorityRecords: [
        { uri: 'at://did:plc:nationaldsa/org.dsa.authority.charter/nyc-charter', collection: 'org.dsa.authority.charter', record: {} },
        { uri: 'at://did:plc:npc/org.dsa.authority.delegate/npc-delegate', collection: 'org.dsa.authority.delegate', record: {} },
      ],
      caveats: ['fixture source of truth; no external source chain', 'prototype only'],
    };
    const html = renderToString(<App initialEntities={[{
      id: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
      name: 'New York City DSA',
      shortName: 'NYC-DSA',
      type: 'chapter',
      collection: 'org.dsa.profile.chapter',
      handle: 'nyc.dsausa.org',
      did: 'did:plc:nycdsa',
      jurisdiction: 'New York City, NY',
      trustLabel: 'official',
      verificationStatus: 'verified',
      status: 'active',
      record: { record: { $type: 'org.dsa.profile.chapter', name: 'New York City DSA' } },
    }]} initialResolvedAuthority={resolvedAuthority} />);

    expect(html).toContain('Authority &amp; Status');
    expect(html).toContain('Authority status');
    expect(html).toContain('valid');
    expect(html).toContain('Current record');
    expect(html).toContain('at://did:plc:nycdsa/org.dsa.profile.chapter/self');
    expect(html).toContain('org.dsa.profile.chapter');
    expect(html).toContain('Revisions');
    expect(html).toContain('bafyrei123');
    expect(html).toContain('bafyrei456');
    expect(html).toContain('fixture source of truth; no external source chain');
    expect(html).toContain('prototype only');
  });

  it('renders authority panel with different status values', () => {
    const expiredAuthority: ResolvedRecordAuthority = {
      status: 'expired',
      record: { uri: 'at://did:plc:test/org.dsa.profile.chapter/old', collection: 'org.dsa.profile.chapter', trustLabel: 'self-declared', record: {} },
      revisions: [],
      authorityRecords: [],
      caveats: ['record has expired'],
    };
    const html = renderToString(<App initialEntities={[{
      id: 'at://did:plc:test/org.dsa.profile.chapter/old',
      name: 'Old Chapter',
      shortName: 'Old',
      type: 'chapter',
      collection: 'org.dsa.profile.chapter',
      handle: 'old.example.org',
      did: 'did:plc:test',
      jurisdiction: 'Old Location',
      trustLabel: 'self-declared',
      verificationStatus: 'self-declared',
      status: 'active',
      record: { record: { $type: 'org.dsa.profile.chapter' } },
    }]} initialResolvedAuthority={expiredAuthority} />);

    expect(html).toContain('expired');
    expect(html).toContain('record has expired');
    expect(html).toContain('Current record');
  });

it('renders authority panel with no resolver data', () => {
    const html = renderToString(<App initialEntities={[{
      id: 'at://did:plc:new/org.dsa.profile.chapter/new',
      name: 'New Chapter',
      shortName: 'New',
      type: 'chapter',
      collection: 'org.dsa.profile.chapter',
      handle: 'new.example.org',
      did: 'did:plc:new',
      jurisdiction: 'New Location',
      trustLabel: 'official',
      verificationStatus: 'verified',
      status: 'active',
      record: { record: { $type: 'org.dsa.profile.chapter' } },
    }]} initialResolvedAuthority={null} />);

    expect(html).toContain('Authority &amp; Status');
    expect(html).toContain('No resolver data loaded');
  });
});