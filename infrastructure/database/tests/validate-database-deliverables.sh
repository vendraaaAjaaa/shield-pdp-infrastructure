#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"

required_files=(
  "infrastructure/database/setup-postgres-remote.sh"
  "infrastructure/database/configure-postgres-tailscale.sh"
  "infrastructure/database/create-database-and-user.sh"
  "infrastructure/database/backup-postgres.sh"
  "infrastructure/database/restore-postgres.sh"
  "infrastructure/database/test-db-connection.sh"
  "infrastructure/database/README.md"
  "sql/init/001-create-shield-schema.sql"
  "sql/init/002-seed-lab-data.sql"
  "docs/database-operations.md"
  "docs/database-hardening.md"
  "docs/database-troubleshooting.md"
)

failures=0

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    printf 'missing required file: %s\n' "$file" >&2
    failures=$((failures + 1))
  fi
done

for script in infrastructure/database/*.sh; do
  [[ -e "$script" ]] || continue
  if ! head -n 1 "$script" | grep -qx '#!/usr/bin/env bash'; then
    printf 'script missing bash shebang: %s\n' "$script" >&2
    failures=$((failures + 1))
  fi
  if ! grep -q 'set -euo pipefail' "$script"; then
    printf 'script missing strict mode: %s\n' "$script" >&2
    failures=$((failures + 1))
  fi
  if grep -Eq 'DROP[[:space:]]+(DATABASE|SCHEMA)|listen_addresses[[:space:]]*=[[:space:]]*['\''"]\*|0\.0\.0\.0/0|chmod[[:space:]]+777|rm[[:space:]]+-rf[[:space:]]+/' "$script"; then
    printf 'script contains forbidden unsafe pattern: %s\n' "$script" >&2
    failures=$((failures + 1))
  fi
done

if [[ -f ".env.example" ]]; then
  for required_env in DATABASE_HOST DATABASE_PORT DATABASE_NAME DATABASE_USER DATABASE_PASSWORD DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD; do
    if ! grep -q "^${required_env}=" .env.example; then
      printf '.env.example missing %s\n' "$required_env" >&2
      failures=$((failures + 1))
    fi
  done
fi

if rg -n --glob '!**/node_modules/**' --glob '!docs/superpowers/plans/**' --glob '!infrastructure/database/tests/**' 'shield_demo_password|P@ssw0rd123!' infrastructure sql docs .env.example docker-compose.yml Makefile >/tmp/shield-db-secret-scan.txt 2>/dev/null; then
  printf 'possible committed password/default secret found:\n' >&2
  cat /tmp/shield-db-secret-scan.txt >&2
  failures=$((failures + 1))
fi

if [[ -f ".env.example" ]]; then
  while IFS='=' read -r key value; do
    case "$key" in
      DB_PASSWORD|DATABASE_PASSWORD)
        if [[ "$value" != "<set-securely>" && "$value" != "replace-with-a-generated-password" ]]; then
          printf '.env.example has non-placeholder value for %s\n' "$key" >&2
          failures=$((failures + 1))
        fi
        ;;
    esac
  done < .env.example
fi

for sql_file in sql/init/*.sql; do
  [[ -e "$sql_file" ]] || continue
  if grep -Eiq 'DROP[[:space:]]+(DATABASE|SCHEMA)|TRUNCATE[[:space:]]|DELETE[[:space:]]+FROM[[:space:]]+(users|accounts|transactions|audit_logs)' "$sql_file"; then
    printf 'sql contains forbidden destructive pattern: %s\n' "$sql_file" >&2
    failures=$((failures + 1))
  fi
done

if (( failures > 0 )); then
  printf 'database deliverables validation failed with %d issue(s)\n' "$failures" >&2
  exit 1
fi

printf 'database deliverables validation passed\n'
