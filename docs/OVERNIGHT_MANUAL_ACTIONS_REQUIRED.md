# Overnight Manual Actions Required

No risky manual actions are required for the implemented scope.

No database tables were dropped or reset, no data was deleted, and no firewall, Tailscale, PostgreSQL listen-address, or `pg_hba.conf` changes were made.

Optional final demo check after waking up:

```bash
docker compose ps api-vulnerable proxy
ss -ltn sport = :5432
python3 scripts/automation/overnight_contract_test.py
make redteam-sim
cd apps/web && NEXT_PUBLIC_SHIELD_API_BASE_URL=http://localhost:3000 npm run dev
```
