import { describe, expect, it, vi } from 'vitest';
import { InMemoryWriteOperationStore, writeOperationSchema } from './write-operations.js';

describe('write operations store', () => {
  it('creates an operation with an initial audit event', () => {
    const store = new InMemoryWriteOperationStore();
    const op = store.createOperation({ appId: 'demo-app', requestHash: 'sha256:abc', targetUri: 'at://did:plc:test/org.dsa.event.public/1', collection: 'org.dsa.event.public', idempotencyKey: 'idem-1', idempotencyScope: 'org.dsa.event.public' });

    expect(writeOperationSchema.parse(op)).toMatchObject({ appId: 'demo-app', requestHash: 'sha256:abc', status: 'dry_run', idempotencyKey: 'idem-1', idempotencyScope: 'org.dsa.event.public' });
    expect(op.auditEvents).toHaveLength(1);
    expect(op.auditEvents[0]).toMatchObject({ type: 'created', status: 'dry_run' });
  });

  it('records status transitions in audit entries', () => {
    const store = new InMemoryWriteOperationStore();
    const created = store.createOperation({ appId: 'demo-app', requestHash: 'sha256:def', status: 'pending_review' });
    const updated = store.updateOperation(created.operationId, { status: 'accepted', decision: 'approved', message: 'review complete' });

    expect(updated.status).toBe('accepted');
    expect(updated.auditEvents).toHaveLength(3);
    expect(updated.auditEvents[1]).toMatchObject({ type: 'status_changed', previousStatus: 'pending_review', nextStatus: 'accepted' });
    expect(updated.auditEvents[2]).toMatchObject({ type: 'updated' });
  });

  it('stores rejected validation errors without public ingestion', () => {
    const store = new InMemoryWriteOperationStore();
    const ingestRepository = { ingestRecordEnvelopes: vi.fn() };
    const op = store.createOperation({ appId: 'demo-app', requestHash: 'sha256:ghi', status: 'rejected', reason: 'validation failed', errors: ['missing title', 'bad uri'] });

    expect(op.status).toBe('rejected');
    expect(op.errors).toEqual(['missing title', 'bad uri']);
    expect(ingestRepository.ingestRecordEnvelopes).not.toHaveBeenCalled();
  });

  it('keeps dry run operations private as operation records only', () => {
    const store = new InMemoryWriteOperationStore();
    const op = store.createOperation({ appId: 'demo-app', requestHash: 'sha256:jkl', status: 'dry_run', resolverSummary: 'preview only' });

    expect(op.record).toBeUndefined();
    expect(op.resolverSummary).toBe('preview only');
    expect(store.listOperations()).toHaveLength(1);
  });
});
