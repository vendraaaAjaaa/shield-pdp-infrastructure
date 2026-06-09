# Overnight Implementation Report

## Summary

The frontend, backend/API, and existing remote PostgreSQL database are integrated for the controlled Shield-PDP fintech lab. The implemented scope covers account IDOR, transaction IDOR, transfer source-account IDOR, broken access control, segmentation evidence, PostgreSQL-backed audit events, and PostgreSQL-backed pentest evidence.

No database tables were dropped, no database reset was performed, no existing data was deleted, and no Tailscale, UFW, PostgreSQL listen-address, or `pg_hba.conf` controls were changed. No secrets were printed or committed.

## Inspected Surfaces

- Backend structure and FastAPI routes in `api/vulnerable/main.py`.
- Database connection code and Compose remote secret loading.
- Existing vulnerable and secure/defensive API behavior.
- Schema and seed SQL under `sql/init`.
- Frontend API client, login, accounts, transactions, transfer, findings, segmentation, and audit-log pages.
- `Makefile` `redteam-sim` target and existing automation.
- README and docs layout.

## Backend And Database Changes

- Added safe idempotent schema expansion for roles, external customer/profile/account IDs, transactions, transfers, audit fields, pentest evidence, and segmentation evidence.
- Added or upserted synthetic Budi, Maya, Admin, Auditor, Pentester, and merchant data.
- Seeded `ACC-BUDI-001`, `ACC-MAYA-001`, `ACC-MERCHANT-001`, `TRX-BUDI-001`, `TRX-BUDI-002`, `TRX-MAYA-001`, and `TRX-MAYA-002`.
- Added transfer simulation records that do not move balances.
- Added audit and evidence helper functions that write to remote PostgreSQL.

## Implemented Routes

- `GET /api/v1/vulnerable/ready`
- `POST /api/v1/vulnerable/login`
- `GET /api/v1/vulnerable/me/accounts`
- `GET /api/v1/vulnerable/accounts/:accountId`
- `GET /api/v1/secure/accounts/:accountId`
- `GET /api/v1/vulnerable/me/transactions`
- `GET /api/v1/vulnerable/transactions/:transactionId`
- `GET /api/v1/secure/transactions/:transactionId`
- `POST /api/v1/vulnerable/transfers`
- `POST /api/v1/secure/transfers`
- `GET /api/v1/vulnerable/admin/users`
- `GET /api/v1/vulnerable/audit/events?limit=50`
- `GET /api/v1/vulnerable/pentest/evidence`
- `GET /api/v1/pentest/findings`
- `GET /api/v1/vulnerable/segmentation/internal-db/status`
- `GET /api/v1/secure/segmentation/internal-db/status`

## Frontend Integration

- Login calls the real backend using form-url-encoded credentials.
- Demo token is stored in browser localStorage so BurpSuite can intercept normal authenticated browser traffic.
- Authenticated frontend calls send `Authorization: Bearer <access_token>`.
- `/accounts`, `/transactions`, `/transfer`, `/pentest/findings`, `/pentest/segmentation`, and `/admin/audit-logs` call backend routes when `NEXT_PUBLIC_SHIELD_API_BASE_URL` is configured.
- Configured backend failures are shown as errors; mock mode is used only when no backend URL is configured.
- The app shell shows `Backend live`, `Backend error`, or `Mock adapter`.

## Remote PostgreSQL Usage

The API reads remote database settings from environment variables and `/opt/shield/secrets/database.env` through Compose. Readiness confirmed `databaseName=shield_pdp`, `databaseHost=100.110.198.103`, and `mode=remote-postgres`. Local database Compose profile was not started, and no local `:5432` listener was present during verification.

## BurpSuite Flow

Normal browser requests are visible and editable:

- `GET /api/v1/vulnerable/accounts/ACC-BUDI-001`
- `GET /api/v1/vulnerable/transactions/TRX-BUDI-001`
- `POST /api/v1/vulnerable/transfers`

Manual modifications:

- Change `ACC-BUDI-001` to `ACC-MAYA-001`.
- Change `TRX-BUDI-001` to `TRX-MAYA-001`.
- Change `sourceAccountId` to `ACC-MAYA-001`.

The vulnerable routes demonstrate the flaw and create evidence; the secure routes return HTTP 403 and create blocked audit/evidence entries.

## Verification Results

Passed:

- `python3 -m py_compile api/vulnerable/main.py redteam/simulations/api_exploit.py scripts/automation/smoke_test.py scripts/automation/overnight_contract_test.py`
- `cd apps/web && npm run typecheck`
- `cd apps/web && npm run lint`
- `cd apps/web && npm run build`
- `python3 scripts/automation/overnight_contract_test.py`
- `python3 scripts/automation/smoke_test.py`
- `make redteam-sim`

The overnight contract covered the requested API smoke sequence: readiness, Budi login, vulnerable/secure account access, vulnerable/secure transaction access, vulnerable/secure transfer, customer admin denial, admin audit fetch, admin pentest evidence fetch, and segmentation evidence.

## Known Limitations

- Evidence rows accumulate with each repeated manual or automated run.
- Transfer simulation intentionally does not debit or credit balances.
- Demo localStorage token storage is intentionally interceptable for the lab and is not a production auth recommendation.
- The project directory did not expose Git metadata in this session, so file-change reporting is based on filesystem inspection rather than `git status`.
