# Database Operations

## Connection Template

Use these values for the production-like two-VM lab:

```dotenv
DATABASE_HOST=100.110.198.103
DATABASE_PORT=5432
DATABASE_NAME=shield_pdp
DATABASE_USER=shield_user
DATABASE_PASSWORD=<set-securely>
DB_HOST=100.110.198.103
DB_PORT=5432
DB_NAME=shield_pdp
DB_USER=shield_user
DB_PASSWORD=<set-securely>
```

The actual secret files are:

- `shield-cloud`: `/opt/shield/secrets/database.env`
- `shield-db`: `/opt/shield/secrets/database.env`

Do not copy either file into the repo.

If `shield-cloud` does not have passwordless local sudo, `create-database-and-user.sh` can use the local Docker socket as a narrow helper to write only `/opt/shield/secrets/database.env`. The secret content is passed on stdin and is not placed in command-line arguments.

## Setup

Run from `shield-cloud`:

```bash
bash infrastructure/database/setup-postgres-remote.sh
bash infrastructure/database/create-database-and-user.sh
bash infrastructure/database/configure-postgres-tailscale.sh
bash infrastructure/database/test-db-connection.sh
```

## Schema and Seed

If the application has no migration system, initialize the lab schema with:

```bash
set -a
source /opt/shield/secrets/database.env
set +a
psql "host=${DATABASE_HOST} port=${DATABASE_PORT} dbname=${DATABASE_NAME} user=${DATABASE_USER}" -v ON_ERROR_STOP=1 -f sql/init/001-create-shield-schema.sql
psql "host=${DATABASE_HOST} port=${DATABASE_PORT} dbname=${DATABASE_NAME} user=${DATABASE_USER}" -v ON_ERROR_STOP=1 -f sql/init/002-seed-lab-data.sql
```

The FastAPI backend also runs `Base.metadata.create_all()` and seeds demo users on startup.

## Backup

Backups are written on `shield-db`:

```bash
bash infrastructure/database/backup-postgres.sh
```

Recommended rotation:

- keep daily backups for 7 days
- keep weekly backups for 4 weeks
- copy validated backups to separate storage if the lab becomes long-lived

## Restore

Restore is non-destructive by default and may fail if objects already exist:

```bash
RESTORE_BACKUP=/opt/shield/backups/postgres/shield_pdp-YYYYMMDDTHHMMSSZ.dump bash infrastructure/database/restore-postgres.sh
```

Before a restore, create a fresh backup and verify the target backup path. For destructive lab resets, create a separate, explicit reset runbook instead of editing this script.

## Verification

```bash
ssh shield-db "sudo systemctl status postgresql --no-pager"
ssh shield-db "sudo ss -tulpn | grep 5432"
ssh shield-db "sudo ufw status verbose"
bash infrastructure/database/test-db-connection.sh
```

The query must return:

- `current_database = shield_pdp`
- `current_user = shield_user`
- `inet_server_addr = 100.110.198.103`
- `inet_client_addr = 100.119.241.7`
