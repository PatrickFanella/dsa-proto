#!/usr/bin/env sh
set -eu

env_file="${1:-deploy/almaz-staging/.env}"
backup_dir="${BACKUP_DIR:-deploy/almaz-staging/backups}"
api_port="${API_LOOPBACK_PORT:-18090}"
pds_port="${PDS_LOOPBACK_PORT:-13000}"
disk_usage_alert_percent="${DISK_USAGE_ALERT_PERCENT:-90}"
compose="docker compose --env-file $env_file -f deploy/almaz-staging/docker-compose.yml"

$compose ps
curl -fsS "http://127.0.0.1:$api_port/ready" >/dev/null
sync_json="$(curl -fsS "http://127.0.0.1:$api_port/api/v1/sync/status")"
echo "$sync_json"
test "$(printf '%s' "$sync_json" | jq -r '.data.desynchronizedRepoCount')" = "0" || { echo "desynchronized repositories detected" >&2; exit 1; }
curl -fsS "http://127.0.0.1:$pds_port/xrpc/_health" >/dev/null
$compose exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null
$compose exec -T postgres sh -lc 'test "$(psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from review_operations_v1 where status = '\''failed'\''")" = 0' || { echo "failed review publications detected" >&2; exit 1; }
$compose exec -T tap sh -lc 'auth="$(printf "admin:%s" "$TAP_ADMIN_PASSWORD" | base64 | tr -d "\n")"; wget -qO- --header="Authorization: Basic $auth" http://tap:2480/stats/outbox-buffer'
disk_usage_percent="$(df -P "$backup_dir" | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
df -P "$backup_dir"
test -n "$disk_usage_percent" || { echo "could not determine staging disk usage" >&2; exit 1; }
test "$disk_usage_percent" -lt "$disk_usage_alert_percent" || { echo "staging disk usage is ${disk_usage_percent}% (alert threshold: ${disk_usage_alert_percent}%)" >&2; exit 1; }

latest_backup="$(find "$backup_dir" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort | tail -1)"
test -n "$latest_backup" || { echo "no staging backup found" >&2; exit 1; }
if stat -c %Y "$latest_backup" >/dev/null 2>&1; then
  backup_mtime="$(stat -c %Y "$latest_backup")"
else
  backup_mtime="$(stat -f %m "$latest_backup")"
fi
age_seconds=$(( $(date +%s) - backup_mtime ))
test "$age_seconds" -lt 129600 || { echo "latest staging backup is older than 36 hours" >&2; exit 1; }
echo "staging monitor checks passed"
