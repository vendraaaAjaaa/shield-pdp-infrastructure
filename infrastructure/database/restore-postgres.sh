#!/usr/bin/env bash
set -euo pipefail

# Restore a custom-format PostgreSQL dump into the existing shield_pdp database.
# This script does not use destructive --clean behavior; restore can fail on conflicts.

REMOTE="${REMOTE:-shield-db}"
REMOTE_SECRET_FILE="${REMOTE_SECRET_FILE:-/opt/shield/secrets/database.env}"
RESTORE_BACKUP="${RESTORE_BACKUP:-}"

if [[ -z "$RESTORE_BACKUP" ]]; then
  printf 'usage: RESTORE_BACKUP=/opt/shield/backups/postgres/file.dump %s\n' "$0" >&2
  exit 2
fi

ssh "$REMOTE" "REMOTE_SECRET_FILE='$REMOTE_SECRET_FILE' RESTORE_BACKUP='$RESTORE_BACKUP' sudo -E bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

if [[ ! -f "$REMOTE_SECRET_FILE" ]]; then
  printf 'missing secret file: %s\n' "$REMOTE_SECRET_FILE" >&2
  exit 1
fi

if [[ ! -f "$RESTORE_BACKUP" ]]; then
  printf 'missing backup file: %s\n' "$RESTORE_BACKUP" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$REMOTE_SECRET_FILE"

db_name="${DATABASE_NAME:-${DB_NAME:-shield_pdp}}"
sudo -u postgres pg_restore --dbname="$db_name" --no-owner --role="${DATABASE_USER:-${DB_USER:-shield_user}}" "$RESTORE_BACKUP"

printf 'restore attempted into database: %s\n' "$db_name"
REMOTE_SCRIPT
