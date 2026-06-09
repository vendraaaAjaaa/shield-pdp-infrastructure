# NO-MISTAKE-ALL Debug Report

Date: 2026-06-06

## Bugs Found

- Dashboard chart data could receive a live backend object/envelope instead of an array, causing Recharts to crash with `displayedData.map is not a function`.
- Several pages and shared components trusted API data to already be an array before using `.map`, `.filter`, `.reduce`, charts, tables, or status rows.
- Formatter and badge helpers were too strict for malformed or missing backend fields.
- Some live-backend API client paths used mock fallback data when `NEXT_PUBLIC_SHIELD_API_BASE_URL` was configured.
- Next.js LAN development config did not include explicit dev origins for `192.168.18.205`.
- Transfer endpoints returned success while only inserting evidence/simulation records. They did not post debit/credit ledger transactions or update source/destination synthetic balances.

## Root Causes

- Mock data used direct arrays, while the live backend commonly returns envelopes such as `{ items: [...] }` or legacy summary objects.
- Chart and table components accepted typed props but did not normalize at runtime before passing data to Recharts or rendering rows.
- Some pages used all-or-nothing async loading, so one missing live endpoint could make a whole page unusable instead of showing a scoped error/empty state.
- The transfer implementation stopped at a `transfers` simulation insert and returned a success response. The frontend also displayed Nadia as a beneficiary while submitting the old merchant account destination.

## Files Changed

- `apps/web/lib/normalize.ts`
- `apps/web/lib/chart-data.ts`
- `apps/web/lib/formatters.ts`
- `apps/web/lib/risk.ts`
- `apps/web/lib/async-data.ts`
- `apps/web/lib/api/client.ts`
- `apps/web/lib/api/mock.ts`
- `apps/web/lib/types.ts`
- `apps/web/components/charts.tsx`
- `apps/web/components/empty-loading.tsx`
- `apps/web/components/badges.tsx`
- `apps/web/components/audit-log-table.tsx`
- `apps/web/components/transaction-table.tsx`
- `apps/web/components/findings-table.tsx`
- `apps/web/components/transfer-form.tsx`
- `apps/web/components/compliance-score-card.tsx`
- `apps/web/components/evidence-panel.tsx`
- `apps/web/components/finding-card.tsx`
- `apps/web/components/finding-detail-drawer.tsx`
- `apps/web/components/report-card.tsx`
- `apps/web/components/risk-matrix.tsx`
- `apps/web/components/segmentation-map.tsx`
- `apps/web/components/timeline.tsx`
- `apps/web/app/(portal)/dashboard/page.tsx`
- `apps/web/app/(portal)/accounts/page.tsx`
- `apps/web/app/(portal)/transactions/page.tsx`
- `apps/web/app/(portal)/transfer/page.tsx`
- `apps/web/app/(portal)/profile/privacy/page.tsx`
- `apps/web/app/(portal)/security/page.tsx`
- `apps/web/app/(portal)/compliance/page.tsx`
- `apps/web/app/(portal)/compliance/gap-analysis/page.tsx`
- `apps/web/app/(portal)/compliance/breach-notification/page.tsx`
- `apps/web/app/(portal)/pentest/page.tsx`
- `apps/web/app/(portal)/pentest/findings/page.tsx`
- `apps/web/app/(portal)/pentest/bola/page.tsx`
- `apps/web/app/(portal)/pentest/segmentation/page.tsx`
- `apps/web/app/(portal)/admin/page.tsx`
- `apps/web/app/(portal)/admin/audit-logs/page.tsx`
- `apps/web/app/(portal)/admin/incidents/page.tsx`
- `apps/web/app/(portal)/reports/page.tsx`
- `apps/web/app/(portal)/executive/page.tsx`
- `apps/web/next.config.mjs`
- `apps/web/tests/unit/normalize.typecheck.ts`
- `apps/web/tests/unit/chart-data.typecheck.ts`
- `apps/web/playwright.config.ts`
- `apps/web/tests/e2e/demo-flow.spec.ts`
- `api/vulnerable/main.py`
- `sql/init/001-create-shield-schema.sql`
- `sql/init/002-seed-lab-data.sql`
- `scripts/automation/smoke_test.py`
- `scripts/automation/overnight_contract_test.py`
- `scripts/automation/transfer_ledger_test.py`
- `redteam/simulations/api_exploit.py`
- `docs/BURPSUITE_MANUAL_TESTING.md`
- `docs/SHIELD_PDP_DEMO_GUIDE.md`
- `docs/TRANSFER_LEDGER_FIX_PLAN.md`
- `docs/NO_MISTAKE_ALL_DEBUG_PLAN.md`
- `docs/NO_MISTAKE_ALL_DEBUG_REPORT.md`

## Dashboard Fix Summary

- Dashboard summary, accounts, transactions, spending chart data, and alerts are normalized before rendering.
- Recharts receives arrays only.
- Missing chart data renders an empty chart state instead of crashing.
- Transactions can be used to derive spending points when a dedicated spending series is unavailable.
- Backend failures are shown as visible error cards while keeping the page shell usable.
- Safe dashboard defaults remain `0` or `Unknown` when backend fields are missing.

## Chart And Table Normalization

- Added `ensureArray`, `normalizeApiItems`, `ensureObject`, `ensureNumber`, `ensureString`, `ensureBoolean`, `ensureDateString`, and `errorMessage`.
- Hardened chart wrappers, timeline, findings, audit logs, transaction tables, report cards, compliance cards, risk matrix, segmentation map, and transfer form.
- API item envelopes are normalized from `items`, `data`, and other known collection keys before rows/charts are rendered.
- Currency, date, percentage, risk, and status formatting tolerate missing or malformed values.

## Live Backend Mode

- When `NEXT_PUBLIC_SHIELD_API_BASE_URL` is configured, the frontend calls the real backend and no longer silently enriches missing live data with mock fallback data.
- Backend failures produce visible scoped error states.
- When the backend URL is not configured, mock mode remains available and clearly labeled.
- LAN mode uses `http://192.168.18.205:3000`.
- Local mode still supports `http://localhost:3000`.

## LAN Access Status

- Existing `make web-dev-lan` process is running with `NEXT_PUBLIC_SHIELD_API_BASE_URL=http://192.168.18.205:3000`.
- HTTP sweep against `http://192.168.18.205:3200` returned `200` for:
  `/login`, `/dashboard`, `/accounts`, `/transactions`, `/transfer`, `/profile/privacy`, `/security`, `/compliance`, `/compliance/gap-analysis`, `/compliance/breach-notification`, `/pentest`, `/pentest/findings`, `/pentest/bola`, `/pentest/segmentation`, `/executive`, `/reports`, `/admin`, `/admin/audit-logs`, and `/admin/incidents`.
- Portal pages showed `Backend live` or `Backend error` state markers in rendered HTML.
- No rendered page contained `displayedData.map is not a function`, `Unhandled Runtime Error`, `TypeError:`, or `Mock adapter` during the LAN sweep.

## BurpSuite Flow Status

Focused LAN API checks passed:

- `GET /api/v1/vulnerable/accounts/ACC-BUDI-001` returned `200`.
- Editing to `ACC-MAYA-001` on the vulnerable route returned `200`.
- Editing to `ACC-MAYA-001` on the secure route returned `403`.
- `GET /api/v1/vulnerable/transactions/TRX-BUDI-001` returned `200`.
- Editing to `TRX-MAYA-001` on the vulnerable route returned `200`.
- Editing to `TRX-MAYA-001` on the secure route returned `403`.
- `POST /api/v1/vulnerable/transfers` with `ACC-BUDI-001` returned `201`.
- Editing `sourceAccountId` to `ACC-MAYA-001` on the vulnerable route returned `201`.
- Editing `sourceAccountId` to `ACC-MAYA-001` on the secure route returned `403`.
- `make redteam-sim` also passed account, transaction, transfer, RBAC, audit, pentest evidence, and segmentation scenarios.

## Transfer Ledger Behavior

Updated on 2026-06-06:

- Accepted vulnerable and secure transfers now post controlled synthetic ledger rows.
- Legitimate Budi to Nadia transfer decreases `ACC-BUDI-001`, increases `ACC-NADIA-001`, inserts a debit transaction for Budi, and inserts a credit transaction for Nadia.
- Vulnerable transfer mode still trusts `sourceAccountId`. If Budi changes `ACC-BUDI-001` to `ACC-MAYA-001` in BurpSuite, the vulnerable route posts a synthetic debit from Maya's wallet, credits Nadia, and creates critical transfer IDOR evidence.
- Secure transfer mode validates source ownership first. If Budi submits `ACC-MAYA-001`, the secure route returns HTTP 403, writes blocked audit/evidence metadata, and does not mutate balances or insert transaction rows.
- No real money moves. All balances, transfers, transactions, audits, and evidence are synthetic Shield-PDP lab data.
- Regression guard added: `python3 scripts/automation/transfer_ledger_test.py`.

## Transfer NetworkError Follow-Up

Updated on 2026-06-06:

- Root cause: the browser transfer request sends `X-Idempotency-Key`, which triggers a CORS preflight. Backend CORS allowed `Authorization`, `Content-Type`, and `X-Request-ID`, but did not allow `Idempotency-Key` or `X-Idempotency-Key`, so the preflight returned HTTP 400 `Disallowed CORS headers`.
- Backend CORS now allows the LAN origin `http://192.168.18.205:3200`, methods `GET`, `POST`, `OPTIONS`, and headers `Authorization`, `Content-Type`, `Idempotency-Key`, `X-Idempotency-Key`, and `X-Request-ID`.
- Transfer UI now moves to the success state immediately after a 201 transfer POST. If the post-success account refresh fails, the success card stays visible and shows a warning instead of marking the posted transfer as failed.
- `make web-dev-lan` now checks port `3200` with `ss`; when the frontend is already listening it prints `Frontend already appears to be running at http://192.168.18.205:3200` instead of surfacing `EADDRINUSE`.
- Added `make web-dev-lan-check` for listener inspection and `make web-dev-lan-restart` for the explicit restart path.

## Verification Results

- `python3 -m py_compile api/vulnerable/main.py scripts/automation/transfer_ledger_test.py scripts/automation/smoke_test.py scripts/automation/overnight_contract_test.py redteam/simulations/api_exploit.py`: passed.
- `python3 scripts/automation/smoke_test.py`: passed.
- `python3 scripts/automation/transfer_ledger_test.py`: passed, including LAN transfer CORS preflight.
- `python3 scripts/automation/overnight_contract_test.py`: passed.
- `make redteam-sim`: passed.
- `cd apps/web && npm run typecheck`: passed.
- `cd apps/web && npm run lint`: passed.
- `cd apps/web && npm run build`: passed.
- `cd apps/web && NEXT_PUBLIC_SHIELD_API_BASE_URL=http://192.168.18.205:3000 npm run build`: passed.
- `make web-build-lan`: passed.
- Manual CORS preflight for `OPTIONS /api/v1/vulnerable/transfers` from `Origin: http://192.168.18.205:3200` with `authorization,content-type,idempotency-key,x-idempotency-key,x-request-id`: passed with HTTP 200 and allowed origin/header response.
- Manual LAN-origin `POST /api/v1/vulnerable/transfers` with `X-Idempotency-Key`: passed with HTTP 201 and returned transfer/debit/credit/audit IDs.
- Manual Budi transaction feed check found the new debit transaction from the LAN-origin transfer POST.
- `make web-dev-lan-check`: passed and showed the active listener.
- `make web-dev-lan` while port `3200` was in use: passed and printed the already-running message.
- Warmed LAN HTTP sweep against `http://192.168.18.205:3200`: passed for `/login`, `/dashboard`, `/accounts`, `/transactions`, `/transfer`, `/profile/privacy`, `/security`, `/compliance`, `/compliance/gap-analysis`, `/compliance/breach-notification`, `/pentest`, `/pentest/findings`, `/pentest/bola`, `/pentest/segmentation`, `/executive`, `/reports`, `/admin`, `/admin/audit-logs`, and `/admin/incidents`.
- `cd apps/web && npm run test:e2e`: blocked by host dependency. Chromium cannot launch because `libatk-1.0.so.0` is missing. Non-interactive sudo is unavailable, so Playwright browser dependencies could not be installed in this session.

## Remaining Limitations

- Full browser-console verification is not completed in this CLI session because Playwright cannot launch Chromium on this host without missing system libraries.
- The HTTP page sweep verifies server-rendered page availability and absence of fatal error text, but it is not a substitute for a human browser console check on Kali.
- Each accepted transfer ledger regression run mutates synthetic demo balances by design. Existing balances are preserved across API restarts unless `RESET_DEMO_BALANCES=true` is explicitly set.
- Historical pentest evidence rows created before this fix can still contain older wording about simulation-only transfer behavior; current code and docs now describe synthetic ledger posting.
- No database, PostgreSQL network, Tailscale, firewall, pg_hba, vulnerable endpoint, or secure endpoint behavior was changed.

## Demo Commands

Run these from the project root unless noted:

```bash
make web-dev-lan
```

```bash
python3 scripts/automation/smoke_test.py
```

```bash
python3 scripts/automation/transfer_ledger_test.py
```

```bash
make redteam-sim
```

Open:

```text
http://192.168.18.205:3200/login
http://192.168.18.205:3200/dashboard
http://192.168.18.205:3000
```

For frontend build verification:

```bash
make web-build-lan
```
