import { z } from 'zod';
import { recordEnvelopeSchema, trustLabelSchema, type RecordEnvelope } from './domain.js';

export const foundationCollectionFamilies = [
  'org.dsa.profile.',
  'org.dsa.relationship.governance',
  'org.dsa.authority.',
  'org.dsa.verification.assertion',
  'org.dsa.identity.continuity',
  'org.dsa.record.archive',
  'org.dsa.affiliation.member',
] as const;

const appRegistryEntrySchema = z.object({
  appId: z.string().min(1),
  displayName: z.string().min(1),
  token: z.string().min(1),
  allowedCollections: z.array(z.string().min(1)).default([]),
  allowedSubjectUris: z.array(z.string().startsWith('at://')).optional(),
  allowedHostEntityUris: z.array(z.string().startsWith('at://')).optional(),
  trustLabelCeiling: trustLabelSchema.optional(),
  allowedTrustLabels: z.array(trustLabelSchema).optional(),
  reviewRequired: z.boolean(),
  enabled: z.boolean(),
});

export type AppRegistryEntry = z.infer<typeof appRegistryEntrySchema>;

// The legacy gateway is retained only for compatibility tests. Runtime credentials
// must be injected; no bearer token or enabled writer ships in source.
export const appRegistryFixture: AppRegistryEntry[] = [];

const trustLabelOrder = ['uncertain', 'community-submitted', 'self-declared', 'secondary-source', 'verified-by-caucus', 'verified-by-chapter', 'verified-by-national', 'official'] as const;

export type AppAuthResult = { app: AppRegistryEntry };
export type AppScopeValidationIssue = { reason: string };

export function getAppRegistry(): AppRegistryEntry[] {
  return appRegistryFixture.map((entry) => appRegistryEntrySchema.parse(entry));
}

export function authenticateAppFromToken(token: string, registry: AppRegistryEntry[] = getAppRegistry()): AppAuthResult | undefined {
  const app = registry.find((entry) => entry.enabled && entry.token === token);
  return app ? { app } : undefined;
}

function isFoundationCollection(collection: string) {
  return foundationCollectionFamilies.some((prefix) => collection === prefix || collection.startsWith(prefix));
}

function allowedTrustLabel(app: AppRegistryEntry, trustLabel: z.infer<typeof trustLabelSchema>) {
  if (app.allowedTrustLabels?.includes(trustLabel)) return true;
  if (app.trustLabelCeiling) {
    return trustLabelOrder.indexOf(trustLabel) <= trustLabelOrder.indexOf(app.trustLabelCeiling);
  }
  return trustLabel === 'community-submitted' || trustLabel === 'uncertain';
}

export function validateRecordEnvelopeAgainstAppScope(record: RecordEnvelope, app: AppRegistryEntry): AppScopeValidationIssue[] {
  const issues: AppScopeValidationIssue[] = [];
  const parsed = recordEnvelopeSchema.safeParse(record);
  if (!parsed.success) return [{ reason: 'invalid record envelope' }];
  if (!app.enabled) issues.push({ reason: `app ${app.appId} is disabled` });
  if (!app.allowedCollections.includes(record.collection)) issues.push({ reason: `collection ${record.collection} not allowed for app ${app.appId}` });
  if (isFoundationCollection(record.collection)) issues.push({ reason: `foundation family blocked by default: ${record.collection}` });
  if (!allowedTrustLabel(app, record.trustLabel)) issues.push({ reason: `trust label ${record.trustLabel} not allowed for app ${app.appId}` });
  if (app.allowedSubjectUris && 'subjectUri' in record.record && typeof record.record.subjectUri === 'string' && !app.allowedSubjectUris.includes(record.record.subjectUri)) {
    issues.push({ reason: `subject ${record.record.subjectUri} not allowed for app ${app.appId}` });
  }
  if (record.collection === 'org.dsa.event.public') {
    const eventRecord = record.record as { hostEntityUri: string };
    if (app.allowedHostEntityUris && !app.allowedHostEntityUris.includes(eventRecord.hostEntityUri)) {
      issues.push({ reason: `host ${eventRecord.hostEntityUri} not allowed for app ${app.appId}` });
    }
  }
  return issues;
}
