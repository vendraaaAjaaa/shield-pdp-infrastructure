# Persistence Simulation Workflow

## Objective

Teach persistence visibility, cleanup accountability, and detection correlation without creating real persistence.

## Prerequisites

- `make stage5-up` or later
- Red-team operator or admin token

## Lab Workflow

1. List supported persistence mechanisms.
2. Register a reversible persistence simulation.
3. Confirm telemetry and detection are generated.
4. Run cleanup.
5. Confirm active persistence count returns to expected state.

## Supported Mechanisms

- Scheduled task simulation.
- Startup entry simulation.
- Token cache simulation.
- CI runner registration simulation.
- Service registration simulation.
- Credential cache simulation.

## Telemetry Generated

- `adversary.persistence.registered`
- `adversary.persistence.cleaned`

## Detections Triggered

- `SHIELD-S5-PERSIST-001`

## ATT&CK Mapping

| Technique | Lab Interpretation |
| --- | --- |
| `T1053.005` | Scheduled task marker. |
| `T1547` | Startup mechanism marker. |
| `T1543` | Service registration marker. |
| `T1550.001` | Token cache marker. |

## Cleanup

Always run the cleanup endpoint or `make stage5-validate`, which verifies cleanup behavior. No real host persistence is created.
