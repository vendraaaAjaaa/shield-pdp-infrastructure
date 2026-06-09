#!/usr/bin/env bash
set -euo pipefail

# Install and enable PostgreSQL tooling on the remote database VM.
# Run from shield-cloud. Codex should not be installed on shield-db.

REMOTE="${REMOTE:-shield-db}"
APT_TIMEOUT="${APT_TIMEOUT:-25}"
APT_RETRIES="${APT_RETRIES:-3}"

ssh "$REMOTE" "APT_TIMEOUT='$APT_TIMEOUT' APT_RETRIES='$APT_RETRIES' sudo -E bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

apt_update() {
  apt-get \
    -o "Acquire::Retries=${APT_RETRIES}" \
    -o "Acquire::http::Timeout=${APT_TIMEOUT}" \
    -o "Acquire::https::Timeout=${APT_TIMEOUT}" \
    update
}

diagnose_apt_network() {
  getent hosts archive.ubuntu.com || true
  getent hosts security.ubuntu.com || true
  curl -fsI --connect-timeout 8 http://archive.ubuntu.com/ubuntu/ >/dev/null || true
}

switch_to_default_ubuntu_mirror() {
  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"

  if [[ -f /etc/apt/sources.list.d/ubuntu.sources ]]; then
    cp -a /etc/apt/sources.list.d/ubuntu.sources "/etc/apt/sources.list.d/ubuntu.sources.bak.${stamp}"
    sed -i -E \
      -e 's#https?://[^[:space:]]*/ubuntu/?#http://archive.ubuntu.com/ubuntu#g' \
      -e 's#https?://security\.ubuntu\.com/ubuntu/?#http://security.ubuntu.com/ubuntu#g' \
      /etc/apt/sources.list.d/ubuntu.sources
  elif [[ -f /etc/apt/sources.list ]]; then
    cp -a /etc/apt/sources.list "/etc/apt/sources.list.bak.${stamp}"
    sed -i -E 's#https?://[^[:space:]]*/ubuntu/?#http://archive.ubuntu.com/ubuntu#g' /etc/apt/sources.list
  fi
}

if ! apt_update; then
  diagnose_apt_network
  switch_to_default_ubuntu_mirror
  apt_update
fi

apt-get install -y --no-install-recommends \
  postgresql \
  postgresql-contrib \
  ufw \
  curl \
  ca-certificates \
  net-tools \
  htop

systemctl enable --now postgresql

pg_lsclusters
systemctl is-active postgresql
sudo -u postgres psql -tAc "SHOW password_encryption;"
REMOTE_SCRIPT
