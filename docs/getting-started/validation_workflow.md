# Validation Workflow

Validation scripts are part of the cyber range safety model. They prove that scenarios remain synthetic, observable, and compatible.

## Validation Layers

| Validator | What It Proves |
| --- | --- |
| `make validate` | Base API health, secure controls, red-team evidence, compliance report. |
| `make stage2-validate` | Gateway auth, enterprise portals, token introspection, service health, logs. |
| `make stage3-validate` | Identity weaknesses, internal trust, CI/CD, recon, secrets paths. |
| `make stage4-validate` | SIEM pipeline, rules, alerts, correlation, SOC replay. |
| `make stage5-validate` | Beacon, redirector, pivot, persistence, campaign safety controls. |
| `make stage6-validate` | Digital twin, attack graph, campaign orchestration, hunting, chaos, intelligence. |
| `make stage7-validate` | Kubernetes/Helm/GitOps artifacts, distributed telemetry, resilience, governance, zero trust. |

## Recommended Audit Run

```bash
make stage7-up
make validate
make stage2-validate
make stage3-validate
make stage4-validate
make stage5-validate
make stage6-validate
make stage7-validate
```

## Failure Handling

1. Identify the failing check name.
2. Confirm the target service is healthy with `make stage7-ps`.
3. Inspect structured logs for the failing service.
4. Rerun the smallest relevant validator.
5. If the failure affects compatibility, rerun all validators from the impacted stage upward.

## Acceptance Criteria

- No HTTP 500 runtime errors.
- No unhandled exceptions.
- All expected detection rules are loaded.
- Expected alerts appear in detection and SIEM views.
- Correlation includes stage-specific events.
- Replay exports are deterministic.
