create table if not exists write_operations (
  operation_id text primary key,
  app_id text not null,
  target_uri text,
  collection text,
  request_hash text not null,
  status text not null,
  decision text,
  reason text,
  errors jsonb not null default '[]'::jsonb,
  record jsonb,
  resolver_summary text,
  idempotency_key text,
  idempotency_scope text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists write_operations_app_id_idx on write_operations(app_id);
create index if not exists write_operations_status_idx on write_operations(status);
create index if not exists write_operations_request_hash_idx on write_operations(request_hash);

create table if not exists write_operation_audit_events (
  event_id text primary key,
  operation_id text not null references write_operations(operation_id) on delete cascade,
  event_type text not null,
  status text,
  previous_status text,
  next_status text,
  message text,
  created_at timestamptz not null
);

create index if not exists write_operation_audit_events_operation_id_idx on write_operation_audit_events(operation_id, created_at);
