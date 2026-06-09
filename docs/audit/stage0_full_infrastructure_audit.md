# Stage 0 - Full Infrastructure Audit

Generated: 2026-05-26

## Executive Summary

Shield-PDP is currently a stable local demo stack, not yet a full enterprise red team simulation environment. The existing implementation is useful as a seed: it has a FastAPI API, PostgreSQL, Nginx gateway, a static dashboard, synthetic personal data, intentional IDOR/BOLA lab routes, audit events, Sigma-style rules, and validation scripts.

The main architectural constraint is that the security API is a monolith. Authentication, authorization, SQLAlchemy models, seed data, vulnerable lab routes, audit persistence, metrics, and dashboard summary are all implemented in `api/vulnerable/main.py`. This is acceptable for a compact lab, but it will block realistic enterprise simulation because identity, data services, telemetry, DevOps, internal apps, and red-team exercise state need separate ownership boundaries.

The migration should therefore be evolutionary:

1. Preserve the existing working stack.
2. Add tests and scenario metadata before refactoring.
3. Split the monolithic API into modules without changing routes.
4. Introduce enterprise networks and support services behind Docker Compose profiles.
5. Add new services one domain at a time: identity, internal apps, DevOps, observability, and safe red-team simulators.

## Audit Scope

Reviewed areas:

- Repository structure and file inventory.
- FastAPI API structure and request lifecycle.
- Authentication, JWT, RBAC, object authorization, and lab vulnerability controls.
- Middleware, logging, audit events, metrics, dashboard integration.
- Docker Compose, Nginx gateway, Dockerfile, networks, health checks.
- Red-team simulation script, smoke test, compliance mapper.
- Detection rule and hunting playbook.
- Dependency management and operational practices.

Validation performed:

- `python3 -m py_compile api/vulnerable/main.py scripts/automation/smoke_test.py redteam/simulations/api_exploit.py compliance/engine/uu_pdp_mapper.py` passed.
- `docker compose config` passed.
- `docker compose ps --format json` showed db, API, and proxy healthy; SOC placeholder running.
- `make validate` passed on 2026-05-26 with smoke, red-team validation, and compliance report generation.

## Current Architecture

### Runtime Services

| Service | Current role | Current state |
|---|---|---|
| `db` | PostgreSQL data store for users, profiles, accounts, audit events | Healthy, internal LAN only |
| `api-vulnerable` | FastAPI app for auth, protected APIs, lab vulnerable APIs, metrics, dashboard summary | Healthy, direct loopback port 8000 |
| `proxy` | Nginx gateway and static dashboard host | Healthy, exposed on host port 3000 |
| `soc-node` | Placeholder SOC node | Running, no actual SIEM/log pipeline |

### Current Trust Boundaries

- Public host users enter through `proxy` on port 3000.
- `proxy` bridges `shield_pdp_dmz` and `shield_pdp_lan`.
- `api-vulnerable` and `db` share `shield_pdp_lan`.
- `soc-node` bridges `shield_pdp_lan` and `shield_pdp_soc`.
- The API is also exposed on `127.0.0.1:8000` for diagnostics.

The topology has basic separation, but it is still too coarse for enterprise realism. There is no distinct identity zone, DevOps zone, data zone, workstation zone, teamserver zone, or observability pipeline.

## Request Lifecycle

Current flow:

1. Browser or script calls `http://localhost:3000/api/v1/vulnerable/*`.
2. Nginx strips `/api/v1/vulnerable/` and proxies to `api-vulnerable:8000`.
3. FastAPI middleware assigns `X-Request-ID`, logs request completion, and sets security headers.
4. Route dependencies decode JWTs, load users from the database, and enforce admin or owner access.
5. Sensitive operations call `record_audit_event`, which writes to `audit_events` and logs JSON.
6. Dashboard fetches `/health`, `/ready`, and `/dashboard/summary`.

This is functional, but audit persistence, request metrics, authorization, and dashboard state are tightly coupled to the API process.

## Strengths To Preserve

- Existing stack is runnable and validated.
- Gateway and API emit JSON logs with correlation IDs.
- Owner/admin authorization exists for profile and account reads.
- Vulnerable lab routes are feature-flagged with `ENABLE_VULNERABLE_DEMO`.
- Containers use several hardening controls: non-root API, dropped caps for API/proxy/SOC, `no-new-privileges`, read-only API/proxy root filesystems.
- Nginx routes are simple and deterministic.
- Smoke and red-team validation scripts provide a working regression baseline.
- Detection rules and threat-hunting playbook already exist as seed blue-team content.

## Findings

| ID | Risk | Area | Finding | Evidence | Recommended direction |
|---|---|---|---|---|---|
| F-001 | High | API architecture | FastAPI app is a single-file monolith containing config, logging, ORM models, schemas, auth, middleware, routes, seed data, metrics, and lab flaws. | `api/vulnerable/main.py` lines 1-924 | First safe refactor: split into `core`, `db`, `models`, `schemas`, `auth`, `routers`, `services`, `telemetry` while preserving route behavior. |
| F-002 | High | Scalability | Async route handlers run blocking SQLAlchemy calls directly on the event loop. | `api/vulnerable/main.py` lines 694-892 | Use sync route handlers for sync DB access or migrate to SQLAlchemy async with explicit session lifecycle. |
| F-003 | High | Auth/session | Refresh tokens are stateless and not revocable; `jti` is issued but not persisted or checked. | `api/vulnerable/main.py` lines 323-354, 724-738 | Add token session table or Redis-backed token store with revocation, rotation, reuse detection, and scenario IDs. |
| F-004 | High | Auth/rate limiting | Login rate limiting is in-memory and per API process; it will break across multiple workers or replicas. | `api/vulnerable/main.py` lines 277-281, 428-443 | Move rate-limit state to Redis and add gateway-level rate limiting. |
| F-005 | High | Lab safety boundary | Intentional vulnerable routes live in the same app, DB, JWT issuer, and gateway namespace as secure APIs. | `api/vulnerable/main.py` lines 796-872 | Move vulnerable scenarios behind a scenario controller and explicit lab mode; isolate insecure routes by profile, network, and data set. |
| F-006 | High | Identity model | Roles are binary through `is_admin`; required enterprise roles are not represented. | `api/vulnerable/main.py` lines 134-148, 372-381 | Introduce `roles`, `permissions`, `groups`, `service_accounts`, and scoped tokens. |
| F-007 | High | Network architecture | Current networks are only DMZ, LAN, and SOC; proxy and SOC bridge trust zones. | `docker-compose.yml` lines 74-113 | Add explicit edge, teamserver, identity, enterprise, devops, data, and observability networks. |
| F-008 | High | Secrets | Secrets are environment variables and are expanded by `docker compose config`; no secret-manager path exists yet. | `docker-compose.yml` lines 26-38 | Move to Docker secrets for base stack and add Vault simulation for enterprise stages. |
| F-009 | High | Dependency management | Runtime dependencies are pinned but old and lack hashes, lockfile, SBOM, or vulnerability audit workflow. | `api/vulnerable/requirements.txt` lines 1-7 | Add `requirements.in` plus generated lock, Dependabot/Renovate policy, SBOM, and vulnerability scanning in CI. |
| F-010 | Medium | DB lifecycle | API calls `Base.metadata.create_all()` and seeds demo users on every startup. | `api/vulnerable/main.py` lines 640-645 | Add migrations and idempotent seed jobs; keep auto-seed only for explicit lab profile. |
| F-011 | Medium | Data integrity | `record_audit_event` commits inside read request handling, which can expire loaded ORM objects and creates extra DB write pressure. | `api/vulnerable/main.py` lines 384-425, 758-793 | Use a telemetry/event service or queue-backed audit writer; separate read transaction from audit persistence. |
| F-012 | Medium | Metrics | Metrics are global in-process counters and are inaccurate after restart, multi-worker scaling, or multiple replicas. | `api/vulnerable/main.py` lines 277-281, 678-691 | Use Prometheus instrumentation or structured telemetry exporter. |
| F-013 | Medium | Client IP trust | `client_ip` trusts `X-Forwarded-For` without trusted proxy enforcement. | `api/vulnerable/main.py` lines 316-320 | Only trust forwarded headers from known gateway networks or inject source metadata at Nginx. |
| F-014 | Medium | Gateway controls | Nginx has no request rate limiting, body-size policy, route-level auth, scenario headers, or TLS. | `infrastructure/networks/nginx.conf` lines 41-72 | Add rate limits, request/body limits, route policies, internal-only routes, and optional local TLS. |
| F-015 | Medium | Exposure | Gateway binds `3000` on all interfaces; direct API binds to loopback. | `docker-compose.yml` lines 44-45, 69-70 | Keep public lab exposure intentional and document; for local-only mode bind proxy to `127.0.0.1`. |
| F-016 | Medium | Dashboard truth | `/dashboard/summary` includes hard-coded incidents and service states, so UI can overstate realism. | `api/vulnerable/main.py` lines 895-918 | Build dashboard from event store, service health, detection alerts, and scenario runs. |
| F-017 | Medium | Token handling UI | Red team helper stores access and refresh tokens in `localStorage` and embeds demo credentials in the page. | `dashboard/frontend/redteam.html` lines 130-159, 172-243 | Keep this helper internal-only; move to an operator portal with session isolation and no refresh-token persistence. |
| F-018 | Medium | Observability | No centralized log collector, SIEM index, event schema version, alert state, or exercise run ID. | Logs and `blueteam/detection-rules/api_abuse.yaml` | Add event schema, log collector, SIEM store, detection engine, and scenario/run identifiers. |
| F-019 | Medium | Red-team workflow | `api_exploit.py` validates a few API probes but has no scenario graph, MITRE mapping, preconditions, cleanup, or operator state. | `redteam/simulations/api_exploit.py` lines 68-138 | Convert simulations into scenario modules with steps, expected telemetry, detection notes, and safe cleanup. |
| F-020 | Medium | Service communication | There is no service-to-service auth, event bus, message queue, internal API boundary, or retry policy. | Current Compose and API design | Introduce RabbitMQ/Redis, service accounts, mTLS or signed service tokens for internal calls. |
| F-021 | Medium | Container hardening | Images are tag-pinned but not digest-pinned; there are no resource limits, seccomp/apparmor profiles, or image scanning. | `docker-compose.yml`, `api/vulnerable/Dockerfile` | Add resource limits, image scanning, optional digest pinning, and hardened profiles per service. |
| F-022 | Medium | Build reproducibility | Dockerfile installs dependencies directly from `requirements.txt` without lock hashes or build cache separation. | `api/vulnerable/Dockerfile` lines 1-16 | Add lock generation, SBOM, dependency audit, and build metadata labels. |
| F-023 | Low | CSP drift | Gateway CSP still allows `cdn.jsdelivr.net` although the dashboard is self-contained. | `infrastructure/networks/nginx.conf` line 49 | Remove unused CDN allowance unless a current asset requires it. |
| F-024 | Low | Compliance mapping | UU PDP mapper is static and does not consume actual findings or audit events. | `compliance/engine/uu_pdp_mapper.py` | Feed compliance reports from scenario results and detection evidence. |
| F-025 | Low | Repository hygiene | Current directory is not a Git working tree, so changes and generated reports lack versioned provenance. | `git status` failed | Initialize or restore repository metadata before large refactors. |

## Risk Classification

### Critical

No critical runtime failure was observed in the current local stack. The stack validated successfully.

### High

- Monolithic API blocks safe enterprise expansion.
- Stateless refresh tokens and in-memory rate limiting are not enterprise-safe.
- Vulnerable and secure routes share one trust boundary.
- Network segmentation is too coarse for realistic lateral movement and trust-abuse simulation.
- Secret management is still demo-grade.
- Dependency governance is not strong enough for a long-lived lab platform.

### Medium

- Startup seeding and schema creation belong in migrations/jobs.
- Audit event writes are coupled to API read requests.
- Metrics are process-local.
- Gateway lacks rate limits and route policy controls.
- Dashboard data is partially static.
- Current red-team validation is endpoint-based, not attack-chain-based.

### Low

- CSP has leftover external allowance.
- Compliance report generation is static.
- Existing docs need to be split into architecture, runbook, threat model, and scenario documentation.

## Migration Strategy

### Phase 0: Freeze The Baseline

- Keep `docker-compose.yml` as the stable baseline.
- Keep current API routes working while refactoring.
- Add stage-specific docs and compose overlays instead of replacing files.
- Capture current validation output as the baseline regression suite.

### Phase 1: Safe API Refactor

Target structure:

```text
services/api-vulnerable/
  app/
    main.py
    core/config.py
    core/logging.py
    db/session.py
    db/models.py
    schemas/
    auth/
    routers/
    services/audit.py
    services/dashboard.py
    telemetry/
```

Rules:

- Preserve all current endpoints during the split.
- Add unit tests around token creation, access checks, audit writes, and lab feature flags.
- Do not introduce new vulnerabilities until scenario metadata and safety controls exist.

### Phase 2: Enterprise Network Backbone

- Add edge, teamserver, identity, enterprise, devops, data, and observability networks.
- Add Redis and RabbitMQ for rate limiting, scenario state, and telemetry queueing.
- Add a secrets-vault simulation with explicit lab-only root token handling.

### Phase 3: Identity And Access

- Move authentication into an auth service or Keycloak profile.
- Add enterprise roles: employee, developer, admin, SOC analyst, red team operator.
- Add OAuth/JWT issuer metadata and key rotation.
- Add service accounts and internal service tokens.

### Phase 4: Internal Enterprise Apps

- Add employee, HR, finance, file-share, internal admin, and developer portal services.
- Use synthetic data only.
- Model trust relationships intentionally and document each trust path.

### Phase 5: DevOps And Container Attack Surface

- Add Git, CI runner simulator, artifact store, container registry, metadata-like service, and Kubernetes simulation.
- Keep abuse scenarios educational and constrained to the lab.
- Do not mount the host Docker socket into attacker-controlled services.

### Phase 6: Detection And Purple Team

- Add event schema, log collector, SIEM dashboard, detection engine, alert state, Sysmon-style telemetry, and Sigma rules.
- Every attack scenario must define expected telemetry and expected detections.

### Phase 7: Safe Red-Team Simulation

- Implement redirector, teamserver, beacon, payload hosting, and phishing as simulators.
- No destructive malware, ransomware, credential theft against real systems, public-target automation, or arbitrary command execution.
- Beacon simulator should generate controllable telemetry and receive benign lab tasks only.

## Redesign Roadmap

| Stage | Outcome | Acceptance criteria |
|---|---|---|
| Stage 1 | Architecture redesign, folder structure, compose overlay, service map | Existing stack still passes `make validate`; enterprise overlay passes `docker compose config` |
| Stage 2 | Core infrastructure | Redis, RabbitMQ, Vault simulation, log collector, scenario registry health checks |
| Stage 3 | Vulnerable ecosystem | Public, internal, admin, webhook, upload, SSRF, IDOR/BOLA, debug-route services with safety flags |
| Stage 4 | Identity system | SSO/OAuth simulation, role model, service accounts, token revocation |
| Stage 5 | Enterprise simulation | Employee, HR, finance, file share, chat, workstation, developer and admin portals |
| Stage 6 | Detection stack | SIEM, alerting, telemetry schema, Sigma pipeline, Wazuh/Sysmon-style simulation |
| Stage 7 | Red-team simulation modules | Safe redirector/teamserver/beacon/payload/phishing simulators and operator workflow |
| Stage 8 | Attack scenarios | MITRE-mapped attack chains with preconditions, execution steps, detections, cleanup |
| Stage 9 | Documentation and hardening | Setup guides, threat model, runbooks, CI checks, hardening profiles |

## Stage 0 Decision

Do not rewrite the current project. The right path is a controlled architecture evolution with a stable baseline, clear trust boundaries, safety controls, and scenario-driven service additions.
