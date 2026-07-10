CREATE TABLE IF NOT EXISTS oauth_handoff_requests_v1 (
  state_hash text PRIMARY KEY,
  return_uri text NOT NULL,
  client_state text NOT NULL,
  code_challenge text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_handoff_codes_v1 (
  code_hash text PRIMARY KEY,
  account_did text NOT NULL,
  return_uri text NOT NULL,
  code_challenge text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE TABLE IF NOT EXISTS oauth_handoff_tokens_v1 (
  token_hash text PRIMARY KEY,
  account_did text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS oauth_handoff_requests_expiry_idx
  ON oauth_handoff_requests_v1(expires_at);
CREATE INDEX IF NOT EXISTS oauth_handoff_codes_expiry_idx
  ON oauth_handoff_codes_v1(expires_at);
CREATE INDEX IF NOT EXISTS oauth_handoff_tokens_expiry_idx
  ON oauth_handoff_tokens_v1(expires_at);
