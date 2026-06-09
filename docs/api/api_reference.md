# API Reference

This API reference documents the enterprise gateway routes used by Shield-PDP training and operations.

## Authentication

Token endpoint:

```http
POST /identity/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&username=admin.enterprise&password=AdminPass123!
```

Service-account tokens use `grant_type=client_credentials`.

## Common Headers

| Header | Purpose |
| --- | --- |
| `Authorization: Bearer <token>` | User or service token. |
| `X-Request-ID` | Correlation ID. Validators generate this automatically. |
| `Content-Type: application/json` | Required for JSON POST requests. |

## Route Families

| Prefix | Stage | Purpose | Typical Roles |
| --- | --- | --- | --- |
| `/identity/` | 2+ | OAuth, introspection, RBAC, directory. | all authenticated flows |
| `/employee/`, `/developer/`, `/internal/hr/`, `/internal/finance/`, `/internal/admin/` | 2+ | Enterprise portals. | employee, developer, hr, finance, admin |
| `/internal/api/`, `/service-discovery/`, `/devops/*`, `/lab/secrets/` | 3+ | Internal trust and CI/CD simulations. | developer, admin, service roles |
| `/siem/`, `/detections/`, `/correlation/`, `/purple/` | 4+ | Detection, SIEM, correlation, SOC workflows. | soc_analyst, detection_engineer, admin |
| `/ops/`, `/beacons/`, `/redirector/`, `/pivots/`, `/persistence/` | 5+ | Controlled adversary simulation. | red_team_operator, soc_analyst, admin |
| `/digital-twin/`, `/attack-graph/`, `/campaigns/`, `/hunt/`, `/coverage/`, `/chaos/`, `/intelligence/` | 6+ | Digital twin, graph, hunting, coverage, chaos, intelligence. | soc_analyst, threat_hunter, red_team_operator, admin |
| `/platform/kubernetes/`, `/platform/gitops/`, `/telemetry-fabric/`, `/resilience/`, `/environments/`, `/zero-trust/`, `/governance/`, `/delivery-governance/`, `/scale/` | 7 | Production-scale operations simulation. | platform_engineer, compliance_manager, admin |

## Example: Detection Validation

```http
POST /detections/api/validation/run
Authorization: Bearer <token>
Content-Type: application/json

{"stage":"stage7","limit":1000}
```

Expected response fields:
- `status`
- `evaluated_rules`
- `observed_rules`
- `coverage_percent`
- `missing_rules`

## Example: Stage 7 Replay Export

```http
POST /scale/api/replay/export
Authorization: Bearer <token>
Content-Type: application/json

{"limit":1000}
```

Expected safety fields:
- `deterministic=true`
- `controls.synthetic_only=true`
- `controls.destructive_actions=false`

## Telemetry Notes

Most POST workflows emit structured events. Use `X-Request-ID` to correlate:
- gateway logs
- service logs
- SIEM alerts
- correlation incidents
- replay exports

## Error Patterns

| Status | Meaning |
| --- | --- |
| `401` | Missing or invalid token. |
| `403` | Authenticated but missing required role. |
| `404` | Route not active or unsupported object. |
| `409` | Stage-specific feature not enabled. |
| `500` | Unexpected runtime error; should be treated as validation failure. |
