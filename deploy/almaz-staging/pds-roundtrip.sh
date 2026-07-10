#!/usr/bin/env sh
set -eu

pds_url="${PDS_PUBLIC_URL:-https://pds-staging.dsaslate.us}"
api_url="${APPVIEW_PUBLIC_URL:-https://api-staging.dsaslate.us}"
secret_dir="${1:-deploy/almaz-staging/secrets}"
password="$(tr -d '\n' < "$secret_dir/registry-account-password")"
session_file="$secret_dir/registry-account.json"
request_file="$secret_dir/.roundtrip-request.tmp"
response_file="$secret_dir/.roundtrip-response.tmp"
umask 077
trap 'rm -f "$request_file" "$response_file"' EXIT

handle="$(jq -r '.handle' "$session_file")"
jq -n --arg identifier "$handle" --arg password "$password" \
  '{identifier: $identifier, password: $password}' > "$request_file"
curl -fsS -X POST -H 'content-type: application/json' --data-binary "@$request_file" \
  "$pds_url/xrpc/com.atproto.server.createSession" > "$response_file"
jq -e '.did and .accessJwt and .refreshJwt' "$response_file" >/dev/null
mv "$response_file" "$session_file"
token="$(jq -r '.accessJwt' "$session_file")"
did="$(jq -r '.did' "$session_file")"

curl -fsS -H "authorization: Bearer $token" \
  "$pds_url/xrpc/com.atproto.repo.listRecords?repo=$did&collection=us.dsaslate.temp.orgEntity&limit=100" \
  | jq -r '.records[] | select(.value.displayName == "Staging deployment canary") | [.uri, .cid] | @tsv' \
  | while IFS="$(printf '\t')" read -r stale_uri stale_cid; do
      stale_collection="$(printf '%s' "$stale_uri" | awk -F/ '{print $(NF-1)}')"
      stale_rkey="$(printf '%s' "$stale_uri" | awk -F/ '{print $NF}')"
      jq -n --arg repo "$did" --arg collection "$stale_collection" --arg rkey "$stale_rkey" --arg cid "$stale_cid" \
        '{repo: $repo, collection: $collection, rkey: $rkey, swapRecord: $cid}' > "$request_file"
      curl -fsS -X POST -H "authorization: Bearer $token" -H 'content-type: application/json' \
        --data-binary "@$request_file" "$pds_url/xrpc/com.atproto.repo.deleteRecord" >/dev/null
    done

created_at="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
jq -n --arg repo "$did" --arg createdAt "$created_at" '{
  repo: $repo,
  collection: "us.dsaslate.temp.orgEntity",
  validate: false,
  record: {
    "$type": "us.dsaslate.temp.orgEntity",
    displayName: "Staging deployment canary",
    entityType: "organization",
    createdAt: $createdAt
  }
}' > "$request_file"
curl -fsS -X POST -H "authorization: Bearer $token" -H 'content-type: application/json' \
  --data-binary "@$request_file" "$pds_url/xrpc/com.atproto.repo.createRecord" > "$response_file"
uri="$(jq -r '.uri' "$response_file")"
cid="$(jq -r '.cid' "$response_file")"
test -n "$uri"
test -n "$cid"

observed=false
attempt=0
while [ "$attempt" -lt 60 ]; do
  resolution="$(curl -fsS "$api_url/xrpc/us.dsaslate.temp.resolveAuthority?uri=$(jq -rn --arg value "$uri" '$value|@uri')")"
  if [ "$(printf '%s' "$resolution" | jq -r '.provenance.cid // ""')" = "$cid" ] && \
     [ "$(printf '%s' "$resolution" | jq -r '.authority.status // ""')" = provisional ]; then
    observed=true
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done
test "$observed" = true

collection="$(printf '%s' "$uri" | awk -F/ '{print $(NF-1)}')"
rkey="$(printf '%s' "$uri" | awk -F/ '{print $NF}')"
jq -n --arg repo "$did" --arg collection "$collection" --arg rkey "$rkey" --arg cid "$cid" \
  '{repo: $repo, collection: $collection, rkey: $rkey, swapRecord: $cid}' > "$request_file"
curl -fsS -X POST -H "authorization: Bearer $token" -H 'content-type: application/json' \
  --data-binary "@$request_file" "$pds_url/xrpc/com.atproto.repo.deleteRecord" >/dev/null

deleted=false
attempt=0
while [ "$attempt" -lt 60 ]; do
  resolution="$(curl -fsS "$api_url/xrpc/us.dsaslate.temp.resolveAuthority?uri=$(jq -rn --arg value "$uri" '$value|@uri')")"
  if [ "$(printf '%s' "$resolution" | jq -r '.deletedAt // ""')" != "" ]; then
    deleted=true
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done
test "$deleted" = true
printf 'staging PDS -> Tap -> AppView round trip passed: %s\n' "$uri"
