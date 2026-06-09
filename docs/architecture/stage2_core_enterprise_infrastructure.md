# Stage 2 - Core Enterprise Infrastructure

Generated: 2026-05-26

## Objective

Stage 2 establishes the enterprise foundation for Shield-PDP without adding advanced offensive simulation. The focus is identity-centric routing, internal service trust, centralized telemetry, health monitoring, and realistic internal business workflows.

The existing Stage 0/Stage 1 stack remains compatible. Stage 2 is delivered through `docker-compose.enterprise.yml` with the `stage2-core` profile.

## Runtime Entry Points

| Entry point | URL | Purpose |
|---|---|---|
| Existing demo gateway | `http://localhost:3000` | Existing Shield-PDP dashboard and vulnerable API lab |
| Enterprise gateway | `http://127.0.0.1:3100` | Stage 2 enterprise internal gateway |
| RabbitMQ management | `http://127.0.0.1:15672` | Event bus management UI |
| Vault dev API/UI | `http://127.0.0.1:8200` | Lab-only secrets simulation |

## Stage 2 Services

| Service | Mode | Purpose | Networks |
|---|---|---|---|
| `enterprise-gateway` | Nginx | Internal/public route boundary, rate limiting, auth middleware, tracing | edge, identity, enterprise, observability |
| `auth-service` | Node/Express identity mode | JWT issuer, OAuth simulation, token introspection, RBAC metadata, service accounts | identity, enterprise, observability |
| `log-collector` | Node/Express log mode | Central telemetry ingest, in-memory event buffer, JSONL event store under tmpfs | observability, identity, enterprise |
| `observability-api` | Node/Express observability mode | Service health, topology, metrics | observability, identity, enterprise |
| `employee-portal` | Node/Express employee mode | Internal workforce workflow | enterprise, identity, observability |
| `hr-portal` | Node/Express HR mode | Restricted personnel workflow | enterprise, identity, observability |
| `finance-portal` | Node/Express finance mode | Restricted finance approval workflow | enterprise, identity, observability |
| `internal-admin-dashboard` | Node/Express admin mode | Privileged service and topology workflow | enterprise, identity, observability |
| `developer-dashboard` | Node/Express developer mode | Developer platform and CI/CD visibility workflow | enterprise, identity, observability |
| `enterprise-redis` | Redis | Future sessions, rate limit state, scenario state | data, enterprise |
| `enterprise-rabbitmq` | RabbitMQ | Future async event bus and telemetry queue | data, observability, enterprise |
| `vault-sim` | Vault dev server | Lab-only secret-management simulation | identity, data |

## Gateway Routes

All protected routes use Nginx `auth_request` against `auth-service` before proxying. The gateway injects:

- `X-Request-ID`
- `X-Authenticated-User`
- `X-Authenticated-Roles`
- `X-Authenticated-Scopes`

| Route | Backend | Required role |
|---|---|---|
| `/identity/*` | `auth-service` | Public for token and metadata endpoints |
| `/employee/*` | `employee-portal` | `employee`, `developer`, `hr`, `finance`, `soc_analyst`, or `admin` |
| `/developer/*` | `developer-dashboard` | `developer` or `admin` |
| `/internal/hr/*` | `hr-portal` | `hr` or `admin` |
| `/internal/finance/*` | `finance-portal` | `finance` or `admin` |
| `/internal/admin/*` | `internal-admin-dashboard` | `admin` or `soc_analyst` |
| `/observability/*` | `observability-api` | `admin` or `soc_analyst` |
| `/logs/*` | `log-collector` | `admin` or `soc_analyst` |

The gateway uses Docker DNS resolver `127.0.0.11` with dynamic upstream names so service recreates do not leave stale container IPs in Nginx.

## Identity Flow

User token flow:

1. Client posts to `/identity/oauth/token` with `grant_type=password`.
2. `auth-service` validates the lab identity and issues an HS256 JWT.
3. The client sends `Authorization: Bearer <token>` to gateway routes.
4. Nginx calls `/gateway/authorize?roles=...` on `auth-service`.
5. The gateway forwards identity headers to the destination service.
6. Destination services also perform role checks as defense in depth.

Service account flow:

1. Internal service requests `/oauth/token` with `grant_type=client_credentials`.
2. `auth-service` issues a service JWT with `service_account=true`.
3. Services use the service JWT for telemetry ingestion and internal trust checks.

## Lab Identities

These are lab-only credentials and should remain isolated to the local environment.

| Username | Password | Roles |
|---|---|---|
| `alice.employee` | `EmployeePass123!` | `employee` |
| `dimas.dev` | `DeveloperPass123!` | `employee`, `developer` |
| `rani.hr` | `HrPass123!` | `employee`, `hr` |
| `budi.finance` | `FinancePass123!` | `employee`, `finance` |
| `siti.soc` | `SocPass123!` | `employee`, `soc_analyst` |
| `admin.enterprise` | `AdminPass123!` | `employee`, `admin`, `soc_analyst` |

## Observability And Logging

Every Stage 2 Node service emits structured JSON logs to stdout with:

- timestamp
- service
- mode
- event
- request ID
- method/path/status
- duration
- authenticated principal when available

Application services also forward request telemetry to `log-collector` using service-account JWTs. `log-collector` retains events in memory and writes JSONL to `/tmp/shield-pdp/events.jsonl` inside its container. This is intentionally tmpfs-backed for the current hardened container model. ELK/Wazuh integration can replace this with durable indexing in Stage 6.

Health and metrics:

- All Stage 2 services expose `/health`, `/ready`, and `/metrics`.
- `observability-api` exposes `/service-health` and `/topology`.
- The gateway exposes `/health`.

## Service Trust Boundaries

| Boundary | Policy |
|---|---|
| Edge to identity | Token and metadata endpoints are exposed through the enterprise gateway |
| Edge to enterprise apps | Gateway auth middleware must authorize before proxying |
| Enterprise apps to identity | Services trust `auth-service` for user and service-token validation |
| Enterprise apps to observability | Services send telemetry to `log-collector` with service JWTs |
| Observability to enterprise apps | `observability-api` polls `/health` only |
| Data network | Redis/RabbitMQ/Vault are not directly exposed to enterprise app users |

## Commands

Start Stage 2:

```bash
make stage2-up
```

Validate Stage 2:

```bash
make stage2-validate
```

Show Stage 2 service health:

```bash
make stage2-ps
```

Validate the existing baseline:

```bash
make validate
```

## Validation Status

Validated on 2026-05-26:

- `docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage2-core config --quiet` passed.
- `node --check services/enterprise-core/src/server.js` passed.
- `python3 -m py_compile scripts/automation/stage2_validate.py` passed.
- `npm audit --omit=dev --audit-level=moderate` passed for `services/enterprise-core`.
- `make stage2-up` completed with all Stage 2 services healthy.
- `make stage2-validate` passed through `http://localhost:3100`.
- `make validate` passed for the existing stack through `http://localhost:3000`.
- Recent Stage 2 service logs were scanned for `error`, `exception`, `traceback`, `unhandled`, and `failed`; no matches remained after fixes.

## Stage 2 Scope Control

Not implemented in Stage 2:

- Beacon simulation.
- C2 simulation.
- Persistence simulation.
- Payload hosting.
- Phishing infrastructure beyond the optional Stage 1 Mailpit service.
- Exploit-chain automation.

These belong to later stages after identity, trust, and telemetry are stable.
