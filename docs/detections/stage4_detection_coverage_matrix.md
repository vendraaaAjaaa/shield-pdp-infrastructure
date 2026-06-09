# Stage 4 Detection Coverage Matrix

| Rule ID | Scenario | Severity | Event Source | MITRE | SOC Visibility | Mitigation |
| --- | --- | --- | --- | --- | --- | --- |
| `SHIELD-S4-SSRF-001` | SSRF preview to internal service | High | `lab.ssrf_internal_service_preview` | `T1190`, `T1590` | Alert plus timeline entry from `internal-api` | Egress policy and metadata deny rules |
| `SHIELD-S4-METADATA-001` | Internal metadata read | High | `lab.internal_metadata_read` | `T1590`, `T1552` | Alert from `service-discovery` with request ID | Restrict metadata endpoints and service-to-service reachability |
| `SHIELD-S4-JWT-001` | JWT audience confusion accepted | Critical | `lab.legacy_audience_token_accepted` | `T1550.001`, `T1606` | Critical identity abuse alert | Strict issuer, audience, expiry, and RBAC validation |
| `SHIELD-S4-JWT-002` | Stale token accepted | Medium | `lab.stale_delegated_token_accepted` | `T1550.001` | Token lifetime anomaly | Remove stale-token grace or require introspection |
| `SHIELD-S4-SVC-001` | Service account shadow admin access | High | `lab.service_account_admin_shadow_access` | `T1078`, `T1550.001` | Service principal abuse alert | Replace broad service roles with granular scopes |
| `SHIELD-S4-CICD-001` | Pipeline token exposed | High | `lab.pipeline_token_exposed` | `T1552`, `T1078` | CI credential exposure alert | Store CI secrets outside repositories |
| `SHIELD-S4-CICD-002` | Token-only pipeline run | High | `lab.poisoned_build_flow_simulated` | `T1195.002`, `T1078` | Pipeline execution alert | Require workload identity and repository policy checks |
| `SHIELD-S4-ARTIFACT-001` | Artifact environment leakage | Medium | `lab.artifact_environment_exposed` | `T1552`, `T1082` | Artifact metadata exposure alert | Strip environment snapshots from broad-read artifacts |
| `SHIELD-S4-SECRETS-001` | Legacy secret read by pipeline token | Critical | `lab.secret_legacy_token_read` | `T1552`, `T1528` | Critical secrets broker alert | Disable token-only secret reads |
| `SHIELD-S4-ADMIN-001` | Admin route authorization anomaly | Medium | `http.request` 401/403 on admin/directory paths | `T1069`, `T1087` | Admin route denial alert | Correlate repeated denials with identity abuse |
| `SHIELD-S4-PRIVESC-001` | Privilege escalation path | High | JWT audience or service account abuse events | `T1550.001`, `T1078` | Correlated identity escalation alert | Centralize token and service-account policy |
| `SHIELD-S4-RECON-001` | Internal recon via service discovery | Medium | `lab.service_discovery_dns_recon`, `lab.service_discovery_map_recon` | `T1590`, `T1046` | Recon alert and timeline stage | Baseline service discovery use |

## Validation Expectations

`make stage4-validate` seeds safe Stage 3 telemetry, then verifies:

- rule load count
- alert generation
- validation coverage
- normalized SIEM events
- Wazuh-compatible alerts
- OpenSearch-compatible documents
- attack timeline
- incident queue
- identity abuse summary
- triage note creation
- controlled telemetry replay
