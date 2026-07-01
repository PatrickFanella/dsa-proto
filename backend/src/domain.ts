import { z } from 'zod';

export const trustLabelSchema = z.enum(['mock-official', 'self-declared', 'unverified', 'experimental']);

export const chapterRecordSchema = z.object({
  $type: z.literal('org.dsa.profile.chapter'),
  name: z.string().min(1),
  shortName: z.string().min(1),
  jurisdiction: z.object({
    type: z.string().min(1),
    name: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
  }),
  website: z.string().url(),
  status: z.enum(['active', 'inactive']),
});

export const mockRecordEnvelopeSchema = z.object({
  uri: z.string().startsWith('at://'),
  cid: z.string().min(1),
  did: z.string().startsWith('did:'),
  handle: z.string().min(1),
  collection: z.literal('org.dsa.profile.chapter'),
  indexedAt: z.string().datetime(),
  trustLabel: trustLabelSchema,
  record: chapterRecordSchema,
});

export type MockRecordEnvelope = z.infer<typeof mockRecordEnvelopeSchema>;
export type ChapterRecord = z.infer<typeof chapterRecordSchema>;

export type ChapterEntity = {
  id: string;
  recordUri: string;
  type: 'chapter';
  name: string;
  shortName: string;
  collection: 'org.dsa.profile.chapter';
  handle: string;
  did: string;
  jurisdiction: string;
  trustLabel: z.infer<typeof trustLabelSchema>;
  status: 'active' | 'inactive';
  website: string;
  searchText: string;
  record: MockRecordEnvelope;
};

export const chapterSeedRecords: MockRecordEnvelope[] = [
  {
    uri: 'at://did:plc:nycdsa/org.dsa.profile.chapter/self',
    cid: 'bafy-mock-nyc',
    did: 'did:plc:nycdsa',
    handle: 'nyc.dsausa.org',
    collection: 'org.dsa.profile.chapter',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'mock-official',
    record: {
      $type: 'org.dsa.profile.chapter',
      name: 'New York City DSA',
      shortName: 'NYC-DSA',
      jurisdiction: { type: 'city', name: 'New York City', state: 'NY', country: 'US' },
      website: 'https://socialists.nyc/',
      status: 'active',
    },
  },
  {
    uri: 'at://did:plc:midsa/org.dsa.profile.chapter/self',
    cid: 'bafy-mock-michigan',
    did: 'did:plc:midsa',
    handle: 'michigan.socialists.org',
    collection: 'org.dsa.profile.chapter',
    indexedAt: '2026-07-01T00:00:00.000Z',
    trustLabel: 'self-declared',
    record: {
      $type: 'org.dsa.profile.chapter',
      name: 'Michigan DSA',
      shortName: 'MI-DSA',
      jurisdiction: { type: 'state', name: 'Michigan', state: 'MI', country: 'US' },
      website: 'https://michigandsa.org/',
      status: 'active',
    },
  },
];

export function normalizeChapter(record: MockRecordEnvelope): ChapterEntity {
  const normalized = mockRecordEnvelopeSchema.parse(record);
  const jurisdiction = `${normalized.record.jurisdiction.name}, ${normalized.record.jurisdiction.state}`;
  return {
    id: normalized.uri,
    recordUri: normalized.uri,
    type: 'chapter',
    name: normalized.record.name,
    shortName: normalized.record.shortName,
    collection: normalized.collection,
    handle: normalized.handle,
    did: normalized.did,
    jurisdiction,
    trustLabel: normalized.trustLabel,
    status: normalized.record.status,
    website: normalized.record.website,
    searchText: [normalized.record.name, normalized.record.shortName, normalized.handle, normalized.did, jurisdiction].join(' ').toLowerCase(),
    record: normalized,
  };
}
