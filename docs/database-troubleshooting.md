# Database Troubleshooting

## APT Timeout or Mirror Failure

Check from `shield-db`:

```bash
getent hosts archive.ubuntu.com
getent hosts security.ubuntu.com
curl -fsI --connect-timeout 8 http://archive.ubuntu.com/ubuntu/
```

The setup script retries `apt-get update` with timeouts and can switch Ubuntu source URLs back to the default Ubuntu mirrors after backing up the original source file.

## SSH Access

Confirm Tailscale and sudo from `shield-cloud`:

```bash
ssh shield-db "hostname && whoami && tailscale ip -4"
ssh shield-db "sudo -n whoami"
```

If UFW blocks SSH, use console access to confirm this rule exists:

```bash
sudo ufw allow in on tailscale0 to any port 22 proto tcp
```

## PostgreSQL Auth Failure

Check HBA and role state:

```bash
ssh shield-db "sudo grep -n 'SHIELD-PDP\\|shield_pdp' /etc/postgresql/*/*/pg_hba.conf"
ssh shield-db "sudo -u postgres psql -tAc \"SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname='shield_user';\""
```

Expected HBA line:

```text
host shield_pdp shield_user 100.119.241.7/32 scram-sha-256
```

If the password changed, rerun:

```bash
bash infrastructure/database/create-database-and-user.sh
```

## PostgreSQL Listener Failure

Check:

```bash
ssh shield-db "sudo -u postgres psql -tAc 'SHOW listen_addresses;'"
ssh shield-db "sudo ss -tulpn | grep 5432"
```

Expected listener addresses include `127.0.0.1` and `100.110.198.103`, with no `0.0.0.0:5432`.

## Firewall Failure

Check:

```bash
ssh shield-db "sudo ufw status verbose"
```

Expected:

- default deny incoming
- SSH allowed on `tailscale0`
- port 5432 allowed on `tailscale0` only from `100.119.241.7`

Do not run `ufw reset`. Add or delete specific rules only.

## App Still Uses Local Database

Check effective Compose config:

```bash
docker compose config | grep -E 'DB_HOST|DB_NAME|DB_USER|depends_on|profiles' -n
```

For the two-VM mode, `api-vulnerable` should use `DB_HOST=100.110.198.103`, `DB_NAME=shield_pdp`, and `DB_USER=shield_user`. The local `db` service should only start when the `local-db` profile is enabled.
