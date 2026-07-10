#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: $0 <backup-directory> [env-file]" >&2
  exit 1
fi
backup_dir="$1"
env_file="${2:-deploy/almaz-staging/.env}"
project="${RESTORE_PROJECT:-dsa-slate-foundation-restore-drill}"
test -f "$backup_dir/SHA256SUMS"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$backup_dir" && sha256sum -c SHA256SUMS)
elif command -v shasum >/dev/null 2>&1; then
  (cd "$backup_dir" && shasum -a 256 -c SHA256SUMS)
else
  echo "sha256sum or shasum is required" >&2
  exit 1
fi

compose="docker compose -p $project --env-file $env_file -f deploy/almaz-staging/docker-compose.yml"
$compose up -d postgres
trap '$compose down -v' EXIT
attempt=0
until $compose exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  test "$attempt" -lt 60 || { echo "restore database did not become ready" >&2; exit 1; }
  sleep 1
done
gzip -cd "$backup_dir/appview.sql.gz" | $compose exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
$compose exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from schema_migrations"' >/dev/null
echo "isolated AppView restore drill passed for $backup_dir"
