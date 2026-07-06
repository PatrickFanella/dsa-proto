#!/usr/bin/env sh
set -eu

case "$#" in
  1)
    env_file="deploy/almaz/.env"
    backup_file="$1"
    ;;
  2)
    env_file="$1"
    backup_file="$2"
    ;;
  *)
    echo "usage: $0 [env-file] <backup-file.sql.gz>" >&2
    exit 1
    ;;
esac

if [ ! -f "$env_file" ]; then
  echo "missing env file: $env_file" >&2
  exit 1
fi
if [ ! -f "$backup_file" ]; then
  echo "missing backup file: $backup_file" >&2
  exit 1
fi

printf 'This will restore %s into the compose postgres service. Type YES to continue: ' "$backup_file" >&2
read answer
if [ "$answer" != "YES" ]; then
  echo "aborted" >&2
  exit 1
fi

tmp="$(mktemp -t dsa-proto-restore.XXXXXX.sql)"
trap 'rm -f "$tmp"' EXIT
gzip -cd "$backup_file" > "$tmp"
docker compose --env-file "$env_file" -f deploy/almaz/docker-compose.yml exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$tmp"
