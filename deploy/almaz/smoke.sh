#!/usr/bin/env sh
set -eu

env_file="${1:-deploy/almaz/.env}"
if [ ! -f "$env_file" ]; then
  echo "missing env file: $env_file" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

api_local="http://127.0.0.1:${API_PORT:-18080}"
web_local="http://127.0.0.1:${WEB_PORT:-18081}"
public_base="${PUBLIC_BASE_URL:-https://${PUBLIC_HOST:-demo.dsaslate.us}}"

expect_status() {
  method="$1"
  url="$2"
  expected="$3"
  code="$(curl -fsS -o /tmp/dsa-proto-smoke-body -w '%{http_code}' -X "$method" "$url" || true)"
  if [ "$code" != "$expected" ]; then
    echo "expected $expected from $method $url, got $code" >&2
    if [ -f /tmp/dsa-proto-smoke-body ]; then cat /tmp/dsa-proto-smoke-body >&2; fi
    exit 1
  fi
}

expect_json_nonempty_entities() {
  url="$1"
  body="$(curl -fsS "$url")"
  printf '%s' "$body" | python3 -c 'import json,sys; payload=json.load(sys.stdin); data=payload.get("data", []); assert isinstance(data, list) and len(data) > 0, "expected non-empty data[]"'
}

expect_ready_with_entities() {
  url="$1"
  body="$(curl -fsS "$url")"
  printf '%s' "$body" | python3 -c 'import json,sys; payload=json.load(sys.stdin); assert payload.get("status") == "ready", payload; assert int(payload.get("entityCount", 0)) > 0, payload'
}

expect_spa_shell() {
  url="$1"
  body="$(curl -fsS "$url")"
  printf '%s' "$body" | grep -q '<div id="root"></div>'
}

compose_config="$(docker compose --env-file "$env_file" -f deploy/almaz/docker-compose.yml config)"
published_count="$(printf '%s' "$compose_config" | grep -c 'published:')"
loopback_count="$(printf '%s' "$compose_config" | grep -c 'host_ip: 127.0.0.1')"
if [ "$published_count" != "$loopback_count" ]; then
  echo "all published ports must bind to 127.0.0.1 before Caddy exposure" >&2
  exit 1
fi
if printf '%s' "$compose_config" | grep -q 'target: 5432'; then
  echo "postgres must not publish a host port in deploy/almaz/docker-compose.yml" >&2
  exit 1
fi

expect_status GET "$api_local/health" 200
expect_ready_with_entities "$api_local/ready"
expect_json_nonempty_entities "$api_local/api/entities"
expect_status POST "$api_local/api/admin/fixtures/ingest" 404
expect_spa_shell "$web_local/"

if [ "${CHECK_PUBLIC_URL:-false}" = "true" ]; then
  expect_status GET "$public_base/health" 200
  expect_ready_with_entities "$public_base/ready"
  expect_json_nonempty_entities "$public_base/api/entities"
  expect_status POST "$public_base/api/admin/fixtures/ingest" 404
  expect_spa_shell "$public_base/"
fi

echo "Almaz demo smoke checks passed."
