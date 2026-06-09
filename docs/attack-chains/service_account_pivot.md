# Service Account Pivot

## Objective

Show how overly broad service roles can create internal pivot paths, and how attack graph telemetry helps defenders prioritize remediation.

## Prerequisites

- `make stage6-up` or `make stage7-up`
- SOC or admin token

## Lab Attack Path

1. Trigger a service-account trust abuse path in Stage 3 validation or replay.
2. Generate the attack graph from recent telemetry.
3. Review privilege escalation paths.
4. Calculate blast radius for `secrets-broker` or `ci-sim`.
5. Correlate graph edges with detection alerts.

## Telemetry Generated

- `lab.service_account_admin_shadow_access`
- `adversary.pivot.simulated`
- `stage6.attack_graph.generated`
- `stage6.attack_graph.privilege_path_analysis`

## Detections Triggered

- `SHIELD-S4-SVC-ACCT-001`
- `SHIELD-S5-PIVOT-001`
- `SHIELD-S6-ATTACK-GRAPH-001`

## ATT&CK Mapping

| Technique | Lab Interpretation |
| --- | --- |
| `T1078` | Valid service account misuse. |
| `T1550.001` | Token-based trust abuse. |
| `T1021` | Lateral movement path simulation. |
| `T1069` | Permission and group discovery. |

## Replay Notes

Use Stage 6 time-travel reconstruction to preserve graph state and detection flow. This is useful for executive discussion about blast radius.

## Cleanup

No real service account changes are made. Document remediation as a policy exercise: reduce scopes, isolate service identities, add approval gates.
