# Overnight Frontend-Backend-Database Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the Dana Sejahtera Shield fintech frontend with the FastAPI backend and the existing remote `shield_pdp` PostgreSQL database for safe BurpSuite testing of IDOR, broken access control, transfer simulation, audit logs, pentest evidence, and segmentation evidence.

**Architecture:** The browser frontend will call the gateway at `NEXT_PUBLIC_SHIELD_API_BASE_URL=http://localhost:3000` and issue visible `/api/v1/vulnerable/...` and `/api/v1/secure/...` requests with a bearer token from the real backend login. The FastAPI service remains the application backend, reads remote database settings from environment variables or `/opt/shield/secrets/database.env`, applies only idempotent schema creation/column additions, and writes audit/evidence records to remote PostgreSQL. Nginx will proxy both vulnerable and secure API namespaces without changing PostgreSQL, Tailscale, UFW, or listener policy.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL, Nginx gateway, Next.js App Router, TypeScript, browser `fetch`, Makefile, Python validation scripts.

---

## Pre-Edit Inspection Summary

- Backend structure: `api/vulnerable/main.py` is the only populated API service; `api/secure` exists but is empty.
- Database connection: SQLAlchemy builds a PostgreSQL URL from `DB_*`/secret-file settings and Compose supplies `/opt/shield/secrets/database.env`.
- Current vulnerable routes: older lab endpoints exist under `/lab/idor/...` and `/lab/bola/...`; requested fintech string-ID vulnerable routes are missing.
- Current secure routes: older owner checks exist on `/profiles/{user_id}` and `/accounts/{account_id}`; requested `/api/v1/secure/...` comparison routes are missing at the gateway and backend namespace.
- Schema/seed: SQL files and ORM contain `users`, `profiles`, `accounts`, `transactions`, `audit_events`, and `audit_logs`; requested `transfers`, `pentest_evidence`, and `segmentation_evidence` are missing. Seed users are Alice/Bob/Charlie/Admin, not Budi/Maya/Admin/Auditor/Pentester.
- Frontend API client: `apps/web/lib/api/client.ts` auto-connects to `/api/v1/vulnerable` and silently falls back to mock data, which conflicts with the configured-backend failure rule.
- Login flow: `/login` is demo-only role switching and does not call the backend.
- `/accounts`: server-side loads mock/legacy data; no browser-visible account detail endpoint call.
- `/transactions`: server-side loads mock data; detail drawer is local only.
- `/transfer`: client UI is a local simulation and does not POST to the backend.
- `/pentest/findings`: server-side finds mock/audit-derived data only.
- `/admin/audit-logs`: server-side reads audit logs with the current adapter.
- `/pentest/segmentation`: server-side reads mock segmentation paths.
- `make redteam-sim`: runs `redteam/simulations/api_exploit.py`, which targets older Alice/Bob lab endpoints.
- README/docs: document the older adapter behavior and do not yet describe the requested 2-VM BurpSuite demo flow.

## Safety Rules

- Do not drop tables, reset the database, delete data, or weaken network/database segmentation.
- Do not change Tailscale, PostgreSQL listen addresses, `pg_hba.conf`, UFW/firewall rules, or enable PostgreSQL on `0.0.0.0`.
- Do not print or commit secrets.
- Do not remove existing vulnerable or defensive routes; add new routes and keep compatibility where practical.
- If a risky infrastructure action becomes necessary, stop and document it in `docs/OVERNIGHT_MANUAL_ACTIONS_REQUIRED.md`.

## Implementation Tasks

### Task 1: Backend Schema And Seed

**Files:**
- Modify: `api/vulnerable/main.py`
- Modify: `sql/init/001-create-shield-schema.sql`
- Modify: `sql/init/002-seed-lab-data.sql`

- [ ] Add SQLAlchemy models for `Transaction`, `Transfer`, `PentestEvidence`, and `SegmentationEvidence`.
- [ ] Extend existing ORM models with non-destructive columns for roles, customer/profile/account external IDs, audit metadata, and evidence links.
- [ ] Add startup migrations using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` only.
- [ ] Seed Budi, Maya, Admin, Auditor, and Pentester with exact synthetic credentials.
- [ ] Seed Budi/Maya accounts, merchant account, Budi/Maya transactions, and initial segmentation evidence through idempotent upserts.

### Task 2: Backend Auth And Audit/Evidence Helpers

**Files:**
- Modify: `api/vulnerable/main.py`

- [ ] Expand login response with `access_token`, `refresh_token`, `user`, `role`, `customerId`, `profileId`, and `accountIds`.
- [ ] Preserve form-url-encoded login behavior for BurpSuite.
- [ ] Replace narrow audit helper with a rich audit writer that persists requested audit fields while maintaining legacy fields.
- [ ] Add a pentest-evidence writer for cross-owner access, secure blocks, admin denials, transfer source mismatches, and segmentation evidence requests.
- [ ] Keep secrets out of logs and API responses.

### Task 3: Backend Routes

**Files:**
- Modify: `api/vulnerable/main.py`
- Modify: `infrastructure/networks/nginx.conf`

- [ ] Implement `GET /ready` with safe remote database metadata.
- [ ] Implement vulnerable account routes: `GET /me/accounts`, `GET /accounts/{accountId}`.
- [ ] Implement secure account route: `GET /secure/accounts/{accountId}`.
- [ ] Implement vulnerable transaction routes: `GET /me/transactions`, `GET /transactions/{transactionId}`.
- [ ] Implement secure transaction route: `GET /secure/transactions/{transactionId}`.
- [ ] Implement vulnerable and secure transfer routes: `POST /transfers`, `POST /secure/transfers`.
- [ ] Implement RBAC-audited `GET /admin/users`.
- [ ] Implement segmentation status routes under `/segmentation/...` and `/secure/segmentation/...`.
- [ ] Implement evidence routes `GET /pentest/evidence` and `GET /pentest/findings`.
- [ ] Implement rich audit route `GET /audit/events?limit=50`.
- [ ] Add gateway proxy locations for `/api/v1/secure/` and `/api/v1/pentest/`.

### Task 4: Redteam Simulation And Smoke Validation

**Files:**
- Modify: `redteam/simulations/api_exploit.py`
- Modify: `scripts/automation/smoke_test.py`
- Modify: `Makefile` only if the target needs new environment defaults.

- [ ] Update `make redteam-sim` scenario to log in as Budi, compare vulnerable/secure account and transaction IDOR, compare vulnerable/secure transfer IDOR, test admin denial, generate segmentation evidence, log in as admin, and fetch audit/evidence.
- [ ] Print scenario, endpoint, HTTP status, vulnerable/secure result, evidence ID, audit event ID, and frontend evidence page.
- [ ] Update smoke test expectations for Budi/Maya routes.

### Task 5: Frontend API Client And Auth

**Files:**
- Modify: `apps/web/lib/api/client.ts`
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/lib/auth-demo.ts`
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/components/app-shell.tsx`

- [ ] Normalize `NEXT_PUBLIC_SHIELD_API_BASE_URL=http://localhost:3000` as the gateway root.
- [ ] Keep mock mode only when no backend URL is configured.
- [ ] Throw/display errors when a configured backend fails instead of falling back.
- [ ] Store demo-safe auth session in browser localStorage after real backend login.
- [ ] Send `Authorization: Bearer <access_token>` on authenticated browser calls.
- [ ] Show `Backend live`, `Mock adapter`, or backend error in the shell.

### Task 6: Frontend BurpSuite-Visible Workflows

**Files:**
- Modify: `apps/web/app/(portal)/accounts/page.tsx`
- Modify: `apps/web/app/(portal)/transactions/page.tsx`
- Modify: `apps/web/app/(portal)/transfer/page.tsx`
- Modify: `apps/web/app/(portal)/pentest/findings/page.tsx`
- Modify: `apps/web/app/(portal)/admin/audit-logs/page.tsx`
- Modify: `apps/web/app/(portal)/pentest/segmentation/page.tsx`
- Modify or create focused client components if needed.

- [ ] `/accounts` loads `GET /api/v1/vulnerable/me/accounts` in the browser and detail buttons call `GET /api/v1/vulnerable/accounts/{accountId}`.
- [ ] `/transactions` loads `GET /api/v1/vulnerable/me/transactions` and detail buttons call `GET /api/v1/vulnerable/transactions/{transactionId}`.
- [ ] `/transfer` submits `POST /api/v1/vulnerable/transfers` with editable `sourceAccountId`.
- [ ] `/pentest/findings` reads evidence from PostgreSQL-backed routes.
- [ ] `/admin/audit-logs` reads real audit events.
- [ ] `/pentest/segmentation` reads backend segmentation status and shows the requested cloud-to-database path.

### Task 7: Documentation

**Files:**
- Modify: `README.md`
- Create/modify: `docs/SHIELD_PDP_DEMO_GUIDE.md`
- Create/modify: `docs/BURPSUITE_MANUAL_TESTING.md`
- Create/modify: `docs/OVERNIGHT_IMPLEMENTATION_REPORT.md`
- Create: `docs/OVERNIGHT_MANUAL_ACTIONS_REQUIRED.md` only if a risky manual action is required.

- [ ] Document architecture, safe scope, credentials, startup commands, backend URL, remote PostgreSQL without secrets, BurpSuite scenarios, evidence pages, audit logs, redteam simulation, verification, and limitations.

### Task 8: Verification

**Commands:**
- `python3 -m py_compile api/vulnerable/main.py redteam/simulations/api_exploit.py scripts/automation/smoke_test.py`
- `cd apps/web && npm run typecheck`
- `cd apps/web && npm run lint`
- `cd apps/web && npm run build`
- API smoke checks against the running gateway/backend.
- `make redteam-sim`

- [ ] Run available backend syntax/tests.
- [ ] Run frontend typecheck, lint, and build.
- [ ] Run the requested API smoke sequence.
- [ ] Run `make redteam-sim`.
- [ ] Record pass/fail evidence and any unresolved issues in `docs/OVERNIGHT_IMPLEMENTATION_REPORT.md`.
