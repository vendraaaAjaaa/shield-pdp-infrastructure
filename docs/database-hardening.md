# Database Hardening

## Network Exposure

PostgreSQL must not listen on wildcard interfaces. The allowed listener value is:

```text
listen_addresses = 'localhost,100.110.198.103'
```

Do not use:

```text
listen_addresses = '*'
```

`pg_hba.conf` must restrict app access to the Tailscale source:

```text
host shield_pdp shield_user 100.119.241.7/32 scram-sha-256
```

Do not allow `0.0.0.0/0`.

## Firewall

UFW policy on `shield-db`:

```text
Default: deny incoming
Default: allow outgoing
Allow SSH on tailscale0
Allow tcp/5432 on tailscale0 from 100.119.241.7 only
```

Do not expose PostgreSQL on LAN or public interfaces.

## Authentication

PostgreSQL password encryption should be:

```sql
SHOW password_encryption;
```

Expected:

```text
scram-sha-256
```

`shield_user` must not be a superuser, must not create databases, and must not create roles.

## Secrets

Secrets are generated automatically and stored only outside the repo:

- `shield-cloud`: `/opt/shield/secrets/database.env`
- `shield-db`: `/opt/shield/secrets/database.env`

Both files must be mode `600`. Do not print the password in terminal logs or docs.

## Config Backup and Rollback

`configure-postgres-tailscale.sh` backs up:

- `/etc/postgresql/<version>/<cluster>/postgresql.conf`
- `/etc/postgresql/<version>/<cluster>/pg_hba.conf`

Backups are placed beside the original files with `.bak.<timestamp>`.

Rollback:

```bash
ssh shield-db "sudo cp /etc/postgresql/16/main/postgresql.conf.bak.<timestamp> /etc/postgresql/16/main/postgresql.conf"
ssh shield-db "sudo cp /etc/postgresql/16/main/pg_hba.conf.bak.<timestamp> /etc/postgresql/16/main/pg_hba.conf"
ssh shield-db "sudo systemctl restart postgresql"
```

After rollback, verify that PostgreSQL is still not exposed on wildcard or public/LAN interfaces.
