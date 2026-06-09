#!/usr/bin/env bash
set -euo pipefail

# Configure PostgreSQL and UFW so shield-db accepts app DB traffic only over Tailscale.
# Run from shield-cloud.

REMOTE="${REMOTE:-shield-db}"
DB_NAME="${DB_NAME:-shield_pdp}"
DB_USER="${DB_USER:-shield_user}"
DB_TS_IP="${DB_TS_IP:-}"
CLOUD_TS_IP="${CLOUD_TS_IP:-}"

if [[ -z "$DB_TS_IP" ]]; then
  DB_TS_IP="$(ssh "$REMOTE" "tailscale ip -4 | head -n 1")"
fi

if [[ -z "$CLOUD_TS_IP" ]]; then
  CLOUD_TS_IP="$(tailscale ip -4 | head -n 1)"
fi

case "$DB_TS_IP" in
  100.*) ;;
  *) printf 'unexpected shield-db Tailscale IP: %s\n' "$DB_TS_IP" >&2; exit 1 ;;
esac

case "$CLOUD_TS_IP" in
  100.*) ;;
  *) printf 'unexpected shield-cloud Tailscale IP: %s\n' "$CLOUD_TS_IP" >&2; exit 1 ;;
esac

ssh "$REMOTE" "DB_TS_IP='$DB_TS_IP' CLOUD_TS_IP='$CLOUD_TS_IP' DB_NAME='$DB_NAME' DB_USER='$DB_USER' sudo -E bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

cluster_line="$(pg_lsclusters --no-header | awk '$4 == "online" {print $1, $2, $3; exit}')"
if [[ -z "$cluster_line" ]]; then
  printf 'no online PostgreSQL cluster found\n' >&2
  exit 1
fi

read -r pg_version pg_cluster pg_port <<<"$cluster_line"
conf_dir="/etc/postgresql/${pg_version}/${pg_cluster}"
postgresql_conf="${conf_dir}/postgresql.conf"
pg_hba_conf="${conf_dir}/pg_hba.conf"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

cp -a "$postgresql_conf" "${postgresql_conf}.bak.${stamp}"
cp -a "$pg_hba_conf" "${pg_hba_conf}.bak.${stamp}"

listen_value="localhost,${DB_TS_IP}"
if grep -Eq '^[#[:space:]]*listen_addresses[[:space:]]*=' "$postgresql_conf"; then
  sed -i -E "s|^[#[:space:]]*listen_addresses[[:space:]]*=.*|listen_addresses = '${listen_value}'|" "$postgresql_conf"
else
  printf "\nlisten_addresses = '%s'\n" "$listen_value" >>"$postgresql_conf"
fi

sed -i '/^# BEGIN SHIELD-PDP TAILSCALE$/,/^# END SHIELD-PDP TAILSCALE$/d' "$pg_hba_conf"
cat >>"$pg_hba_conf" <<EOF
# BEGIN SHIELD-PDP TAILSCALE
host ${DB_NAME} ${DB_USER} ${CLOUD_TS_IP}/32 scram-sha-256
# END SHIELD-PDP TAILSCALE
EOF

systemctl restart postgresql
systemctl is-active postgresql

if ss -tulpn | grep -qE '0\.0\.0\.0:5432|\*:5432'; then
  printf 'PostgreSQL is listening on a wildcard address; refusing to continue\n' >&2
  ss -tulpn | grep 5432 >&2 || true
  exit 1
fi

if ! ss -tulpn | grep -q "${DB_TS_IP}:5432"; then
  printf 'PostgreSQL is not listening on %s:5432\n' "$DB_TS_IP" >&2
  ss -tulpn | grep 5432 >&2 || true
  exit 1
fi

ufw --force default deny incoming
ufw --force default allow outgoing
ufw allow in on tailscale0 to any port 22 proto tcp comment 'Shield-PDP SSH over Tailscale'
ufw allow in on tailscale0 from "$CLOUD_TS_IP" to any port 5432 proto tcp comment 'Shield-PDP PostgreSQL from shield-cloud'
ufw --force enable
ufw status verbose

sudo -u postgres psql -tAc 'SHOW listen_addresses;'
ss -tulpn | grep 5432
REMOTE_SCRIPT

ssh "$REMOTE" "hostname >/dev/null"
printf 'PostgreSQL configured for %s and shield-cloud source %s\n' "$DB_TS_IP" "$CLOUD_TS_IP"
