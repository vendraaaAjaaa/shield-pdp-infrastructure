# Beacon Simulation Workflow

## Objective

Train SOC and red-team operators on beacon-like telemetry patterns without malware, payload execution, or external callbacks.

## Prerequisites

- `make stage5-up` or later
- Red-team operator token
- SOC or detection engineer token

## Lab Workflow

1. Create a simulated beacon session using a configured profile.
2. Emit a heartbeat.
3. Poll a safe task such as `enumerate_services` or `collect_identity_context`.
4. Confirm raw command input is rejected.
5. Review detections and replay.

## Safety Guarantees

- No shell commands execute.
- No payload is generated.
- No external callback is made.
- Task results are synthetic static data.

## Telemetry Generated

- `adversary.beacon.session_started`
- `adversary.beacon.heartbeat`
- `adversary.beacon.task_polled`
- `adversary.beacon.task_result`

## Detections Triggered

- `SHIELD-S5-BEACON-001`
- `SHIELD-S5-OPSEC-001` if low-noise profile is used.

## ATT&CK Mapping

| Technique | Lab Interpretation |
| --- | --- |
| `T1071.001` | Web-like callback telemetry simulation. |
| `T1059` | Synthetic command result profile, not real execution. |
| `T1105` | Controlled transfer-like telemetry marker only. |

## Cleanup

End by validating:

```bash
make stage5-validate
```
