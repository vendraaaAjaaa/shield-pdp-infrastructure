# Troubleshooting Guide

This guide covers common operational failures in the Shield-PDP cyber range.

## Service Health Issues

| Symptom | Check | Action |
| --- | --- | --- |
| Service is unhealthy | `make stage7-ps` | Inspect container logs and restart stage overlay. |
| Health target count below expected | `/observability/service-health` | Confirm `STAGE7_TARGETS_ENABLED=true` through `make stage7-up`. |
| Service returns 401 | Token missing or expired | Login again through `/identity/oauth/token`. |
| Service returns 403 | Role mismatch | Use a role listed in the relevant playbook. |

## Gateway Routing Issues

| Symptom | Cause | Fix |
| --- | --- | --- |
| `404` on route | Wrong path or inactive overlay | Confirm route inventory at `http://localhost:3100`. |
| `502` from gateway | Upstream not healthy | Wait for health check or rerun stage startup. |
| Auth headers missing | Auth request failed | Confirm JWT and role. |

## Replay Integrity Issues

| Symptom | Cause | Fix |
| --- | --- | --- |
| Replay has too few events | Scenario not generated recently | Run the scenario or validator again. |
| Missing replay ID | Scenario did not export replay | Use Stage 5, Stage 6, or Stage 7 replay route. |
| Detection flow incomplete | Alerts not generated yet | Wait briefly and query detections again. |

## Telemetry Desync

Causes:
- log collector restarted
- event buffer reached max memory window
- scenario generated fewer events than expected
- request lacked stable request ID

Fix:

```bash
make stage7-validate
```

Then query:
- `/logs/events/summary`
- `/telemetry-fabric/api/sla`
- `/detections/api/alerts`

## Queue Or Dependency Failures

RabbitMQ and Redis are infrastructure support services. If either is unhealthy:

1. Check `make stage7-ps`.
2. Inspect container logs.
3. Restart Stage 7 overlay.
4. Rerun validation.

## Kubernetes Deployment Issues

Before using manifests in a real internal cluster:
- replace secret templates
- set internal image repository
- confirm ingress class
- confirm CNI supports NetworkPolicy
- validate resource quotas

## Detection Failures

If a detection rule is missing:
1. Confirm active stage flags.
2. Query `/detections/api/rules`.
3. Rerun the scenario that emits matching events.
4. Run `/detections/api/validation/run`.
