# Stage 1 - Enterprise Red Team Simulation Architecture

Generated: 2026-05-26

## Objective

Stage 1 defines the target architecture for turning Shield-PDP from a vulnerable API demo into a modular enterprise red team and purple team simulation lab. It does not replace the current stack. It creates a safe migration path, service map, folder structure, network model, and Docker Compose overlay.

## Safety Boundaries

All offensive components are simulators. They must run only inside the lab networks and must not provide public-target automation.

Allowed:

- Synthetic identities, credentials, documents, tokens, and telemetry.
- Safe beacon telemetry simulation with controlled lab tasks.
- Phishing mailbox capture using local mail infrastructure.
- C2-like control-plane simulation for education and detection engineering.
- Internal recon, lateral movement, persistence, and exfiltration as logged simulation events.

Not allowed:

- Destructive malware.
- Ransomware.
- Real credential theft.
- Arbitrary command execution against non-lab systems.
- Public-target scanning or exploitation automation.
- Host Docker socket exposure to attacker-controlled services.

## Target Zone Model

```text
[ Internet / Lab Operator ]
          |
          v
[ Edge Zone ]
  - redirector-sim
  - reverse-proxy
  - api-gateway
          |
          v
[ Teamserver Zone ]
  - c2-control-sim
  - beacon-sim
  - payload-host-sim
  - phishing-mail-sim
          |
          v
=================================================
             Internal Enterprise Network
=================================================
  [ Identity Zone ]
    - auth-service
    - oauth/jwt issuer
    - vault-sim
    - directory-sim

  [ Application Zone ]
    - public APIs
    - internal APIs
    - admin APIs
    - employee portal
    - HR portal
    - finance portal
    - internal file share
    - internal admin panel

  [ DevOps Zone ]
    - git service
    - CI/CD simulator
    - build runner simulator
    - artifact store
    - container registry simulator

  [ Data Zone ]
    - PostgreSQL
    - Redis
    - RabbitMQ

  [ Observability Zone ]
    - log collector
    - SIEM dashboard
    - detection engine
    - Sysmon-style telemetry simulator
    - EDR simulation service
```

## Service Map

| Domain | Service | Stage | Purpose | Exposure |
|---|---|---:|---|---|
| Edge | `proxy` | Existing | Nginx dashboard/API gateway | Host port 3000 |
| Edge | `edge-router` | 2 | Optional Traefik/redirector simulation | Host loopback only |
| Teamserver | `teamserver-sim` | 7 | Safe C2 control-plane simulator | Internal or loopback operator UI |
| Teamserver | `beacon-sim` | 7 | Generates benign callback telemetry | Internal only |
| Teamserver | `payload-host-sim` | 7 | Hosts inert payload metadata/files | Internal only |
| Teamserver | `mailpit` | 2/7 | Captures simulated phishing email | Host loopback UI |
| Identity | `auth-service` | 4 | SSO/JWT/OAuth facade | Internal through gateway |
| Identity | `vault-sim` | 2/4 | Lab secrets service | Host loopback for admin UI/API |
| Identity | `directory-sim` | 4 | AD-like users, groups, devices | Internal only |
| Application | `api-vulnerable` | Existing | Current API and lab vulnerability seed | Through gateway |
| Application | `public-api` | 3 | Public API attack surface | Through gateway |
| Application | `internal-api` | 3 | Internal trust-abuse surface | Internal only |
| Application | `admin-api` | 3 | Privileged admin workflows | Internal and role-gated |
| Application | `employee-portal` | 5 | Enterprise user portal | Through gateway |
| Application | `hr-portal` | 5 | Sensitive employee data | Internal role-gated |
| Application | `finance-portal` | 5 | Payment/account workflows | Internal role-gated |
| DevOps | `git` | 2/4 | Internal Git service | Host loopback UI |
| DevOps | `ci-sim` | 4 | Fake CI/CD orchestration | Internal only |
| DevOps | `runner-sim` | 4 | Build runner event generator | Internal only |
| Data | `db` | Existing | PostgreSQL | Internal only |
| Data | `enterprise-redis` | 2 | Rate limits, sessions, scenario state | Internal only |
| Data | `enterprise-rabbitmq` | 2 | Event bus and telemetry queue | Host loopback management UI |
| Observability | `soc-node` | Existing | SOC placeholder | Internal only |
| Observability | `log-collector` | 6 | Collects JSON events | Internal only |
| Observability | `siem` | 6 | Search and alert dashboard | Host loopback UI |
| Observability | `edr-sim` | 6 | Endpoint telemetry simulator | Internal only |

## Network Map

| Network | Trust level | Purpose |
|---|---|---|
| `shield_pdp_dmz` | Existing edge | Current Nginx exposed path |
| `shield_pdp_lan` | Existing app LAN | Current API and DB network |
| `shield_pdp_soc` | Existing SOC | Current SOC placeholder |
| `shield_pdp_edge` | New edge | Redirector and reverse-proxy boundary |
| `shield_pdp_teamserver` | New internal | Safe red-team simulation infrastructure |
| `shield_pdp_enterprise` | New internal | Employee-facing and internal business apps |
| `shield_pdp_identity` | New internal | Auth, directory, token issuer, vault |
| `shield_pdp_devops` | New internal | Git, CI/CD, registry, build services |
| `shield_pdp_data` | New internal | PostgreSQL, Redis, RabbitMQ, stores |
| `shield_pdp_observability` | New internal | Log collector, SIEM, detections, EDR telemetry |

## Trust Relationships

- Edge services may call public APIs and gateway routes.
- Teamserver simulators may emit telemetry and host inert lab artifacts, but cannot execute host commands or reach public targets.
- Application services call identity services for token validation and data services for persistence.
- DevOps services trust identity service accounts and publish build events to RabbitMQ.
- Observability services receive logs and telemetry from every zone.
- Data services are not exposed to edge networks.

## Stage 1 Folder Structure

```text
api/
  vulnerable/                  # Existing API, preserved during safe refactor
services/
  auth-service/                # Stage 4
  public-api/                  # Stage 3
  internal-api/                # Stage 3
  admin-api/                   # Stage 3
  employee-portal/             # Stage 5
  hr-portal/                   # Stage 5
  finance-portal/              # Stage 5
  file-share/                  # Stage 5
  ci-sim/                      # Stage 4
  runner-sim/                  # Stage 4
  teamserver-sim/              # Stage 7
  beacon-sim/                  # Stage 7
  payload-host-sim/            # Stage 7
  detection-engine/            # Stage 6
  edr-sim/                     # Stage 6
infrastructure/
  compose/
  networks/
  nginx/
  traefik/
  docker/
  k8s/
  terraform/
  ansible/
configs/
  env/
  sigma/
  telemetry/
  scenarios/
docs/
  audit/
  architecture/
  threat-model/
  scenarios/
  runbooks/
redteam/
  simulations/
  scenarios/
  operator/
blueteam/
  detection-rules/
  hunts/
  response-playbooks/
evidence/
  logs/
  scenario-runs/
reports/
  compliance/
  pentest/
  purple-team/
```

This structure is the target layout. Existing files should be moved only when tests and compatibility wrappers are in place.

## Compose Strategy

- Keep `docker-compose.yml` as the current stable baseline.
- Add `docker-compose.enterprise.yml` as an overlay for enterprise-stage services.
- Use Compose profiles so heavy or optional services do not start by default.
- Validate overlays with:

```bash
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml config
```

Profile plan:

| Profile | Purpose |
|---|---|
| `stage1-core` | Lightweight enterprise support services |
| `stage1-identity` | Vault simulation and identity support |
| `stage1-devops` | Git and CI/CD support services |
| `stage1-redteam` | Safe phishing/mail and teamserver support |
| `enterprise` | Convenience profile for all stage 1 support services |

## Stage 1 Acceptance Criteria

- Existing stack still passes `make validate`.
- New compose overlay passes config validation.
- No existing route is removed or changed.
- No destructive or weaponized red-team code is introduced.
- Every new network has a documented trust purpose.
- Stage 2 implementation can add services without restructuring Stage 1 docs.

## Stage 1 Validation Status

Validated on 2026-05-26:

- `docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile enterprise config --quiet` passed.
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage1-core up -d --wait` brought up `enterprise-redis` and `enterprise-rabbitmq`.
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage1-core ps` showed Redis, RabbitMQ, db, API, and proxy healthy.
- `make validate` passed after the Stage 1 core overlay was running.

Operational note: Redis logs a standard host-kernel warning for `vm.overcommit_memory`. This does not block the lab, but a dedicated lab host should set `vm.overcommit_memory=1` if Redis persistence becomes important.

## Immediate Next Engineering Steps

Stage 2 has added the first enterprise core overlay: identity service, enterprise gateway, centralized log collector, observability API, and internal portals.

Next engineering steps:

1. Add unit tests around auth, authorization, audit, and lab feature flags.
2. Split `api/vulnerable/main.py` into modules without changing routes.
3. Move Stage 2 token/session state to Redis where appropriate.
4. Add RabbitMQ-backed event publishing for audit and scenario telemetry.
5. Introduce scenario/run IDs into scripts, logs, and detection rules.
6. Move dashboard summary from hard-coded incidents to audit-event-derived state.
