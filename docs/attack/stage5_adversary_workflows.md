# Shield-PDP Stage 5 - Adversary Workflow Simulation

Stage 5 models red-team workflows as controlled state transitions and telemetry events. It does not run exploit code, create malware, create real persistence, or contact public infrastructure.

## Campaign Templates

| Campaign | Focus | Primary Techniques |
| --- | --- | --- |
| insider-threat-simulation | Identity review, portal access, controlled collection marker | T1087, T1069, T1119, T1029 |
| cicd-compromise-simulation | Repository, CI control plane, artifact provenance | T1552, T1078, T1195.002 |
| token-abuse-campaign | Delegated-token abuse and service-account trust | T1550.001, T1606, T1078 |
| internal-recon-campaign | DNS, service map, metadata discovery | T1590, T1046, T1082 |
| secrets-abuse-campaign | Secret policy misuse and environment exposure | T1552, T1528, T1078 |

Run a campaign:

```bash
curl -s -X POST http://localhost:3100/ops/api/campaigns/token-abuse-campaign/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"controlled"}'
```

## Beacon Simulation

Beacon simulation supports:

- callback interval
- jitter percent
- sleep profile
- encrypted telemetry simulation
- heartbeat events
- allowlisted synthetic tasks

Allowed task types:

- `enumerate_services`
- `collect_identity_context`
- `simulate_ci_pivot`
- `simulate_secret_probe`
- `simulate_admin_route_check`
- `sleep`
- `simulate_command`

`simulate_command` is not command execution. It requires `command_profile` and returns synthetic output only. Raw fields such as `command`, `shell`, or `raw_command` are rejected.

## Redirector And Traffic Shaping

Redirector simulation models route selection and traffic shaping through fixed route chains:

- `enterprise-gateway -> redirector-sim -> beacon-sim`
- `enterprise-gateway -> redirector-sim -> adversary-control`
- `enterprise-gateway -> redirector-sim -> soc-dashboard`

The redirector never opens a public listener. It emits route-chain telemetry for detection and replay.

## Lateral Movement Simulation

Pivot paths model enterprise trust relationships:

- delegated token pivot from identity to enterprise admin surfaces
- CI runner pivot from devops to enterprise services
- service account pivot from enterprise to secrets broker
- internal admin route traversal

Each pivot emits `adversary.pivot.simulated` and `adversary.lateral_movement.simulated` with trust-boundary metadata.

## Persistence Simulation

Supported mechanisms:

- scheduled task simulation
- startup entry simulation
- token cache simulation
- CI runner registration simulation
- service registration simulation
- credential cache simulation

Persistence records are in-memory simulation records with cleanup APIs. They do not modify the host, container runtime, service manager, filesystem startup paths, or CI runner configuration.

## Replay Workflow

SOC and red-team users can replay adversary timelines through:

```text
POST /purple/api/replay/adversary-timeline
POST /ops/api/replay/adversary-timeline
```

Replay emits tagged telemetry with a `replay_id`, enabling Stage 4 correlation and incident reconstruction.
