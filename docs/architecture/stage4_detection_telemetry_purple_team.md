# Shield-PDP Stage 4 - Detection, Telemetry, and Purple Team Infrastructure

## Scope

Stage 4 adds detection engineering and purple-team visibility on top of the validated Stage 1-3 enterprise lab. It preserves the existing overlay strategy and does not replace the gateway, identity service, Stage 3 vulnerable ecosystem, or legacy vulnerable API lab.

This stage is safe and educational. It does not add malware, persistence, C2, destructive automation, or public-target tooling.

## Added Services

| Service | Mode | Purpose |
| --- | --- | --- |
| `siem-bridge` | `siem` | Normalizes central telemetry and exposes Wazuh-style alerts plus OpenSearch bulk-compatible documents. |
| `detection-engine` | `detection` | Applies Sigma-style rules to log collector events and exposes alert/validation APIs. |
| `correlation-engine` | `correlation` | Reconstructs attack timelines, groups alerts into incidents, and summarizes identity abuse. |
| `soc-dashboard` | `soc-dashboard` | Simulated SOC workflow: incident queue, triage notes, and controlled telemetry replay. |

All services use the existing `services/enterprise-core` image, structured logs, `X-Request-ID`, service account auth, `/health`, `/ready`, and `/metrics`.

## Gateway Routes

| Route | Role Gate | Backend |
| --- | --- | --- |
| `/siem/` | `soc_analyst`, `detection_engineer`, `red_team_operator`, `admin` | `siem-bridge` |
| `/detections/` | `soc_analyst`, `detection_engineer`, `red_team_operator`, `admin` | `detection-engine` |
| `/correlation/` | `soc_analyst`, `detection_engineer`, `red_team_operator`, `admin` | `correlation-engine` |
| `/purple/` | `soc_analyst`, `detection_engineer`, `red_team_operator`, `admin` | `soc-dashboard` |

## Telemetry Pipeline

1. Stage 1-3 services emit structured JSON telemetry to `log-collector`.
2. `log-collector` exposes `/events/export` for trusted observability service accounts.
3. `siem-bridge` normalizes events into a common event schema.
4. `detection-engine` applies Stage 4 Sigma-style rules.
5. `correlation-engine` reconstructs timeline and incidents.
6. `soc-dashboard` presents incident workflow and controlled replay.

## SIEM Integration

The lab provides lightweight compatibility endpoints instead of deploying a heavy external SIEM by default:

- `GET /siem/api/normalized-events`
- `GET /siem/api/wazuh/alerts`
- `GET /siem/api/opensearch/bulk`
- `GET /siem/api/opensearch/bulk.ndjson`

These are schema-compatible simulation points for Wazuh/OpenSearch practice and can be replaced by real sinks later without changing Stage 1-3 producers.

## Detection Engineering

Rule pack:

- `detections/sigma/stage4_enterprise_lab_rules.yml`

Runtime API:

- `GET /detections/api/rules`
- `GET /detections/api/alerts`
- `POST /detections/api/validation/run`

The validation run checks which rules fired against the current telemetry buffer and reports coverage percentage.

## Correlation

Correlation APIs:

- `GET /correlation/api/timeline`
- `GET /correlation/api/attack-paths`
- `GET /correlation/api/identity-abuse`

The engine groups high and critical alerts by principal and token path, preserving event IDs, request IDs, MITRE tags, tactics, and alert IDs.

## Purple Team Workflow

SOC dashboard APIs:

- `GET /purple/api/workflow`
- `GET /purple/api/incidents`
- `POST /purple/api/incidents/{incident_id}/triage`
- `POST /purple/api/replay/stage3-attack-chain`

Replay emits synthetic local telemetry only. It does not execute commands, deploy artifacts, call external systems, or perform destructive actions.

## Runbook

Start Stage 4:

```sh
make stage4-up
```

Validate Stage 4:

```sh
make stage4-validate
```

Show Stage 4 services:

```sh
make stage4-ps
```

## Compatibility

Stage 4 keeps the existing validations intact:

- `make stage2-validate`
- `make stage3-validate`
- `make validate`

`stage4-core` enables Stage 2, Stage 3, and Stage 4 services together. `stage2-core` remains free of Stage 3 and Stage 4 service dependencies.
