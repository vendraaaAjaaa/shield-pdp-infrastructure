# Runbook: Failover Recovery

## Purpose

Validate that a simulated telemetry or identity failover remains observable.

## Steps

1. Select a resilience plan.
2. Run the failover simulation.
3. Confirm detection and telemetry integrity markers.
4. Query correlation timeline.
5. Confirm no service health regression.

## Recovery Notes

All failover workflows are synthetic. Do not kill containers as part of a normal training exercise unless explicitly testing Docker recovery.
