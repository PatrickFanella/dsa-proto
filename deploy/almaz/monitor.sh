#!/usr/bin/env sh
set -eu

env_file="${1:-deploy/almaz/.env}"
if [ ! -f "$env_file" ]; then
  echo "missing env file: $env_file" >&2
  exit 1
fi

api_port="$(awk -F= '/^API_PORT=/ { gsub(/^[ \t\"'"'"']+|[ \t\"'"'"']+$/, "", $2); print $2; exit }' "$env_file")"
api_port="${api_port:-18080}"

printf '%s\n' "== containers =="
docker compose --env-file "$env_file" -f deploy/almaz/docker-compose.yml ps

printf '%s\n' "== health =="
for path in health ready; do
  code="$(curl -fsS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${api_port}/$path" || true)"
  printf '%s %s\n' "$path" "$code"
done

printf '%s\n' "== db =="
docker compose --env-file "$env_file" -f deploy/almaz/docker-compose.yml exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null && echo ready || echo not-ready'
