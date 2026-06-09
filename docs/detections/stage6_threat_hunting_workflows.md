# Shield-PDP Stage 6 - Threat Hunting Workflows

Stage 6 adds a threat hunting service for telemetry pivots, ATT&CK hunt packs, anomaly clustering, and investigation notes.

## Service

| Service | Route | Purpose |
| --- | --- | --- |
| `threat-hunting` | `/hunt/` | IOC hunts, anomaly hunts, identity abuse hunts, timeline pivots, and workspace notes |

## Hunt Packs

- identity abuse
- CI/CD and supply chain
- low-noise operations
- persistence simulation

## Query Types

- `ioc`
- `anomaly`
- `identity_abuse`
- `timeline`
- `attack_pattern`

## Telemetry

- `stage6.hunt.query_executed`
- `stage6.hunt.workspace_updated`

Hunts read existing lab telemetry only and do not trigger offensive actions.
