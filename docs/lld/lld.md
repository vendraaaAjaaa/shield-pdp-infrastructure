# Low-Level Design - Shield-PDP

## 1. API
- **Framework**: FastAPI.
- **Authentication**: JWT HS256 access and refresh tokens. Claims include `sub`, `user_id`, `role`, `type`, `iss`, `iat`, `nbf`, `exp`, and `jti`.
- **Password Storage**: PBKDF2-SHA256 with per-password salt and constant-time verification. This avoids the previous `passlib`/`bcrypt` runtime incompatibility.
- **Authorization**: `profiles/{user_id}` and `accounts/{account_id}` require owner or admin access. `/admin/users` and `/audit/events` require admin.
- **Observability**: Every request receives `X-Request-ID`; API logs are JSON and audit-sensitive operations persist to `audit_events`.
- **Health**: `/health` is process-level, `/ready` checks DB connectivity and seeded users, `/metrics` exposes basic Prometheus-style counters.

## 2. Database
- `users`: credentials, active state, and role flag.
- `profiles`: PII demo records including NIK and biometric reference.
- `accounts`: account number and balance per owner.
- `audit_events`: access-control and auth audit evidence with request ID and source IP.

The demo uses SQLAlchemy `create_all` for repeatable local startup. A production deployment should replace this with explicit migrations.

## 3. Gateway
- Nginx serves `dashboard/frontend/index.html`.
- `/api/v1/vulnerable/` is proxied to the API with the prefix stripped.
- Gateway access logs are JSON and include request ID, URI, status, upstream status, and request time.
- `/health` returns a lightweight gateway health response.

## 4. Docker Compose
- `db` runs on the internal LAN network with a persistent volume and health check.
- `api-vulnerable` runs as a non-root user, drops Linux capabilities, uses a read-only filesystem, and exposes port `8000` only on loopback.
- `proxy` exposes port `3000`, drops capabilities, uses read-only filesystem, and depends on API health.
- `soc-node` is an isolated placeholder for log forwarding and SIEM integrations.

## 5. Demo Validation
- `scripts/automation/smoke_test.py` validates health, readiness, login, refresh, object authorization, RBAC, and dashboard summary.
- `redteam/simulations/api_exploit.py` validates that IDOR, BOLA, and admin probes are blocked.
- `compliance/engine/uu_pdp_mapper.py` writes UU PDP evidence to `reports/compliance/uu_pdp_sample_audit.json`.
