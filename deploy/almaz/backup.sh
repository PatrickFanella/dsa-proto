#!/usr/bin/env sh
set -eu

env_file="${1:-deploy/almaz/.env}"
if [ ! -f "$env_file" ]; then
  echo "missing env file: $env_file" >&2
  exit 1
fi

backup_dir="${BACKUP_DIR:-deploy/almaz/backups}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$backup_dir/postgres-$ts.sql.gz"
tmp="$(mktemp -t dsa-proto-backup.XXXXXX.sql)"
trap 'rm -f "$tmp" "$out.tmp"' EXIT

docker compose --env-file "$env_file" -f deploy/almaz/docker-compose.yml exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$tmp"
gzip -9 -c "$tmp" > "$out.tmp"
mv "$out.tmp" "$out"

echo "wrote $out"
