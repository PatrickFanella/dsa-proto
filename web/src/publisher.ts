export type ChapterDraft = {
  name: string;
  shortName: string;
  handle: string;
  did: string;
  website: string;
  jurisdictionName: string;
  jurisdictionState: string;
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
