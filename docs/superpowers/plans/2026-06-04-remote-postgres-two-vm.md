# Remote PostgreSQL Two-VM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Shield-PDP application database persistence to PostgreSQL on `shield-db` while `shield-cloud` runs the app and connects over Tailscale only.

**Architecture:** `shield-db` owns PostgreSQL data under its local PostgreSQL data directory. PostgreSQL listens only on localhost and `100.110.198.103`, `pg_hba.conf` allows only `shield_user` from `shield-cloud` Tailscale IP `100.119.241.7`, and UFW allows port 5432 only on `tailscale0` from that source. The app receives remote DB settings through environment variables or `/opt/shield/secrets/database.env`; local compose PostgreSQL is dev-only.

**Tech Stack:** Bash, PostgreSQL 16, UFW, Tailscale, Docker Compose, FastAPI, SQLAlchemy, psycopg2, psql.

---

### Task 1: Investigation Baseline

**Files:**
- Read: `docker-compose.yml`
- Read: `.env.example`
- Read: `api/vulnerable/main.py`
- Read: remote `shield-db` PostgreSQL and system state over SSH

- [x] **Step 1: Capture remote host and network state**

Run:
```bash
ssh shield-db "hostname && whoami"
ssh shield-db "hostnamectl"
ssh shield-db "ip -br a"
ssh shield-db "tailscale ip -4"
ssh shield-db "tailscale status"
ssh shield-db "df -h"
ssh shield-db "free -h"
ssh shield-db "lsb_release -a || cat /etc/os-release"
ssh shield-db "sudo systemctl status ssh --no-pager || true"
ssh shield-db "sudo ufw status verbose || true"
ssh shield-db "systemctl status postgresql --no-pager || true"
ssh shield-db "ss -tulpn | grep -E ':22|:5432' || true"
```

Expected:
- Hostname `shield-db`, SSH user `ubuntu`
- Tailscale IP `100.110.198.103`
- PostgreSQL present or installable
- No PostgreSQL listener on `0.0.0.0:5432`

- [x] **Step 2: Capture project DB configuration**

Run:
```bash
rg --files --glob '!**/node_modules/**'
rg -n --glob '!**/node_modules/**' "DATABASE_URL|DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASSWORD|POSTGRES|postgres|psycopg|sqlalchemy|5432" .
```

Expected:
- `docker-compose.yml` contains a local `db` service
- `api/vulnerable/main.py` builds SQLAlchemy URL from `DB_*`
- No migration system is present; app uses `Base.metadata.create_all`

### Task 2: RED Validation Test

**Files:**
- Create: `infrastructure/database/tests/validate-database-deliverables.sh`

- [x] **Step 1: Add validation test before deliverables**

The test must fail until all required database scripts, SQL files, and docs exist.

- [x] **Step 2: Run test to verify RED**

Run:
```bash
bash infrastructure/database/tests/validate-database-deliverables.sh
```

Expected: FAIL with missing required files.

### Task 3: Project Deliverables

**Files:**
- Create: `infrastructure/database/setup-postgres-remote.sh`
- Create: `infrastructure/database/configure-postgres-tailscale.sh`
- Create: `infrastructure/database/create-database-and-user.sh`
- Create: `infrastructure/database/backup-postgres.sh`
- Create: `infrastructure/database/restore-postgres.sh`
- Create: `infrastructure/database/test-db-connection.sh`
- Create: `infrastructure/database/README.md`
- Create: `sql/init/001-create-shield-schema.sql`
- Create: `sql/init/002-seed-lab-data.sql`
- Create: `docs/database-operations.md`
- Create: `docs/database-hardening.md`
- Create: `docs/database-troubleshooting.md`

- [ ] **Step 1: Write idempotent Bash scripts**

Requirements:
- `set -euo pipefail`
- no real passwords
- use `/opt/shield/secrets/database.env`
- detect PostgreSQL version with `pg_lsclusters`
- backup original PostgreSQL configs before editing
- do not set `listen_addresses='*'`
- do not allow `0.0.0.0/0`
- validate after changes

- [ ] **Step 2: Write minimal non-conflicting SQL init files**

Requirements:
- use `CREATE TABLE IF NOT EXISTS`
- include app-compatible `users` and `accounts`
- include requested lab `transactions` and `audit_logs`
- do not overwrite existing schema or data

- [ ] **Step 3: Write docs**

Requirements:
- document architecture, setup, verification, backup, restore, rollback, hardening, and troubleshooting
- document secret locations without printing secret values

- [ ] **Step 4: Run validation test to verify GREEN**

Run:
```bash
bash infrastructure/database/tests/validate-database-deliverables.sh
```

Expected: PASS.

### Task 4: Remote PostgreSQL Install and Role Setup

**Files:**
- Execute: `infrastructure/database/setup-postgres-remote.sh`
- Execute: `infrastructure/database/create-database-and-user.sh`

- [ ] **Step 1: Verify or install packages on `shield-db`**

Run:
```bash
ssh shield-db "sudo apt-get update"
ssh shield-db "sudo apt-get install -y postgresql postgresql-contrib ufw curl ca-certificates net-tools htop"
ssh shield-db "sudo systemctl enable --now postgresql"
ssh shield-db "pg_lsclusters"
```

Expected:
- PostgreSQL cluster online on port 5432
- `password_encryption` is `scram-sha-256`

- [ ] **Step 2: Generate and store DB secret outside repo**

Run remotely through the script. Expected:
- `/opt/shield/secrets/database.env` on `shield-db`, mode `600`
- `/opt/shield/secrets/database.env` on `shield-cloud`, mode `600`
- no real secret value in repo files

- [ ] **Step 3: Create DB and least-privilege user**

Expected:
- database `shield_pdp`
- role `shield_user`
- role is not superuser, cannot create DB, cannot create roles
- role can connect to `shield_pdp` and use app schema objects

### Task 5: PostgreSQL Tailscale Binding and Firewall

**Files:**
- Execute: `infrastructure/database/configure-postgres-tailscale.sh`

- [ ] **Step 1: Configure PostgreSQL listener and HBA**

Expected:
- `listen_addresses = 'localhost,100.110.198.103'`
- `pg_hba.conf` contains `host shield_pdp shield_user 100.119.241.7/32 scram-sha-256`
- PostgreSQL listens on `127.0.0.1:5432`, `[::1]:5432`, and `100.110.198.103:5432`
- PostgreSQL does not listen on `0.0.0.0:5432`

- [ ] **Step 2: Configure UFW safely**

Expected:
- default deny incoming
- default allow outgoing
- SSH allowed on `tailscale0`
- PostgreSQL allowed only on `tailscale0` from `100.119.241.7`
- UFW enabled after SSH-over-Tailscale rule exists

### Task 6: App Configuration

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `Makefile`

- [ ] **Step 1: Move local PostgreSQL service behind dev-only profile**

Expected:
- local `db` service has profile `local-db`
- API uses `${DB_HOST:-100.110.198.103}`, `${DB_PORT:-5432}`, `${DB_USER:-shield_user}`, `${DB_NAME:-shield_pdp}`
- API reads password from `${DB_PASSWORD}` or `/run/secrets`/external env where applicable
- API no longer depends on the local `db` service for production-like 2-VM mode

- [ ] **Step 2: Update examples and helper targets**

Expected:
- `.env.example` documents `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD=<set-securely>` plus compatible `DB_*` values
- no real password is written
- Makefile keeps local dev usable while documenting the remote DB path

### Task 7: Schema, Seed, and Verification

**Files:**
- Execute: `sql/init/001-create-shield-schema.sql`
- Execute: `sql/init/002-seed-lab-data.sql`
- Execute: `infrastructure/database/test-db-connection.sh`

- [ ] **Step 1: Run SQL init safely**

Run:
```bash
PGPASSWORD="$DB_PASSWORD" psql "host=100.110.198.103 port=5432 dbname=shield_pdp user=shield_user" -v ON_ERROR_STOP=1 -f sql/init/001-create-shield-schema.sql
PGPASSWORD="$DB_PASSWORD" psql "host=100.110.198.103 port=5432 dbname=shield_pdp user=shield_user" -v ON_ERROR_STOP=1 -f sql/init/002-seed-lab-data.sql
```

Expected:
- schema exists
- inserts are idempotent
- no destructive statements are used

- [ ] **Step 2: Run connection verification**

Run:
```bash
psql "host=100.110.198.103 port=5432 dbname=shield_pdp user=shield_user" -c "SELECT current_database(), current_user, inet_server_addr(), inet_client_addr();"
```

Expected:
- `current_database = shield_pdp`
- `current_user = shield_user`
- `inet_server_addr = 100.110.198.103`
- `inet_client_addr = 100.119.241.7`

### Task 8: Backup, Restore, and Final Checklist

**Files:**
- Execute: `infrastructure/database/backup-postgres.sh`
- Read: `docs/database-operations.md`
- Read: `docs/database-hardening.md`
- Read: `docs/database-troubleshooting.md`

- [ ] **Step 1: Verify backup script**

Run:
```bash
ssh shield-db "sudo /path/to/backup-postgres.sh"
```

Expected:
- backup directory `/opt/shield/backups/postgres`
- compressed dump file exists
- no password printed

- [ ] **Step 2: Final verification**

Run:
```bash
ssh shield-db "sudo systemctl status postgresql --no-pager"
ssh shield-db "sudo ss -tulpn | grep 5432"
ssh shield-db "sudo ufw status verbose"
psql "host=100.110.198.103 port=5432 dbname=shield_pdp user=shield_user" -c "SELECT current_database(), current_user, inet_server_addr(), inet_client_addr();"
```

Expected:
- PostgreSQL active
- PostgreSQL not exposed on public/LAN wildcard
- UFW limits PostgreSQL to Tailscale source
- psql result matches target architecture
