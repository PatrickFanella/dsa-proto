#!/usr/bin/env sh
set -eu

pds_url="${PDS_PUBLIC_URL:-https://pds-staging.dsaslate.us}"
handle="${REGISTRY_HANDLE:-registry.pds-staging.dsaslate.us}"
email="${REGISTRY_EMAIL:-registry@dsaslate.us}"
secret_dir="${1:-deploy/almaz-staging/secrets}"
password_file="$secret_dir/registry-account-password"
session_file="$secret_dir/registry-account.json"
did_file="$secret_dir/registry-root.did"
umask 077
install -d -m 0700 "$secret_dir"

if [ ! -f "$password_file" ]; then
  openssl rand -base64 36 | tr -d '\n' > "$password_file"
  printf '\n' >> "$password_file"
fi
password="$(tr -d '\n' < "$password_file")"

request_file="$secret_dir/.registry-request.tmp"
response_file="$secret_dir/.registry-response.tmp"
jq -n --arg email "$email" --arg handle "$handle" --arg password "$password" \
  '{email: $email, handle: $handle, password: $password}' > "$request_file"
status="$(curl -sS -o "$response_file" -w '%{http_code}' -X POST \
  -H 'content-type: application/json' --data-binary "@$request_file" \
  "$pds_url/xrpc/com.atproto.server.createAccount")"

if [ "$status" = 400 ] || [ "$status" = 409 ]; then
  jq -n --arg identifier "$handle" --arg password "$password" \
    '{identifier: $identifier, password: $password}' > "$request_file"
  status="$(curl -sS -o "$response_file" -w '%{http_code}' -X POST \
    -H 'content-type: application/json' --data-binary "@$request_file" \
    "$pds_url/xrpc/com.atproto.server.createSession")"
fi
rm -f "$request_file"

if [ "$status" != 200 ]; then
  error="$(jq -r '.error // "unknown"' "$response_file" 2>/dev/null || printf unknown)"
  message="$(jq -r '.message // "account request failed"' "$response_file" 2>/dev/null || printf 'account request failed')"
  rm -f "$response_file"
  echo "registry account request failed: HTTP $status $error: $message" >&2
  exit 1
fi

jq -e '.did and .handle and .accessJwt and .refreshJwt' "$response_file" >/dev/null
mv "$response_file" "$session_file"
jq -r '.did' "$session_file" > "$did_file"
chmod 0600 "$password_file" "$session_file" "$did_file"
printf 'registry handle=%s\nregistry did=%s\n' "$handle" "$(cat "$did_file")"
