# Stage Matrix

| Stage | Services / Artifacts | Main Validation |
| --- | --- | --- |
| Stage 1 | Base API, dashboard, gateway, DB | `make validate` |
| Stage 2 | Auth, portals, logs, observability | `make stage2-validate` |
| Stage 3 | Internal API, discovery, Git, CI, artifacts, secrets | `make stage3-validate` |
| Stage 4 | SIEM, detection, correlation, SOC | `make stage4-validate` |
| Stage 5 | Adversary control, beacon, redirector, pivot, persistence | `make stage5-validate` |
| Stage 6 | Digital twin, attack graph, campaign orchestrator, hunting, coverage, chaos, intelligence | `make stage6-validate` |
| Stage 7 | Kubernetes orchestrator, GitOps, telemetry fabric, resilience, environment manager, zero trust, governance, delivery, scale dashboard | `make stage7-validate` |

## Compatibility Rule

Each stage must preserve all previous stage validations.
