CREATE TABLE IF NOT EXISTS app_metadata (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS atproto_records (
  uri text PRIMARY KEY,
  cid text NOT NULL,
  did text NOT NULL,
  handle text NOT NULL,
  collection text NOT NULL,
  record jsonb NOT NULL,
  trust_label text NOT NULL DEFAULT 'uncertain',
  indexed_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS directory_entities (
  id text PRIMARY KEY,
  record_uri text NOT NULL REFERENCES atproto_records(uri) ON DELETE CASCADE,
  entity_type text NOT NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  handle text NOT NULL,
  did text NOT NULL,
  jurisdiction_name text NOT NULL,
  jurisdiction_region text NOT NULL,
  website text NOT NULL,
  description text,
  trust_label text NOT NULL,
  verification_status text NOT NULL DEFAULT 'uncertain',
  verified_by text,
  verification_reason text,
  status text NOT NULL,
  search_text text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS directory_entities_entity_type_idx ON directory_entities(entity_type);
CREATE INDEX IF NOT EXISTS directory_entities_search_text_idx ON directory_entities(search_text);
