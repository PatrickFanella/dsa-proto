ALTER TABLE atproto_records ADD COLUMN IF NOT EXISTS trust_label text NOT NULL DEFAULT 'uncertain';

UPDATE atproto_records SET trust_label = 'uncertain' WHERE trust_label = 'official';
UPDATE directory_entities SET trust_label = 'uncertain' WHERE trust_label = 'official';

CREATE TABLE IF NOT EXISTS repo_sync_state (
  did text PRIMARY KEY,
  pds text,
  repo_rev text,
  tree_root text,
  last_sequence bigint NOT NULL DEFAULT 0,
  cursor bigint NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('active', 'inactive', 'desynchronized')),
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS atproto_identity_state (
  did text PRIMARY KEY,
  handle text,
  pds text,
  active boolean NOT NULL,
  status text,
  resolved_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS foundation_record_versions (
  id bigserial PRIMARY KEY,
  uri text NOT NULL,
  cid text NOT NULL,
  repo_did text NOT NULL,
  repo_rev text NOT NULL,
  sequence bigint NOT NULL,
  action text NOT NULL DEFAULT 'create' CHECK (action IN ('create', 'update', 'delete')),
  raw_cbor bytea,
  raw_record jsonb,
  validation_status text NOT NULL CHECK (validation_status IN ('verified', 'unverified', 'invalid', 'desynchronized')),
  disposition text NOT NULL DEFAULT 'primary' CHECK (disposition IN ('primary', 'candidate')),
  bootstrap_provenance jsonb,
  observed_at timestamptz NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS foundation_record_versions_uri_rev_idx ON foundation_record_versions(uri, repo_rev, sequence);
CREATE INDEX IF NOT EXISTS foundation_record_versions_repo_idx ON foundation_record_versions(repo_did, repo_rev);
CREATE INDEX IF NOT EXISTS foundation_record_versions_collection_idx ON foundation_record_versions((raw_record->>'$type'));
CREATE UNIQUE INDEX IF NOT EXISTS foundation_record_versions_observation_idx ON foundation_record_versions(uri, cid, repo_rev, action);
CREATE UNIQUE INDEX IF NOT EXISTS foundation_record_versions_delete_idx ON foundation_record_versions(uri, repo_rev) WHERE action = 'delete';

CREATE TABLE IF NOT EXISTS foundation_current_records (
  uri text PRIMARY KEY,
  cid text NOT NULL,
  repo_did text NOT NULL,
  repo_rev text NOT NULL,
  sequence bigint NOT NULL,
  raw_cbor bytea,
  raw_record jsonb NOT NULL,
  validation_status text NOT NULL CHECK (validation_status IN ('verified', 'unverified', 'invalid', 'desynchronized')),
  disposition text NOT NULL DEFAULT 'primary' CHECK (disposition IN ('primary', 'candidate')),
  bootstrap_provenance jsonb,
  observed_at timestamptz NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS foundation_current_records_repo_idx ON foundation_current_records(repo_did, repo_rev);
CREATE INDEX IF NOT EXISTS foundation_current_records_collection_idx ON foundation_current_records((raw_record->>'$type'));

CREATE TABLE IF NOT EXISTS foundation_entity_projection (
  entity_uri text PRIMARY KEY,
  profile jsonb,
  dsa_unit jsonb,
  provenance jsonb NOT NULL,
  authority jsonb NOT NULL,
  lifecycle text NOT NULL CHECK (lifecycle IN ('active', 'inactive', 'superseded', 'archived', 'tombstoned')),
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS authority_evaluations (
  target_uri text NOT NULL,
  target_cid text NOT NULL,
  policy_uri text NOT NULL,
  policy_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('unresolved', 'provisional', 'selfAsserted', 'attested', 'official', 'disputed', 'revoked', 'expired')),
  chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_at timestamptz NOT NULL,
  PRIMARY KEY (target_uri, target_cid, policy_uri, policy_version)
);

CREATE TABLE IF NOT EXISTS review_operations_v1 (
  operation_id text PRIMARY KEY,
  submitter_did text NOT NULL,
  collection text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'published', 'failed')),
  record jsonb NOT NULL,
  reason text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  retention_expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS review_operations_v1_submitter_idx ON review_operations_v1(submitter_did, created_at);
CREATE INDEX IF NOT EXISTS review_operations_v1_status_idx ON review_operations_v1(status, created_at);
CREATE INDEX IF NOT EXISTS review_operations_v1_retention_idx ON review_operations_v1(retention_expires_at);

CREATE TABLE IF NOT EXISTS review_operation_audit_events_v1 (
  event_id text PRIMARY KEY,
  operation_id text NOT NULL,
  actor_did text NOT NULL,
  status text NOT NULL,
  message text NOT NULL,
  decision text CHECK (decision IN ('approve', 'reject')),
  reason text,
  target_uri text,
  target_cid text,
  policy_version text,
  created_at timestamptz NOT NULL
);

ALTER TABLE review_operation_audit_events_v1 DROP CONSTRAINT IF EXISTS review_operation_audit_events_v1_operation_id_fkey;
ALTER TABLE review_operation_audit_events_v1 ADD COLUMN IF NOT EXISTS decision text CHECK (decision IN ('approve', 'reject'));
ALTER TABLE review_operation_audit_events_v1 ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE review_operation_audit_events_v1 ADD COLUMN IF NOT EXISTS target_uri text;
ALTER TABLE review_operation_audit_events_v1 ADD COLUMN IF NOT EXISTS target_cid text;
ALTER TABLE review_operation_audit_events_v1 ADD COLUMN IF NOT EXISTS policy_version text;

CREATE INDEX IF NOT EXISTS review_operation_audit_events_v1_operation_idx ON review_operation_audit_events_v1(operation_id, created_at);

CREATE TABLE IF NOT EXISTS oauth_encrypted_store_v1 (
  namespace text NOT NULL,
  key_hash text NOT NULL,
  iv bytea NOT NULL,
  auth_tag bytea NOT NULL,
  ciphertext bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (namespace, key_hash)
);

CREATE TABLE IF NOT EXISTS oauth_browser_sessions_v1 (
  token_hash text PRIMARY KEY,
  account_did text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS oauth_browser_sessions_v1_account_idx ON oauth_browser_sessions_v1(account_did, expires_at);
CREATE INDEX IF NOT EXISTS oauth_browser_sessions_v1_expiry_idx ON oauth_browser_sessions_v1(expires_at);
