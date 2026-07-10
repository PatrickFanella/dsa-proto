# Runtime secrets

Create these untracked files with mode `0600` before starting staging:

- `postgres.env`: `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`.
- `appview.env`: a percent-encoded `DATABASE_URL` using the same database credentials.
- `pds.env`: the official PDS variables, including `PDS_HOSTNAME=pds-staging.dsaslate.us`, `PDS_SERVICE_HANDLE_DOMAINS=.pds-staging.dsaslate.us`, JWT, admin, DPoP, and PLC rotation secrets. Do not enable `PDS_DEV_MODE` in staging.
- `tap.env`: `TAP_ADMIN_PASSWORD` and reviewed relay/PLC settings.
- `oauth-encryption-key.base64`: exactly 32 random bytes encoded as base64.
- `oauth-private-key.pem`: the OAuth confidential-client signing key.

Do not commit this directory. Back up the PDS data, OAuth/AppView database, and separately encrypted recovery material off-host.
