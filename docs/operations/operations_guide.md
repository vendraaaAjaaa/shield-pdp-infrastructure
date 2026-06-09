# Operations Guide

This guide is for cyber range operators responsible for starting, validating, maintaining, and recovering Shield-PDP.

## Daily Startup

```bash
make stage7-up
make stage7-validate
make stage7-ps
```

## Maintenance Cycle

| Task | Command / Route | Frequency |
| --- | --- | --- |
| Check containers | `make stage7-ps` | Before each exercise. |
| Validate all stages | Stage validation sequence | After changes. |
| Review logs | `docker logs <container>` or `/logs/events/summary` | During exercises. |
| Validate telemetry | `/telemetry-fabric/api/sla` | During SOC exercises. |
| Export replay | `/scale/api/replay/export` | After exercises. |
| Review governance | `/governance/api/compliance/check` | Weekly or before executive demo. |

## Docker Operations

Use Docker Compose for local lab reliability:

```bash
make stage7-up
make stage7-ps
docker compose -f docker-compose.yml -f docker-compose.enterprise.yml --profile stage7-core logs --tail=200 enterprise-gateway
```

## Kubernetes Operations

Kubernetes files under `kubernetes/` are deployment templates. Validate them before internal cluster use:

```bash
python3 scripts/automation/stage7_validate.py
```

When using a real internal cluster, review:
- namespace segmentation
- secrets replacement
- ingress class
- image repository
- resource quotas
- network policies

## Helm Deployment

Helm chart path:

```text
helm/shield-pdp
```

The chart is Stage 7-ready and export-friendly, but local validation does not require `helm`.

## Backup Workflow

Stage 7 models backup policy through `resilience-hub`:
- event store backup
- GitOps state backup
- governance evidence backup

The local lab uses ephemeral container state for many services; capture validator JSON output and replay exports for training evidence.

## Failover Workflow

Use `/resilience/api/failover/simulate` to exercise:
- telemetry queue failover
- log pipeline degradation recovery
- identity control-plane restart

No real outage is triggered.

## Scaling Notes

Scaling is simulated through:
- Compose service health targets
- Kubernetes HPA manifests
- telemetry SLA scoring
- service dependency traces

Do not manually scale containers during class unless the exercise explicitly covers resilience behavior.
