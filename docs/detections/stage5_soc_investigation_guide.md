# Shield-PDP Stage 5 - SOC Investigation Guide

This guide describes the expected SOC workflow for controlled adversary simulation events.

## Triage Flow

1. Open `/purple/api/incidents` or `/correlation/api/attack-paths`.
2. Filter incidents with rule IDs beginning with `SHIELD-S5`.
3. Pivot to `/correlation/api/timeline` using `request_id`, `operation_run_id`, `campaign_id`, or `replay_id`.
4. Confirm the event has `safe_simulation=true` and `simulation_scope=isolated-lab`.
5. Add triage notes through `/purple/api/incidents/:incidentId/triage`.

## Investigation Pivots

| Field | Use |
| --- | --- |
| `operation_run_id` | Groups campaign start, step, OPSEC, and completion events |
| `replay_id` | Groups replay-generated timeline events |
| `beacon_session_id` | Groups heartbeat and task simulation events |
| `pivot_id` | Groups lateral movement simulation events |
| `persistence_id` | Confirms persistence registration and cleanup |
| `request_id` | Links gateway, service, SIEM, and correlation telemetry |

## Expected Alert Patterns

- Beacon simulation should produce heartbeat and task alerts.
- Redirector simulation should preserve gateway request tracing and produce route-chain alerts.
- Pivot simulation should produce trust-boundary movement alerts.
- Persistence registration should be followed by cleanup telemetry.
- Campaign completion should correlate with earlier campaign steps.
- Replay should contain a `replay_id` for reconstruction.

## Escalation Criteria

Escalate an exercise incident if:

- a Stage 5 event lacks `safe_simulation=true`
- a raw command is accepted by beacon simulation
- a persistence record remains active after cleanup
- Stage 5 traffic appears outside an approved exercise window
- correlation misses expected Stage 5 rule IDs

## Cleanup Check

After a persistence exercise:

```text
GET /persistence/api/active
POST /persistence/api/cleanup
```

The expected active count after cleanup is zero.
