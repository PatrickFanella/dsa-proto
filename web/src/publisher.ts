export type ChapterDraft = {
  name: string;
  shortName: string;
  handle: string;
  did: string;
  website: string;
  jurisdictionName: string;
  jurisdictionState: string;
};

export type VerificationDraft = {
  subjectUri: string;
  subjectDid: string;
  issuerDid: string;
  issuerHandle: string;
  assertion: 'verified' | 'disputed' | 'revoked' | 'self-declared';
  reason: string;
};

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'chapter';
}

export function createDefaultChapterDraft(): ChapterDraft {
  return {
    name: 'Prototype Chapter',
    shortName: 'Proto Chapter',
    handle: 'prototype.chapter.example',
    did: 'did:plc:prototypechapter',
    website: 'https://example.org/',
    jurisdictionName: 'Prototype City',
    jurisdictionState: 'NY',
  };
}

export function createDefaultVerificationDraft(): VerificationDraft {
  return {
    subjectUri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
    subjectDid: 'did:plc:nycdsa',
    issuerDid: 'did:plc:nationaldsa',
    issuerHandle: 'dsausa.org',
    assertion: 'verified',
    reason: 'Prototype national verification assertion for the NYC chapter example.',
  };
}

export function buildChapterFixtureEnvelope(draft: ChapterDraft) {
  const name = draft.name.trim() || 'Prototype Chapter';
  const shortName = draft.shortName.trim() || name;
  const handle = draft.handle.trim() || `${slugify(name)}.example`;
  const did = draft.did.trim() || `did:plc:${slugify(handle)}`;
  const jurisdictionName = draft.jurisdictionName.trim() || 'Prototype City';
  const jurisdictionState = draft.jurisdictionState.trim() || 'NY';
  return {
    uri: `at://${did}/org.dsa.profile.chapter/self`,
    cid: `bafy-${slugify(name)}-${slugify(handle)}`,
    did,
    handle,
    collection: 'org.dsa.profile.chapter' as const,
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'self-declared' as const,
    record: {
      $type: 'org.dsa.profile.chapter' as const,
      name,
      shortName,
      jurisdiction: { type: 'city', name: jurisdictionName, state: jurisdictionState, country: 'US' },
      website: draft.website.trim() || 'https://example.org/',
      status: 'active' as const,
    },
  };
}

export function buildVerificationFixtureEnvelope(draft: VerificationDraft) {
  const subjectUri = draft.subjectUri.trim() || 'at://did:plc:nycdsa/org.dsa.profile.chapter/self';
  const subjectDid = draft.subjectDid.trim() || 'did:plc:nycdsa';
  const issuerDid = draft.issuerDid.trim() || 'did:plc:nationaldsa';
  const issuerHandle = draft.issuerHandle.trim() || 'dsausa.org';
  const assertion = draft.assertion;
  const reason = draft.reason.trim() || 'Prototype authored verification assertion.';
  return {
    uri: `${subjectUri}/verification`,
    cid: `bafy-${slugify(issuerHandle)}-${slugify(subjectDid)}-${assertion}`,
    did: issuerDid,
    handle: issuerHandle,
    collection: 'org.dsa.verification.assertion' as const,
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'mock-official' as const,
    record: {
      $type: 'org.dsa.verification.assertion' as const,
      subjectUri,
      subjectDid,
      issuerDid,
      issuerHandle,
      assertion,
      reason,
      createdAt: '2026-07-01T00:00:00.000Z',
    },
  };
}
