#!/usr/bin/env bash
set -euo pipefail

# Create the Shield-PDP database, least-privilege app user, and secret files.
# Run from shield-cloud. The generated password is never printed.

REMOTE="${REMOTE:-shield-db}"
DB_HOST="${DB_HOST:-100.110.198.103}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-shield_pdp}"
DB_USER="${DB_USER:-shield_user}"
LOCAL_SECRET_FILE="${LOCAL_SECRET_FILE:-/opt/shield/secrets/database.env}"
REMOTE_SECRET_FILE="${REMOTE_SECRET_FILE:-/opt/shield/secrets/database.env}"
PRIVILEGE_HELPER_IMAGE="${PRIVILEGE_HELPER_IMAGE:-alpine:3.20}"
ROTATE_DB_PASSWORD="${ROTATE_DB_PASSWORD:-false}"

current_user="$(id -un)"
tmp_secret="$(mktemp)"
trap 'rm -f "$tmp_secret"' EXIT

local_secret_mount_path() {
  case "$LOCAL_SECRET_FILE" in
    /opt/*) printf '/host-opt/%s\n' "${LOCAL_SECRET_FILE#/opt/}" ;;
    *) printf 'LOCAL_SECRET_FILE must be under /opt when local sudo is unavailable: %s\n' "$LOCAL_SECRET_FILE" >&2; return 1 ;;
  esac
}

docker_available() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

read_local_secret_file() {
  if [[ -r "$LOCAL_SECRET_FILE" ]]; then
    cat "$LOCAL_SECRET_FILE" >"$tmp_secret"
    chmod 600 "$tmp_secret"
    return
  fi

  if sudo -n true 2>/dev/null; then
    sudo cat "$LOCAL_SECRET_FILE" >"$tmp_secret"
    chmod 600 "$tmp_secret"
    return
  fi

  if docker_available; then
    secret_path="$(local_secret_mount_path)"
    docker run --rm \
      -e SECRET_PATH="$secret_path" \
      -v /opt:/host-opt \
      "$PRIVILEGE_HELPER_IMAGE" \
      sh -c 'cat "$SECRET_PATH"' >"$tmp_secret"
    chmod 600 "$tmp_secret"
    return
  fi

  printf 'cannot read %s; local sudo is unavailable and Docker helper is unavailable\n' "$LOCAL_SECRET_FILE" >&2
  exit 1
}

write_local_secret_file() {
  local secret_dir
  secret_dir="$(dirname "$LOCAL_SECRET_FILE")"

  if mkdir -p "$secret_dir" 2>/dev/null && install -m 600 "$tmp_secret" "$LOCAL_SECRET_FILE" 2>/dev/null; then
    chmod 700 "$secret_dir"
    return
  fi

  if sudo -n true 2>/dev/null; then
    sudo install -d -m 700 -o "$current_user" -g "$current_user" "$secret_dir"
    sudo install -m 600 -o "$current_user" -g "$current_user" "$tmp_secret" "$LOCAL_SECRET_FILE"
    return
  fi

  if docker_available; then
    secret_path="$(local_secret_mount_path)"
    docker run --rm -i \
      -e HOST_UID="$(id -u)" \
      -e HOST_GID="$(id -g)" \
      -e SECRET_PATH="$secret_path" \
      -v /opt:/host-opt \
      "$PRIVILEGE_HELPER_IMAGE" \
      sh -c 'secret_dir="$(dirname "$SECRET_PATH")"; install -d -m 700 "$secret_dir"; cat >"$SECRET_PATH"; chmod 600 "$SECRET_PATH"; chown "$HOST_UID:$HOST_GID" "$secret_dir" "$SECRET_PATH"' <"$tmp_secret"
    return
  fi

  printf 'cannot write %s; local sudo is unavailable and Docker helper is unavailable\n' "$LOCAL_SECRET_FILE" >&2
  exit 1
}

generate_password() {
  python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
}

if [[ -f "$LOCAL_SECRET_FILE" && "$ROTATE_DB_PASSWORD" != "true" ]]; then
  read_local_secret_file
else
  db_password="$(generate_password)"
  cat >"$tmp_secret" <<EOF
DATABASE_HOST=${DB_HOST}
DATABASE_PORT=${DB_PORT}
DATABASE_NAME=${DB_NAME}
DATABASE_USER=${DB_USER}
DATABASE_PASSWORD=${db_password}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${db_password}
EOF
  chmod 600 "$tmp_secret"
  write_local_secret_file
fi

ssh "$REMOTE" "sudo install -d -m 700 /opt/shield/secrets && sudo install -m 600 /dev/stdin '$REMOTE_SECRET_FILE'" <"$tmp_secret"

ssh "$REMOTE" "DB_NAME='$DB_NAME' DB_USER='$DB_USER' SECRET_FILE='$REMOTE_SECRET_FILE' sudo -E bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

if [[ ! -f "$SECRET_FILE" ]]; then
  printf 'missing secret file: %s\n' "$SECRET_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$SECRET_FILE"

if [[ -z "${DATABASE_PASSWORD:-}" ]]; then
  printf 'DATABASE_PASSWORD is missing from %s\n' "$SECRET_FILE" >&2
  exit 1
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -v db_name="$DB_NAME" \
  -v db_user="$DB_USER" \
  -v db_password="$DATABASE_PASSWORD" <<'SQL'
SELECT format('CREATE DATABASE %I ENCODING ''UTF8'' TEMPLATE template0', :'db_name')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')\gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'db_user')\gexec

ALTER ROLE :"db_user" WITH LOGIN PASSWORD :'db_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE :"db_user" SET search_path TO public;
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE :"db_name" TO :"db_user";
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -v db_name="$DB_NAME" \
  -v db_user="$DB_USER" \
  --dbname="$DB_NAME" <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO :"db_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"db_user";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO :"db_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"db_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"db_user";
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc "SELECT datname FROM pg_database WHERE datname='${DB_NAME}'"
sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname='${DB_USER}'"
REMOTE_SCRIPT

printf 'Secret files are stored at %s on shield-cloud and %s on %s\n' "$LOCAL_SECRET_FILE" "$REMOTE_SECRET_FILE" "$REMOTE"
