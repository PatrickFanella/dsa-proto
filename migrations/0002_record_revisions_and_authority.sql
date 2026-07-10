CREATE TABLE IF NOT EXISTS atproto_record_revisions (
  id bigserial PRIMARY KEY,
  uri text NOT NULL,
  cid text NOT NULL,
  did text NOT NULL,
  handle text NOT NULL,
  collection text NOT NULL,
  record jsonb NOT NULL,
  trust_label text NOT NULL,
  indexed_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (uri, cid)
);

CREATE INDEX IF NOT EXISTS atproto_record_revisions_uri_indexed_at_id_idx
  ON atproto_record_revisions(uri, indexed_at, id);
CREATE INDEX IF NOT EXISTS atproto_record_revisions_uri_idx
  ON atproto_record_revisions(uri);
CREATE INDEX IF NOT EXISTS atproto_record_revisions_collection_idx
  ON atproto_record_revisions(collection);
CREATE INDEX IF NOT EXISTS atproto_record_revisions_indexed_at_idx
  ON atproto_record_revisions(indexed_at);

INSERT INTO atproto_record_revisions (uri, cid, did, handle, collection, record, trust_label, indexed_at)
SELECT uri, cid, did, handle, collection, record, coalesce(trust_label, 'uncertain'), indexed_at
FROM atproto_records
ON CONFLICT (uri, cid) DO NOTHING;
