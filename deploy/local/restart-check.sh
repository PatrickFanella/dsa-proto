#!/usr/bin/env sh
set -eu

api_port="${LOCAL_API_PORT:-8080}"
compose="docker compose -f deploy/local/docker-compose.yml"
entities_url="http://127.0.0.1:${api_port}/xrpc/us.dsaslate.temp.listEntities?limit=100"
sync_url="http://127.0.0.1:${api_port}/xrpc/us.dsaslate.temp.getSyncStatus"

before_entities="$(curl -fsS "$entities_url" | jq '.entities | length')"
before_cursor="$(curl -fsS "$sync_url" | jq -r '.sync.lastSequence')"
test -n "$before_entities"
test -n "$before_cursor"

$compose restart api tap-worker >/dev/null
ready=false
attempt=0
while [ "$attempt" -lt 30 ]; do
  if curl -fsS "http://127.0.0.1:${api_port}/ready" >/dev/null 2>&1; then
    ready=true
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done
test "$ready" = true

after_entities="$(curl -fsS "$entities_url" | jq '.entities | length')"
after_cursor="$(curl -fsS "$sync_url" | jq -r '.sync.lastSequence')"
test "$before_entities" = "$after_entities"
test "$before_cursor" = "$after_cursor"
printf 'restart persistence passed: entities=%s cursor=%s\n' "$after_entities" "$after_cursor"
