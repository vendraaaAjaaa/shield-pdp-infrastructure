#!/usr/bin/env bash
set -euo pipefail

# Test shield-cloud to shield-db PostgreSQL connectivity using the local secret file.

LOCAL_SECRET_FILE="${LOCAL_SECRET_FILE:-/opt/shield/secrets/database.env}"

if [[ ! -f "$LOCAL_SECRET_FILE" ]]; then
  printf 'missing local secret file: %s\n' "$LOCAL_SECRET_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$LOCAL_SECRET_FILE"

host="${DATABASE_HOST:-${DB_HOST:-100.110.198.103}}"
port="${DATABASE_PORT:-${DB_PORT:-5432}}"
db_name="${DATABASE_NAME:-${DB_NAME:-shield_pdp}}"
db_user="${DATABASE_USER:-${DB_USER:-shield_user}}"
export PGPASSWORD="${DATABASE_PASSWORD:-${DB_PASSWORD:-${PGPASSWORD:-}}}"

if [[ -z "$PGPASSWORD" ]]; then
  printf 'database password missing in %s\n' "$LOCAL_SECRET_FILE" >&2
  exit 1
fi

psql "host=${host} port=${port} dbname=${db_name} user=${db_user}" \
  -c "SELECT current_database(), current_user, inet_server_addr(), inet_client_addr();"
