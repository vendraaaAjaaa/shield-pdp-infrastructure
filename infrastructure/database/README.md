# Shield-PDP Remote PostgreSQL

This directory contains the two-VM database setup for the Shield-PDP lab.

## Target Architecture

- `shield-cloud` runs the project, frontend/backend, Docker Compose, and Codex.
- `shield-db` runs PostgreSQL and stores all application database data.
- Database traffic uses Tailscale only.
- PostgreSQL listens on `localhost` and `100.110.198.103`.
- `pg_hba.conf` allows `shield_user` to access `shield_pdp` only from `shield-cloud` Tailscale IP `100.119.241.7`.
- Secrets live outside the repo at `/opt/shield/secrets/database.env`.

## Scripts

Run these from `shield-cloud`:

```bash
bash infrastructure/database/setup-postgres-remote.sh
bash infrastructure/database/create-database-and-user.sh
bash infrastructure/database/configure-postgres-tailscale.sh
bash infrastructure/database/test-db-connection.sh
```

Backups are created on `shield-db`:

```bash
bash infrastructure/database/backup-postgres.sh
```

Restore is intentionally non-destructive and requires the backup path:

```bash
RESTORE_BACKUP=/opt/shield/backups/postgres/shield_pdp-YYYYMMDDTHHMMSSZ.dump bash infrastructure/database/restore-postgres.sh
```

## Rollback Notes

PostgreSQL config edits are backed up beside the original files with `.bak.<timestamp>`.
To roll back, copy the desired backup over the active file and restart PostgreSQL:

```bash
ssh shield-db "sudo cp /etc/postgresql/16/main/postgresql.conf.bak.<timestamp> /etc/postgresql/16/main/postgresql.conf"
ssh shield-db "sudo cp /etc/postgresql/16/main/pg_hba.conf.bak.<timestamp> /etc/postgresql/16/main/pg_hba.conf"
ssh shield-db "sudo systemctl restart postgresql"
```

Do not use wildcard listeners or broad HBA rules during rollback.
