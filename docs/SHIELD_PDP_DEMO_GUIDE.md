# Shield-PDP Fintech Demo Guide

## Scope

Shield-PDP is a controlled synthetic fintech lab for PDP/security demonstrations. The current demo focuses on account IDOR, transaction IDOR, transfer source-account tampering, broken access control, and segmentation evidence. It does not implement real phishing, malware, credential theft, destructive payloads, or external targeting.

## 2-VM Architecture

| Layer | Host | Role |
| --- | --- | --- |
| Web/API | `shield-cloud` / `100.119.241.7` | Next.js frontend, FastAPI backend, nginx gateway, validation scripts. |
| Database | `shield-db` / `100.110.198.103` | Remote PostgreSQL database `shield_pdp` for synthetic users, accounts, transactions, transfers, audit events, and evidence. |

Path shown in the segmentation page:

`Frontend/Cloud Portal -> API Gateway -> Backend API -> Tailscale -> shield-db PostgreSQL`

PostgreSQL secrets are loaded outside the repo from `/opt/shield/secrets/database.env`. Do not print or commit that file. The API readiness endpoint exposes only safe metadata such as database name, host, seeded user count, and `remote-postgres` mode.

## Start The Backend Gateway

```bash
make up
docker compose ps api-vulnerable proxy
```

`make up` uses the remote database settings. The local Postgres service is behind the `local-db` profile and is not required for this demo.

Readiness check:

```bash
curl http://localhost:3000/api/v1/vulnerable/ready
```

Expected safe fields include `database: ok`, `databaseName: shield_pdp`, `databaseHost: 100.110.198.103`, and `mode: remote-postgres`.

## Start The Frontend

```bash
cd apps/web
npm install
NEXT_PUBLIC_SHIELD_API_BASE_URL=http://localhost:3000 npm run dev
```

Open `http://localhost:3200/login`. When the backend is configured and reachable, the shell displays `Backend live`. If the backend URL is configured but unreachable, the UI shows an error instead of silently falling back to mock data. Mock mode is only for the case where no backend URL is configured.

## Demo Credentials

| Persona | Username | Password | Role |
| --- | --- | --- | --- |
| Budi Santoso | `budi` | `password123` | customer |
| Maya Kusuma | `maya` | `password123` | customer |
| Nadia Prameswari | `nadia` | `password123` | customer |
| Admin Dana Sejahtera | `admin` | `admin12345` | admin |
| Auditor | `auditor` | `auditor123` | auditor |
| Pentester | `pentester` | `pentest123` | pentester |

All records are synthetic.

## Demo Flow

1. Log in at `/login` as Budi. The frontend posts form data to `POST /api/v1/vulnerable/login`, stores a demo token in localStorage, and sends `Authorization: Bearer <access_token>`.
2. Open `/accounts`. Account list loads from `GET /api/v1/vulnerable/me/accounts`. The detail button calls `GET /api/v1/vulnerable/accounts/ACC-BUDI-001`.
3. In BurpSuite, change `ACC-BUDI-001` to `ACC-MAYA-001`. The vulnerable route returns masked Maya account metadata, writes an audit event, and creates pentest evidence.
4. Compare with `GET /api/v1/secure/accounts/ACC-MAYA-001`; Budi receives HTTP 403 and a blocked evidence record.
5. Open `/transactions`. Transaction list loads from `GET /api/v1/vulnerable/me/transactions`. Detail calls `GET /api/v1/vulnerable/transactions/TRX-BUDI-001`.
6. Change `TRX-BUDI-001` to `TRX-MAYA-001` in BurpSuite. The vulnerable route returns the cross-owner transaction and creates evidence. The secure route returns 403.
7. Open `/transfer` and submit a synthetic ledger transfer from Budi to Nadia. The browser sends `POST /api/v1/vulnerable/transfers` with `sourceAccountId`, `destinationAccountId`, `amount`, and `note`.
8. Confirm the response shows `transferId`, debit/credit transaction IDs, and source/destination balance before/after values. Open `/accounts` and `/transactions` to verify Budi's balance and debit transaction.
9. Change `sourceAccountId` to `ACC-MAYA-001` in BurpSuite. The vulnerable route posts a synthetic debit from Maya's wallet, credits Nadia's wallet, and creates critical transfer IDOR evidence. The secure route returns 403 and does not post ledger rows.
10. Open `/pentest/segmentation` to generate safe remote database isolation evidence.
11. Log in as admin and open `/admin/audit-logs` to view real PostgreSQL audit events.
12. Open `/pentest/findings` as admin, auditor, or pentester to view PostgreSQL-backed evidence.

## Transfer Ledger Behavior

Accepted transfers are synthetic lab ledger postings:

- Legitimate Budi to Nadia transfer decreases `ACC-BUDI-001` and increases `ACC-NADIA-001`.
- Budi sees a debit transaction after sending money.
- Nadia sees a credit transaction after receiving money.
- Vulnerable transfer mode trusts `sourceAccountId` so BurpSuite can tamper `ACC-BUDI-001` to `ACC-MAYA-001`.
- Secure transfer mode validates source ownership and blocks Budi from using Maya's source account with HTTP 403.
- Audit events are written for posted transfers and blocked secure attempts.
- Critical pentest evidence is written for vulnerable transfer source-account tampering.

No real money moves. All balances, transactions, transfers, audit events, and evidence are synthetic Shield-PDP lab records.

## Validation

```bash
python3 scripts/automation/overnight_contract_test.py
python3 scripts/automation/smoke_test.py
python3 scripts/automation/transfer_ledger_test.py
make redteam-sim
cd apps/web && npm run typecheck && npm run lint && npm run build
```

## Known Limitations

- Vulnerable routes are intentionally unsafe and are for this local lab only.
- Evidence accumulates in PostgreSQL across repeated tests.
- Transfer ledger validation scripts intentionally change synthetic demo balances each time they post accepted vulnerable transfers.
- The frontend stores the demo token in browser localStorage for interceptable lab behavior, not as a production recommendation.
