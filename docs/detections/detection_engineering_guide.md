# Detection Engineering Guide

Shield-PDP detection engineering uses structured events and Sigma-style rule definitions mapped to MITRE ATT&CK.

## Rule Lifecycle

1. Identify simulated behavior.
2. Confirm event names and fields.
3. Map to ATT&CK techniques.
4. Write Sigma-style rule.
5. Generate scenario telemetry.
6. Validate alert output.
7. Correlate incidents.
8. Document false positives and recommendations.

## Rule Families

| Stage | Rule Focus |
| --- | --- |
| Stage 4 | SSRF, metadata, JWT, stale token, CI/CD, secrets, admin anomalies. |
| Stage 5 | Beacon, redirector, pivot, persistence, OPSEC, campaign, replay. |
| Stage 6 | Digital twin, attack graph, autonomous campaign, hunting, coverage, chaos, replay, AI-assisted defense. |
| Stage 7 | Kubernetes/GitOps, telemetry SLA, resilience, multi-environment, zero trust, governance, delivery, replay. |

## Validation Endpoints

- `/detections/api/rules`
- `/detections/api/alerts`
- `/detections/api/validation/run`
- `/siem/api/wazuh/alerts`
- `/correlation/api/attack-paths`

## False Positive Strategy

False positives are expected during exercises. Document:
- exercise window
- operator
- scenario ID
- expected rule IDs
- unexpected rule IDs
- tuning recommendation

## Coverage Reporting

Use Stage 6 coverage intelligence and Stage 7 scale dashboard for:
- ATT&CK heatmap
- coverage score
- blindspots
- telemetry SLA
- executive reporting
