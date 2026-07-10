#!/usr/bin/env sh
set -eu

secret_dir="${1:-deploy/almaz-staging/secrets}"
umask 077
install -d -m 0700 "$secret_dir"

if [ ! -f "$secret_dir/postgres.env" ]; then
  postgres_password="$(openssl rand -hex 32)"
  printf 'POSTGRES_DB=dsaslate_foundation\nPOSTGRES_USER=dsaslate\nPOSTGRES_PASSWORD=%s\n' "$postgres_password" > "$secret_dir/postgres.env"
fi

if [ ! -f "$secret_dir/appview.env" ]; then
  # The generated password is hexadecimal, so it is safe in the URL authority.
  # shellcheck disable=SC1090
  . "$secret_dir/postgres.env"
  printf 'DATABASE_URL=postgres://%s:%s@postgres:5432/%s?sslmode=disable\n' "$POSTGRES_USER" "$POSTGRES_PASSWORD" "$POSTGRES_DB" > "$secret_dir/appview.env"
fi

if [ ! -f "$secret_dir/pds.env" ]; then
  printf '%s\n' \
    'PDS_HOSTNAME=pds-staging.dsaslate.us' \
    'PDS_PORT=3000' \
    'PDS_SERVICE_HANDLE_DOMAINS=.pds-staging.dsaslate.us' \
    'PDS_DATA_DIRECTORY=/pds' \
    'PDS_BLOBSTORE_DISK_LOCATION=/pds/blocks' \
    'PDS_DID_PLC_URL=https://plc.directory' \
    'PDS_INVITE_REQUIRED=false' \
    'PDS_RATE_LIMITS_ENABLED=true' \
    "PDS_JWT_SECRET=$(openssl rand -hex 32)" \
    "PDS_DPOP_SECRET=$(openssl rand -hex 32)" \
    "PDS_ADMIN_PASSWORD=$(openssl rand -hex 32)" \
    "PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX=$(openssl rand -hex 32)" \
    > "$secret_dir/pds.env"
fi

if [ ! -f "$secret_dir/tap.env" ]; then
  printf '%s\n' \
    "TAP_ADMIN_PASSWORD=$(openssl rand -hex 32)" \
    'TAP_PLC_URL=https://plc.directory' \
    'TAP_RELAY_URL=https://pds-staging.dsaslate.us' \
    > "$secret_dir/tap.env"
fi

if [ ! -f "$secret_dir/oauth-encryption-key.base64" ]; then
  openssl rand -base64 32 > "$secret_dir/oauth-encryption-key.base64"
fi

if [ ! -f "$secret_dir/oauth-private-key.pem" ]; then
  openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$secret_dir/oauth-private-key.pem"
elif grep -q 'BEGIN EC PRIVATE KEY' "$secret_dir/oauth-private-key.pem"; then
  converted_key="$secret_dir/.oauth-private-key.pkcs8.tmp"
  openssl pkcs8 -topk8 -nocrypt -in "$secret_dir/oauth-private-key.pem" -out "$converted_key"
  mv "$converted_key" "$secret_dir/oauth-private-key.pem"
fi

chmod 0600 "$secret_dir"/*
printf 'staging secret files are present with restrictive permissions\n'
