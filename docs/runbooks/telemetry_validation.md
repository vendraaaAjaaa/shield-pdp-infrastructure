# Runbook: Telemetry Validation

## Purpose

Confirm that services emit structured telemetry and detections can consume it.

## Steps

1. Run `make stage7-up`.
2. Run `make stage7-validate`.
3. Query `/logs/events/summary`.
4. Query `/telemetry-fabric/api/sla`.
5. Query `/detections/api/alerts`.
6. Query `/siem/api/wazuh/alerts`.

## Expected Results

- Stage 7 service names appear in log summary.
- Telemetry SLA score is populated.
- Stage 7 detection alerts are present.
- SIEM output includes Stage 7 rule IDs.
