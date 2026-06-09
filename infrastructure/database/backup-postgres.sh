#!/usr/bin/env bash
set -euo pipefail

# Create a compressed PostgreSQL backup on shield-db.
# The backup is stored under /opt/shield/backups/postgres on shield-db.

REMOTE="${REMOTE:-shield-db}"
REMOTE_SECRET_FILE="${REMOTE_SECRET_FILE:-/opt/shield/secrets/database.env}"
BACKUP_DIR="${BACKUP_DIR:-/opt/shield/backups/postgres}"

ssh "$REMOTE" "REMOTE_SECRET_FILE='$REMOTE_SECRET_FILE' BACKUP_DIR='$BACKUP_DIR' sudo -E bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

if [[ ! -f "$REMOTE_SECRET_FILE" ]]; then
  printf 'missing secret file: %s\n' "$REMOTE_SECRET_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$REMOTE_SECRET_FILE"

db_name="${DATABASE_NAME:-${DB_NAME:-shield_pdp}}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="${BACKUP_DIR}/${db_name}-${timestamp}.dump"

install -d -m 700 -o postgres -g postgres "$BACKUP_DIR"
sudo -u postgres pg_dump --format=custom --compress=9 --file="$backup_path" "$db_name"
chown postgres:postgres "$backup_path"
chmod 600 "$backup_path"

printf 'backup created: %s\n' "$backup_path"
REMOTE_SCRIPT
