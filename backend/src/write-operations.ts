import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const writeOperationStatusSchema = z.enum(['dry_run', 'pending_review', 'accepted', 'rejected', 'conflict']);

export const writeOperationAuditEventTypeSchema = z.enum(['created', 'status_changed', 'updated']);

export const writeOperationSchema = z.object({
  operationId: z.string().min(1),
  appId: z.string().min(1),
  targetUri: z.string().min(1).optional(),
  collection: z.string().min(1).optional(),
  requestHash: z.string().min(1),
  status: writeOperationStatusSchema,
  decision: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  errors: z.array(z.string().min(1)).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  record: z.unknown().optional(),
  resolverSummary: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).optional(),
  idempotencyScope: z.string().min(1).optional(),
  auditEvents: z.array(z.object({
    eventId: z.string().min(1),
    type: writeOperationAuditEventTypeSchema,
    createdAt: z.string().datetime(),
    status: writeOperationStatusSchema.optional(),
    previousStatus: writeOperationStatusSchema.optional(),
    nextStatus: writeOperationStatusSchema.optional(),
    message: z.string().min(1).optional(),
  })),
});

export type WriteOperationStatus = z.infer<typeof writeOperationStatusSchema>;
export type WriteOperation = z.infer<typeof writeOperationSchema>;

export type CreateWriteOperationInput = {
  appId: string;
  requestHash: string;
  status?: WriteOperationStatus;
  targetUri?: string;
  collection?: string;
  decision?: string;
  reason?: string;
  errors?: string[];
  record?: unknown;
  resolverSummary?: string;
  idempotencyKey?: string;
  idempotencyScope?: string;
  operationId?: string;
  createdAt?: string;
  skipIdempotencyLookup?: boolean;
};

type AuditEvent = WriteOperation['auditEvents'][number];

function idempotencyKeyFor(appId: string, idempotencyKey: string) {
  return `${appId}:${idempotencyKey}`;
}

export class InMemoryWriteOperationStore {
  private operations = new Map<string, WriteOperation>();
  private idempotencyIndex = new Map<string, string>();

  getOperationByIdempotencyKey(appId: string, idempotencyKey: string) {
    const operationId = this.idempotencyIndex.get(idempotencyKeyFor(appId, idempotencyKey));
    return operationId ? this.operations.get(operationId) : undefined;
  }

  createOperation(input: CreateWriteOperationInput): WriteOperation {
    if (input.idempotencyKey && !input.skipIdempotencyLookup) {
      const existing = this.getOperationByIdempotencyKey(input.appId, input.idempotencyKey);
      if (existing) {
        if (existing.requestHash === input.requestHash) return existing;
        return this.createOperation({ ...input, operationId: randomUUID(), status: 'conflict', reason: 'idempotency key reused with different request', errors: ['idempotency key reused with different request hash'], skipIdempotencyLookup: true });
      }
    }
    const now = input.createdAt ?? new Date().toISOString();
    const operationId = input.operationId ?? randomUUID();
    const status = input.status ?? 'dry_run';
    const operation: WriteOperation = {
      operationId,
      appId: input.appId,
      targetUri: input.targetUri,
      collection: input.collection,
      requestHash: input.requestHash,
      status,
      decision: input.decision,
      reason: input.reason,
      errors: input.errors ?? [],
      createdAt: now,
      updatedAt: now,
      record: input.record,
      resolverSummary: input.resolverSummary,
      idempotencyKey: input.idempotencyKey,
      idempotencyScope: input.idempotencyScope,
      auditEvents: [this.makeAuditEvent('created', now, status, undefined, status, 'operation created')],
    };
    this.operations.set(operationId, operation);
    if (input.idempotencyKey && operation.status !== 'conflict') this.idempotencyIndex.set(idempotencyKeyFor(input.appId, input.idempotencyKey), operationId);
    return operation;
  }

  updateOperation(operationId: string, updates: Partial<Omit<WriteOperation, 'operationId' | 'createdAt' | 'auditEvents'>> & { status?: WriteOperationStatus; message?: string }): WriteOperation {
    const current = this.operations.get(operationId);
    if (!current) throw new Error(`unknown write operation ${operationId}`);
    const nextStatus = updates.status ?? current.status;
    const updatedAt = new Date().toISOString();
    const auditEvents = [...current.auditEvents];
    if (nextStatus !== current.status) auditEvents.push(this.makeAuditEvent('status_changed', updatedAt, nextStatus, current.status, nextStatus, updates.message));
    if (updates.message || updates.decision || updates.reason || updates.errors || updates.record || updates.resolverSummary || updates.idempotencyKey || updates.idempotencyScope) {
      auditEvents.push(this.makeAuditEvent('updated', updatedAt, nextStatus, current.status, nextStatus, updates.message));
    }
    const next: WriteOperation = { ...current, ...updates, status: nextStatus, updatedAt, auditEvents };
    this.operations.set(operationId, next);
    if (next.idempotencyKey) this.idempotencyIndex.set(idempotencyKeyFor(next.appId, next.idempotencyKey), operationId);
    return next;
  }

  getOperation(operationId: string) {
    return this.operations.get(operationId);
  }

  listOperations() {
    return [...this.operations.values()];
  }

  private makeAuditEvent(type: AuditEvent['type'], createdAt: string, status: WriteOperationStatus | undefined, previousStatus: WriteOperationStatus | undefined, nextStatus: WriteOperationStatus | undefined, message?: string): AuditEvent {
    return { eventId: randomUUID(), type, createdAt, status, previousStatus, nextStatus, message };
  }
}
