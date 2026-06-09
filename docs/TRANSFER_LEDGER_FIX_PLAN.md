# Transfer Ledger Fix Plan

Date: 2026-06-06

## Inspection Summary

- Inspected `api/vulnerable/main.py`, including database setup, SQLAlchemy models, startup schema guard, seed data, account/transaction serializers, and vulnerable/secure transfer endpoints.
- Inspected live database columns from the running API container for `accounts`, `transactions`, and `transfers` without printing connection strings or secrets.
- Inspected `sql/init/001-create-shield-schema.sql` and `sql/init/002-seed-lab-data.sql`.
- Inspected frontend transfer, accounts, transactions, and dashboard pages plus `apps/web/lib/api/client.ts` and `apps/web/lib/normalize.ts`.
- Inspected `scripts/automation/smoke_test.py`, `scripts/automation/overnight_contract_test.py`, and `redteam/simulations/api_exploit.py`.
- Inspected `docs/BURPSUITE_MANUAL_TESTING.md`, `docs/SHIELD_PDP_DEMO_GUIDE.md`, and `docs/NO_MISTAKE_ALL_DEBUG_REPORT.md`.

## Root Cause

The transfer endpoints currently insert a `transfers` row with `simulation_only=1` and `status="simulated"`, then return success. They do not update account balances and do not insert debit/credit transaction rows. The frontend also hardcodes `destinationAccountId` to `ACC-MERCHANT-001` while presenting beneficiary choices, so Nadia is not represented as a real backend destination account.

## Constraints

- Do not reset, drop, or delete existing database data.
- Do not change Tailscale, firewall, `pg_hba.conf`, PostgreSQL listener, or remote database network settings.
- Preserve vulnerable account IDOR, vulnerable transaction IDOR, vulnerable transfer IDOR, secure transfer 403 behavior, audit events, and pentest evidence.
- Keep all money movement synthetic and clearly labeled as controlled Shield-PDP lab ledger data.

## Implementation Plan

1. Add a failing regression script `scripts/automation/transfer_ledger_test.py` that:
   - logs in as Budi, Maya, Nadia, and admin when needed;
   - captures Budi, Maya, and Nadia balances;
   - posts a legitimate vulnerable transfer from Budi to Nadia;
   - verifies Budi decreases, Nadia increases, and response includes both transaction IDs;
   - verifies Budi sees the debit transaction and Nadia sees the credit transaction;
   - posts vulnerable IDOR transfer from Maya to Nadia using Budi token;
   - verifies Maya decreases, Nadia increases, `idorDetected=true`, `evidenceId`, and `auditEventId`;
   - posts secure transfer with Budi token and Maya source;
   - verifies HTTP 403 and no Maya balance/transaction change for the blocked attempt.
2. Add idempotent schema guards in `ensure_database_schema()` and SQL init for missing ledger metadata:
   - `transactions.transfer_id`
   - `transactions.counterparty`
   - `transactions.note`
   - `transactions.occurred_at`
   - `transfers.initiated_by_username`
   - `transfers.source_owner_customer_id`
   - `transfers.destination_owner_customer_id`
   - `transfers.vulnerable_mode`
   - `transfers.idor_detected`
   - `transfers.source_transaction_id`
   - `transfers.destination_transaction_id`
   - `transfers.source_balance_before`
   - `transfers.source_balance_after`
   - `transfers.destination_balance_before`
   - `transfers.destination_balance_after`
   - `transfers.idempotency_key`
3. Extend SQLAlchemy `Transaction` and `Transfer` models to match the guarded columns.
4. Add Nadia seed data in startup seed and SQL seed:
   - user `nadia`, password `password123`, role `customer`;
   - profile `PROF-NADIA`, customer `CUST-NADIA`;
   - account `ACC-NADIA-001`, active IDR primary wallet, realistic synthetic balance.
5. Add backend helper `post_transfer_ledger(...)`:
   - validate amount, account status, and currency;
   - lock source and destination rows with `SELECT ... FOR UPDATE` where supported;
   - enforce source ownership in secure mode only;
   - reject insufficient funds without partial updates;
   - create evidence for vulnerable cross-owner transfer;
   - atomically insert transfer, debit transaction, credit transaction, balance updates, audit event, and evidence;
   - return transfer ID, transaction IDs, before/after balances, owner metadata, audit/evidence IDs, risk, and lab message.
6. Refactor `/transfers` and `/secure/transfers` to call the helper:
   - vulnerable mode trusts request `sourceAccountId`;
   - secure mode blocks cross-owner source and does not mutate ledger;
   - both preserve existing request URLs and BurpSuite-editable JSON body.
7. Update transaction serialization to include `transferId`, `counterparty`, `note`, `ownerId`, `ownerUsername`, `channel`, `risk`, `occurredAt`, and metadata.
8. Update frontend types and transfer form:
   - map Nadia beneficiary to `ACC-NADIA-001`;
   - send selected `destinationAccountId`;
   - display transfer ID, source/destination accounts, before/after balances, transaction IDs, audit/evidence IDs, and lab message;
   - refetch account list after success;
   - link to `/transactions`;
   - keep the submit button disabled while pending.
9. Update frontend transactions page:
   - normalize/display `transferId`, `counterparty`, and note;
   - show generated debit/credit transactions and distinguish directions.
10. Update automation:
   - add `transfer_ledger_test.py`;
   - update smoke and redteam text/expectations to use `ACC-NADIA-001` and ledger-posted wording.
11. Update docs:
   - `docs/BURPSUITE_MANUAL_TESTING.md`;
   - `docs/SHIELD_PDP_DEMO_GUIDE.md`;
   - `docs/NO_MISTAKE_ALL_DEBUG_REPORT.md`.
12. Verify with:
   - `python3 scripts/automation/smoke_test.py`;
   - `python3 scripts/automation/transfer_ledger_test.py`;
   - `make redteam-sim`;
   - `cd apps/web && npm run typecheck`;
   - `cd apps/web && npm run lint`;
   - `cd apps/web && npm run build`;
   - `cd apps/web && NEXT_PUBLIC_SHIELD_API_BASE_URL=http://192.168.18.205:3000 npm run build`;
   - `make web-build-lan`.

## Non-Goals

- No balance reset to pre-test values.
- No production payment semantics.
- No changes to database networking, firewall, Tailscale, PostgreSQL listener, or secure/vulnerable IDOR route intent.
- No removal of existing audit or evidence behavior.

