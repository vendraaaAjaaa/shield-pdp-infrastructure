# Shield-PDP Stage 5 - Detection Coverage Update

Stage 5 extends the Stage 4 detection engine with rules that are active when `STAGE5_TARGETS_ENABLED=true`. Stage 4 validation remains compatible because validation defaults to Stage 4 rules unless `stage=stage5` or `stage=all` is requested.

## Rule Coverage

| Rule | Event Sources | Severity | Primary Purpose |
| --- | --- | --- | --- |
| SHIELD-S5-BEACON-001 | `beacon-sim` | high | Detect controlled beacon heartbeat and safe task activity |
| SHIELD-S5-REDIRECTOR-001 | `redirector-sim` | medium | Detect redirector route selection and traffic shaping |
| SHIELD-S5-PIVOT-001 | `pivot-sim` | high | Detect lateral movement path simulation across trust boundaries |
| SHIELD-S5-PERSIST-001 | `persistence-sim` | high | Detect reversible persistence registration |
| SHIELD-S5-OPSEC-001 | `adversary-control` | medium | Detect low-noise OPSEC profile usage |
| SHIELD-S5-CAMPAIGN-001 | `adversary-control` | high | Detect completed adversary campaign |
| SHIELD-S5-REPLAY-001 | `adversary-control` | medium | Detect adversary replay timeline emission |

## Telemetry Requirements

Every Stage 5 service emits structured JSON through the existing log collector. Correlation fields:

- `event_id`
- `request_id`
- `principal`
- `lab_stage`
- `operation_run_id`
- `campaign_id`
- `replay_id`
- `beacon_session_id`
- `pivot_id`
- `persistence_id`

## Validation

Run:

```bash
make stage5-validate
```

The validator checks:

- gateway Stage 5 routes
- red-team, SOC, detection engineer, and admin login
- campaign execution
- beacon heartbeat and safe task execution simulation
- raw command rejection
- redirector traffic shaping
- lateral movement path simulation
- reversible persistence cleanup
- purple-team replay
- Stage 5 alert generation
- Wazuh-compatible output
- correlation timeline and incidents
- centralized log summary
- service health count

## False Positive Notes

Stage 5 alerts are expected during scheduled exercises. Outside an approved exercise window, these detections should be treated as misconfiguration or unauthorized lab use.

## Recommendations

- Keep Stage 5 telemetry enabled during all exercises.
- Require named campaigns and operator identity for every replay.
- Confirm persistence cleanup after every persistence simulation.
- Review low-noise profile usage because it intentionally tests detection visibility under reduced activity.
