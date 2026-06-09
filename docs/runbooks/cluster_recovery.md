# Runbook: Cluster Recovery Simulation

## Purpose

Exercise recovery thinking without disrupting real infrastructure.

## Steps

1. Review `/resilience/api/ha/topology`.
2. Simulate failover with `/resilience/api/failover/simulate`.
3. Verify recovery with `/resilience/api/recovery/verify`.
4. Query telemetry SLA.
5. Export replay.

## Evidence

- failover ID
- recovery verification ID
- telemetry SLA result
- replay export ID
- detections triggered by `SHIELD-S7-RESILIENCE-001`
