ALTER TABLE oauth_handoff_requests_v1
  ADD COLUMN IF NOT EXISTS permission_set text NOT NULL
  DEFAULT 'us.dsaslate.temp.authManageDelegations';

ALTER TABLE oauth_handoff_codes_v1
  ADD COLUMN IF NOT EXISTS permission_set text NOT NULL
  DEFAULT 'us.dsaslate.temp.authManageDelegations';

ALTER TABLE oauth_handoff_tokens_v1
  ADD COLUMN IF NOT EXISTS permission_set text NOT NULL
  DEFAULT 'us.dsaslate.temp.authManageDelegations';
