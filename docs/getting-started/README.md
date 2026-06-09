# Getting Started With Shield-PDP

This guide gets a new operator from a clean workstation to a validated Stage 7 enterprise cyber range.

## Prerequisites

| Requirement | Purpose |
| --- | --- |
| Docker Engine with Compose plugin | Runs the local cyber range. |
| GNU Make | Provides stable operational commands. |
| Python 3.11+ | Runs validation scripts and compliance evidence generators. |
| Node.js is optional on host | Useful for local syntax checks; containers include runtime dependencies. |
| 8 GB RAM minimum, 12 GB recommended | Stage 7 starts the full enterprise overlay. |

Optional for distributed deployment work:
- `kubectl`
- `helm`
- access to an internal Kubernetes cluster
- internal GitOps controller such as ArgoCD

## Installation

```bash
git clone <internal-repository-url>
cd shield-pdp-ecosystem
make init-env
```

`make init-env` creates `.env` with lab-only generated secrets if the file does not already exist.

## Startup Workflow

Start the original API/demo layer:

```bash
make up
make validate
```

Start the full enterprise cyber range:

```bash
make stage7-up
make stage7-validate
```

Inspect containers:

```bash
make stage7-ps
```

## Compose Profiles

| Profile | Command | Use Case |
| --- | --- | --- |
| Base | `make up` | Original API, dashboard, database, gateway. |
| Stage 2 | `make stage2-up` | Core enterprise identity, portals, logs, observability. |
| Stage 3 | `make stage3-up` | Enterprise weakness simulation. |
| Stage 4 | `make stage4-up` | Detection, SIEM, SOC, replay. |
| Stage 5 | `make stage5-up` | Controlled adversary operations. |
| Stage 6 | `make stage6-up` | Digital twin, attack graph, hunting, intelligence. |
| Stage 7 | `make stage7-up` | Productionization, Kubernetes/GitOps, telemetry fabric, governance. |

## Environment Variables

| Variable | Default | Notes |
| --- | --- | --- |
| `ENTERPRISE_JWT_ISSUER` | `shield-pdp-enterprise` | Enterprise token issuer. |
| `ENTERPRISE_JWT_AUDIENCE` | `shield-pdp-internal` | Expected audience for internal services. |
| `ENTERPRISE_JWT_SECRET` | Lab default unless overridden | Replace for non-demo internal deployments. |
| `SERVICE_ACCOUNT_SECRET` | Lab default unless overridden | Shared service-account simulation secret. |
| `LOG_INGEST_TOKEN` | Lab default unless overridden | Bootstrap token for log collector. |
| `STAGE3_TARGETS_ENABLED` to `STAGE7_TARGETS_ENABLED` | `false` in compose env anchor | Make targets set these automatically for each stage. |

## Validation Workflow

Run validation in this order when auditing compatibility:

```bash
make validate
make stage2-validate
make stage3-validate
make stage4-validate
make stage5-validate
make stage6-validate
make stage7-validate
```

Expected Stage 7 result:
- all Stage 1-7 workflows pass
- 38 service health targets are healthy
- Stage 7 detection coverage is 100%
- SIEM and correlation include Stage 7 alerts

## Startup Troubleshooting

| Symptom | First Check | Likely Fix |
| --- | --- | --- |
| Gateway returns `502` | `make stage7-ps` | Wait for downstream health checks or restart the profile. |
| Auth failures after restart | Confirm `.env` consistency | Avoid changing JWT/service secrets while containers are running. |
| Validation cannot reach `localhost:3100` | `docker compose ... ps enterprise-gateway` | Ensure Stage 2+ overlay is running. |
| Stage 7 health count below 38 | `make stage7-ps` | Identify unhealthy Stage 7 service, inspect logs, rerun `make stage7-up`. |
| Port conflict | `docker ps` | Stop conflicting local services on ports `3000`, `3100`, `8000`, `8200`, or `15672`. |

## Safety Rules

- Use only local lab targets.
- Do not add public callback infrastructure.
- Do not replace synthetic scenarios with real exploit automation.
- Treat all credentials as lab-only.
