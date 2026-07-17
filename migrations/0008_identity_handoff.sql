CREATE TABLE IF NOT EXISTS oauth_identity_requests_v1 (
  state_hash text PRIMARY KEY,
  audience text NOT NULL,
  return_uri text NOT NULL,
  -- Opaque 128-bit client CSRF correlation value; returned after callback, not a credential.
  client_state text NOT NULL,
  code_challenge text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_identity_codes_v1 (
  code_hash text PRIMARY KEY,
  account_did text NOT NULL,
  audience text NOT NULL,
  return_uri text NOT NULL,
  code_challenge text NOT NULL,
  authenticated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS oauth_identity_requests_expiry_idx ON oauth_identity_requests_v1(expires_at);
CREATE INDEX IF NOT EXISTS oauth_identity_codes_expiry_idx ON oauth_identity_codes_v1(expires_at);
