#!/usr/bin/env sh
set -eu

env_file="${1:-deploy/almaz-staging/.env}"
backup_dir="${BACKUP_DIR:-deploy/almaz-staging/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$backup_dir/$timestamp"
mkdir -p "$destination"
chmod 700 "$destination"

compose="docker compose --env-file $env_file -f deploy/almaz-staging/docker-compose.yml"
$compose exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -9 > "$destination/appview.sql.gz"
$compose exec -T pds tar -czf - -C /pds . > "$destination/pds-data.tar.gz"
$compose exec -T tap tar -czf - -C /data . > "$destination/tap-data.tar.gz"
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$destination" && sha256sum appview.sql.gz pds-data.tar.gz tap-data.tar.gz > SHA256SUMS)
  (cd "$destination" && sha256sum -c SHA256SUMS)
elif command -v shasum >/dev/null 2>&1; then
  (cd "$destination" && shasum -a 256 appview.sql.gz pds-data.tar.gz tap-data.tar.gz > SHA256SUMS)
  (cd "$destination" && shasum -a 256 -c SHA256SUMS)
else
  echo "sha256sum or shasum is required" >&2
  exit 1
fi

if [ -n "${BACKUP_RECOVERY_ARCHIVE:-}" ]; then
  test -f "$BACKUP_RECOVERY_ARCHIVE"
  cp "$BACKUP_RECOVERY_ARCHIVE" "$destination/recovery-material.encrypted"
  chmod 600 "$destination/recovery-material.encrypted"
fi
if [ -n "${BACKUP_REMOTE:-}" ]; then
  rsync -a -- "$destination/" "$BACKUP_REMOTE/$timestamp/"
fi
find "$backup_dir" -mindepth 1 -maxdepth 1 -type d -mtime "+$retention_days" -exec rm -rf {} \;
printf '%s\n' "$destination"
