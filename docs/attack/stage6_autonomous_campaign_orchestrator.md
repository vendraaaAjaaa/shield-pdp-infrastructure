# Shield-PDP Stage 6 - Autonomous Campaign Orchestrator

The campaign orchestrator models autonomous adversary progression as a synthetic, replayable state machine.

## Service

| Service | Route | Purpose |
| --- | --- | --- |
| `campaign-orchestrator` | `/campaigns/` | Controlled campaign progression, adaptive timing simulation, and deterministic replay export |

## Templates

- `adaptive-token-to-secrets`
- `cicd-pivot-chaos-aware`
- `recon-to-coverage-gap`

## Controls

Campaigns use rule-based synthetic decisioning only:

- no exploit execution
- no command execution
- no public targets
- no real data exfiltration
- replay export is deterministic

## Events

- `stage6.campaign.started`
- `stage6.campaign.phase_completed`
- `stage6.campaign.completed`
