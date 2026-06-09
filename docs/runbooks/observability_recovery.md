# Runbook: Observability Recovery

## Purpose

Recover confidence when logs, traces, or detection views appear incomplete.

## Steps

1. Check `/observability/service-health`.
2. Check `/logs/events/summary`.
3. Generate a known telemetry event by running `make stage7-validate`.
4. Query `/telemetry-fabric/api/sla`.
5. Query `/detections/api/validation/run` with the affected stage.
6. Export a replay if the event sequence is needed for debrief.

## Success Criteria

- Log summary includes expected services.
- Detection validation coverage returns to expected threshold.
- Correlation timeline includes recent events.
