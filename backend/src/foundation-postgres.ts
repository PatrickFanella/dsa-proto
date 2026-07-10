import type { Pool, PoolClient } from 'pg';
import type { FoundationRecord } from './foundation-model.js';
import type { IdentityState, RepoSyncState, ReviewOperation } from './foundation-service.js';

type Queryable = Pick<Pool | PoolClient, 'query'>;

function rowToRecord(row: Record<string, unknown>): FoundationRecord {
  return {
    uri: String(row.uri),
    cid: String(row.cid),
    repoDid: String(row.repo_did),
    repoRev: String(row.repo_rev),
    sequence: Number(row.sequence),
    observedAt: new Date(row.observed_at as Date | string).toISOString(),
    status: row.validation_status as FoundationRecord['status'],
    record: row.raw_record as FoundationRecord['record'],
    rawCbor: row.raw_cbor ? new Uint8Array(row.raw_cbor as Buffer) : undefined,
    bootstrap: row.bootstrap_provenance as FoundationRecord['bootstrap'],
    disposition: row.disposition as FoundationRecord['disposition'],
    deletedAt: row.deleted_at ? new Date(row.deleted_at as Date | string).toISOString() : undefined,
  };
}

async function persistRepoState(queryable: Queryable, state: RepoSyncState) {
  await queryable.query(
    `insert into repo_sync_state (did,pds,repo_rev,rev_sequence,tree_root,last_sequence,cursor,status,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (did) do update set pds=excluded.pds, repo_rev=excluded.repo_rev, rev_sequence=excluded.rev_sequence, tree_root=excluded.tree_root, last_sequence=greatest(repo_sync_state.last_sequence,excluded.last_sequence), cursor=greatest(repo_sync_state.cursor,excluded.cursor), status=excluded.status, updated_at=excluded.updated_at`,
    [state.did, state.pds ?? null, state.rev ?? null, state.revSequence ?? 0, state.treeRoot ?? null, state.lastSequence, state.cursor, state.status, state.updatedAt],
  );
}

async function persistIdentityState(queryable: Queryable, state: IdentityState) {
  await queryable.query(
    `insert into atproto_identity_state (did,handle,pds,active,status,resolved_at) values ($1,$2,$3,$4,$5,$6)
     on conflict (did) do update set handle=excluded.handle,pds=excluded.pds,active=excluded.active,status=excluded.status,resolved_at=excluded.resolved_at`,
    [state.did, state.handle ?? null, state.pds ?? null, state.active, state.status ?? null, state.resolvedAt],
  );
}

async function persistRecord(queryable: Queryable, record: FoundationRecord, action: 'create' | 'update' | 'delete' = 'create') {
  await queryable.query(
    `insert into foundation_record_versions (uri, cid, repo_did, repo_rev, sequence, action, raw_cbor, raw_record, validation_status, disposition, bootstrap_provenance, observed_at, deleted_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     on conflict do nothing`,
    [record.uri, record.cid, record.repoDid, record.repoRev, record.sequence, action, record.rawCbor ? Buffer.from(record.rawCbor) : null, record.record, record.status, record.disposition ?? 'primary', record.bootstrap ?? null, record.observedAt, record.deletedAt ?? null],
  );
  if (action === 'delete' || record.deletedAt) {
    await queryable.query(
      `delete from foundation_current_records
       where uri=$1 and (repo_rev < $2 or (repo_rev = $2 and sequence <= $3))`,
      [record.uri, record.repoRev, record.sequence],
    );
    return;
  }
  await queryable.query(
    `insert into foundation_current_records (uri, cid, repo_did, repo_rev, sequence, raw_cbor, raw_record, validation_status, disposition, bootstrap_provenance, observed_at, deleted_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,null)
     on conflict (uri) do update set cid=excluded.cid, repo_did=excluded.repo_did, repo_rev=excluded.repo_rev, sequence=excluded.sequence, raw_cbor=excluded.raw_cbor, raw_record=excluded.raw_record, validation_status=excluded.validation_status, disposition=excluded.disposition, bootstrap_provenance=excluded.bootstrap_provenance, observed_at=excluded.observed_at, deleted_at=null
     where foundation_current_records.repo_rev < excluded.repo_rev or (foundation_current_records.repo_rev = excluded.repo_rev and foundation_current_records.sequence < excluded.sequence)`,
    [record.uri, record.cid, record.repoDid, record.repoRev, record.sequence, record.rawCbor ? Buffer.from(record.rawCbor) : null, record.record, record.status, record.disposition ?? 'primary', record.bootstrap ?? null, record.observedAt],
  );
}

export class FoundationPostgresPersistence {
  constructor(private readonly pool: Pool) {}

  async loadRecords() {
    const result = await this.pool.query('select uri, cid, repo_did, repo_rev, sequence, raw_cbor, raw_record, validation_status, disposition, bootstrap_provenance, observed_at, deleted_at from foundation_record_versions order by repo_rev, sequence, id');
    return result.rows.map(rowToRecord);
  }

  async persistRecord(record: FoundationRecord, action: 'create' | 'update' | 'delete' = 'create') {
    await persistRecord(this.pool, record, action);
  }

  async replaceBootstrap(records: FoundationRecord[]) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from foundation_current_records where bootstrap_provenance is not null');
      await client.query('delete from foundation_record_versions where bootstrap_provenance is not null');
      for (const record of records) await persistRecord(client, record);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async loadRepoStates(): Promise<RepoSyncState[]> {
    const result = await this.pool.query('select did, pds, repo_rev, rev_sequence, tree_root, last_sequence, cursor, status, updated_at from repo_sync_state');
    return result.rows.map((row) => ({ did: row.did, pds: row.pds ?? undefined, rev: row.repo_rev ?? undefined, revSequence: Number(row.rev_sequence), treeRoot: row.tree_root ?? undefined, lastSequence: Number(row.last_sequence), cursor: Number(row.cursor), status: row.status, updatedAt: new Date(row.updated_at).toISOString() }));
  }

  async persistRepoState(state: RepoSyncState) {
    await persistRepoState(this.pool, state);
  }

  async loadIdentityStates(): Promise<IdentityState[]> {
    const result = await this.pool.query('select did, handle, pds, active, status, resolved_at from atproto_identity_state');
    return result.rows.map((row) => ({ did: row.did, handle: row.handle ?? undefined, pds: row.pds ?? undefined, active: row.active, status: row.status ?? undefined, resolvedAt: new Date(row.resolved_at).toISOString() }));
  }

  async persistIdentityState(state: IdentityState) {
    await persistIdentityState(this.pool, state);
  }

  async persistTapRecord(record: FoundationRecord, action: 'create' | 'update' | 'delete', state: RepoSyncState) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await persistRecord(client, record, action);
      await persistRepoState(client, state);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async persistTapIdentity(identity: IdentityState, state: RepoSyncState) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await persistIdentityState(client, identity);
      await persistRepoState(client, state);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async replaceRepoSnapshot(did: string, records: FoundationRecord[], state: RepoSyncState) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from foundation_current_records where repo_did = $1', [did]);
      for (const record of records) await persistRecord(client, record, 'create');
      await persistRepoState(client, state);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async loadReviewOperations(): Promise<ReviewOperation[]> {
    const [operations, events] = await Promise.all([
      this.pool.query('select operation_id, submitter_did, collection, status, record, reason, created_at, updated_at from review_operations_v1 order by created_at'),
      this.pool.query('select event_id, operation_id, actor_did, status, message, decision, reason, target_uri, target_cid, policy_version, created_at from review_operation_audit_events_v1 order by created_at'),
    ]);
    return operations.rows.map((row) => ({
      operationId: row.operation_id,
      submitterDid: row.submitter_did,
      collection: row.collection,
      status: row.status,
      record: row.record,
      reason: row.reason ?? undefined,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      auditEvents: events.rows.filter((event) => event.operation_id === row.operation_id).map((event) => ({
        eventId: event.event_id, actorDid: event.actor_did, status: event.status, message: event.message,
        ...(event.decision ? { decision: event.decision } : {}),
        ...(event.reason ? { reason: event.reason } : {}),
        ...(event.target_uri && event.target_cid ? { target: { uri: event.target_uri, cid: event.target_cid } } : {}),
        ...(event.policy_version ? { policyVersion: event.policy_version } : {}),
        createdAt: new Date(event.created_at).toISOString(),
      })),
    }));
  }

  async purgeExpiredReviewOperations(now = new Date().toISOString()) {
    const result = await this.pool.query('delete from review_operations_v1 where retention_expires_at <= $1', [now]);
    return result.rowCount ?? 0;
  }

  async persistReviewOperation(operation: ReviewOperation) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into review_operations_v1 (operation_id,submitter_did,collection,status,record,reason,created_at,updated_at,retention_expires_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (operation_id) do update set status=excluded.status,record=excluded.record,reason=excluded.reason,updated_at=excluded.updated_at`,
        [operation.operationId, operation.submitterDid, operation.collection, operation.status, operation.record, operation.reason ?? null, operation.createdAt, operation.updatedAt, new Date(Date.parse(operation.createdAt) + 30 * 24 * 60 * 60_000).toISOString()],
      );
      for (const event of operation.auditEvents) {
        await client.query(
          'insert into review_operation_audit_events_v1 (event_id,operation_id,actor_did,status,message,decision,reason,target_uri,target_cid,policy_version,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (event_id) do nothing',
          [event.eventId, operation.operationId, event.actorDid, event.status, event.message, event.decision ?? null, event.reason ?? null, event.target?.uri ?? null, event.target?.cid ?? null, event.policyVersion ?? null, event.createdAt],
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}
