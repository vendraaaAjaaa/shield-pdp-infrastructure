# Stage 4 MITRE ATT&CK Mapping and Attack-Path Coverage

## Technique Coverage

| ATT&CK Tactic | Technique | Shield-PDP Simulation | Detection Rule |
| --- | --- | --- | --- |
| Initial Access | `T1190` Exploit Public-Facing Application | Controlled SSRF preview path | `SHIELD-S4-SSRF-001` |
| Discovery | `T1590` Gather Victim Network Information | Internal DNS, service map, metadata reads | `SHIELD-S4-SSRF-001`, `SHIELD-S4-METADATA-001`, `SHIELD-S4-RECON-001` |
| Discovery | `T1046` Network Service Discovery | Service discovery API reads | `SHIELD-S4-RECON-001` |
| Discovery | `T1082` System Information Discovery | Artifact environment snapshot | `SHIELD-S4-ARTIFACT-001` |
| Discovery | `T1087` Account Discovery | Admin/directory route probes | `SHIELD-S4-ADMIN-001` |
| Discovery | `T1069` Permission Groups Discovery | Admin route authorization failures | `SHIELD-S4-ADMIN-001` |
| Credential Access | `T1552` Unsecured Credentials | CI token, artifact env, metadata, secrets broker | `SHIELD-S4-CICD-001`, `SHIELD-S4-SECRETS-001`, `SHIELD-S4-ARTIFACT-001` |
| Credential Access | `T1528` Steal Application Access Token | Legacy pipeline token secret read | `SHIELD-S4-SECRETS-001` |
| Defense Evasion | `T1550.001` Use Alternate Authentication Material | Audience confusion and stale token acceptance | `SHIELD-S4-JWT-001`, `SHIELD-S4-JWT-002` |
| Defense Evasion | `T1606` Forge Web Credentials | JWT audience confusion lab token | `SHIELD-S4-JWT-001` |
| Privilege Escalation | `T1078` Valid Accounts | Service account and pipeline token abuse | `SHIELD-S4-SVC-001`, `SHIELD-S4-CICD-002`, `SHIELD-S4-PRIVESC-001` |
| Execution | `T1195.002` Compromise Software Supply Chain | Token-only simulated pipeline run | `SHIELD-S4-CICD-002` |
| Collection | `T1552` Unsecured Credentials | Artifact and secret broker collection paths | `SHIELD-S4-ARTIFACT-001`, `SHIELD-S4-SECRETS-001` |

## Correlated Attack Path

1. Developer obtains a lab token with mismatched audience.
2. Legacy internal API accepts the token as delegated admin context.
3. Recon reads internal DNS and metadata through controlled preview behavior.
4. Service account accesses a shadow administration surface.
5. Git simulation exposes a pipeline token.
6. CI simulation accepts token-only pipeline execution.
7. Artifact store exposes environment metadata.
8. Legacy secrets broker accepts pipeline token and returns synthetic deployment secret references.
9. Detection engine emits alerts for each stage.
10. Correlation engine reconstructs a timeline and incident queue.
11. SOC dashboard supports triage and safe telemetry replay.

## Coverage Report

| Coverage Area | Stage 4 Capability |
| --- | --- |
| Structured event ingestion | `log-collector` plus `/events/export` |
| SIEM normalization | `siem-bridge` normalized event schema |
| Wazuh integration | `GET /siem/api/wazuh/alerts` |
| OpenSearch integration | `GET /siem/api/opensearch/bulk` and `.ndjson` |
| Detection rules | `GET /detections/api/rules` and Sigma-style file |
| Alert queue | `GET /detections/api/alerts` |
| Detection validation | `POST /detections/api/validation/run` |
| Attack timeline | `GET /correlation/api/timeline` |
| Attack path incidents | `GET /correlation/api/attack-paths` |
| Identity abuse tracking | `GET /correlation/api/identity-abuse` |
| SOC triage | `POST /purple/api/incidents/{incident_id}/triage` |
| Safe replay | `POST /purple/api/replay/stage3-attack-chain` |

## Safety Notes

Stage 4 replay emits synthetic telemetry only. It does not exploit services, run shell commands, deploy artifacts, call external infrastructure, or persist access.
