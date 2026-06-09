# Shield-PDP Stage 3 - Vulnerable Enterprise Ecosystem

## Scope

Stage 3 extends the Stage 2 enterprise core with realistic, controlled enterprise weaknesses. The implementation preserves the overlay strategy and does not add C2, beaconing, persistence, malware behavior, ransomware behavior, destructive automation, or public-target tooling.

The goal is to model identity-centric attack paths and trust abuse that appear in real organizations:

- token validation drift across services
- stale delegated token acceptance in legacy components
- overtrusted service accounts
- internal-only route assumptions
- CI/CD token leakage and token-only pipeline hooks
- artifact and environment metadata exposure
- vault policy drift and legacy secret access

All sensitive-looking values are synthetic lab values and are not usable outside the isolated environment.

## Added Services

All services are based on `services/enterprise-core` and run as separate containers with health checks, read-only filesystems, no-new-privileges, dropped Linux capabilities, structured logs, request IDs, and telemetry to the Stage 2 log collector.

| Service | Mode | Zone | Purpose |
| --- | --- | --- | --- |
| `internal-api` | `internal-api` | enterprise | Business API mesh for delegated token, SSRF-preview, and service-account trust scenarios. |
| `service-discovery` | `service-discovery` | enterprise | Internal DNS, service map, and internal metadata simulation. |
| `git-sim` | `git` | devops | Fake source control API with CI config exposure. |
| `ci-sim` | `ci` | devops | Token-only pipeline hook and simulated build run queue. |
| `artifact-store` | `artifact` | devops | Internal artifact metadata and environment snapshot exposure. |
| `secrets-broker` | `secrets` | identity/data | Vault policy simulation and legacy pipeline-token secret read path. |

## Gateway Routes

| Route | Auth Model | Backend | Notes |
| --- | --- | --- | --- |
| `/internal/api/` | developer/admin/SOC user token | `internal-api` | User-facing internal API lab routes. |
| `/service/internal-api/` | service role or developer/admin token | `internal-api` | Models service-to-service trust abuse. |
| `/service-discovery/` | employee-class user token | `service-discovery` | Internal recon surface. |
| `/service-discovery/internal/` | blocked at gateway | none | Metadata stays internal and is reachable only through the controlled SSRF-preview scenario. |
| `/devops/git/` | developer/admin user token | `git-sim` | Fake repository and CI config. |
| `/devops/ci/` | developer/admin user token | `ci-sim` | Developer view of CI service. |
| `/ci-hook/` | `X-Pipeline-Token` only | `ci-sim` | Token-only webhook misconfiguration simulation. |
| `/devops/artifacts/` | employee-class user token | `artifact-store` | Overbroad artifact read surface. |
| `/lab/secrets/` | `X-Pipeline-Token` only | `secrets-broker` | Legacy vault read path. |

## Weakness Catalog

### S3-ID-001 - JWT audience confusion

- Endpoint to issue lab token: `GET /identity/lab/tokens/audience-confusion`
- Legacy validation path: `POST /internal/api/lab/audience-confusion/admin-context`
- Secure control path: `POST /internal/api/secure/admin-context`
- Weakness: a legacy internal validator verifies signature and issuer but ignores `aud`.
- Control: strict validator rejects the same token because `aud` is `shield-pdp-ci`, not `shield-pdp-internal`.
- MITRE ATT&CK: `T1550.001`, `T1606`
- Detection events: `lab.identity.audience_confusion_token_issued`, `lab.legacy_audience_token_accepted`
- Risk: high

### S3-ID-002 - Stale delegated token acceptance

- Token issue endpoint: `GET /identity/lab/tokens/stale`
- Legacy path: `POST /internal/api/lab/stale-session/delegated`
- Weakness: legacy session bridge accepts an expired delegated token inside a configured grace window.
- MITRE ATT&CK: `T1550.001`
- Detection events: `lab.identity.stale_token_issued`, `lab.stale_delegated_token_accepted`
- Risk: medium

### S3-TRUST-001 - Service account shadow administration

- Endpoint: `GET /service/internal-api/lab/admin-shadow/users`
- Weakness: internal API accepts broad service roles as sufficient authority for a privileged directory-like view.
- Required token: valid service account token such as `employee-portal`.
- MITRE ATT&CK: `T1078`, `T1550.001`
- Detection event: `lab.service_account_admin_shadow_access`
- Risk: high

### S3-TRUST-002 - Controlled SSRF to internal metadata

- Endpoint: `POST /internal/api/lab/link-preview`
- Allowed targets: `metadata`, `service_map`
- Weakness: link-preview service can reach internal-only metadata and service map endpoints.
- Safety control: the endpoint only accepts pre-defined internal target keys, not arbitrary URLs.
- MITRE ATT&CK: `T1190`, `T1590`
- Detection events: `lab.ssrf_internal_service_preview`, `lab.internal_metadata_read`
- Risk: high

### S3-CICD-001 - Pipeline token exposed in CI config

- Endpoint: `GET /devops/git/api/repos/customer-api/ci-config`
- Weakness: CI token is represented in repository pipeline configuration.
- MITRE ATT&CK: `T1552`, `T1078`
- Detection event: `lab.pipeline_token_exposed`
- Risk: high

### S3-CICD-002 - Token-only pipeline run

- Endpoint: `POST /ci-hook/api/pipelines/customer-api/run`
- Auth model: `X-Pipeline-Token` only.
- Weakness: pipeline action depends on a static token rather than signed identity and repository policy.
- Safety control: records a simulated run only. It does not execute commands, deploy artifacts, or call external systems.
- MITRE ATT&CK: `T1195.002`, `T1078`
- Detection event: `lab.poisoned_build_flow_simulated`
- Risk: high

### S3-RECON-001 - Internal DNS and service discovery exposure

- Endpoints: `GET /service-discovery/api/dns`, `GET /service-discovery/api/service-map`
- Weakness: broad employee-class access to internal DNS naming and service trust metadata.
- MITRE ATT&CK: `T1590`, `T1046`
- Detection events: `lab.service_discovery_dns_recon`, `lab.service_discovery_map_recon`
- Risk: medium

### S3-SECRET-001 - Legacy pipeline-token vault read

- Endpoint: `GET /lab/secrets/api/legacy-read/deploy/prod`
- Auth model: `X-Pipeline-Token` only.
- Weakness: legacy vault broker accepts the pipeline token directly for deployment secret reads.
- Safety control: returns synthetic lab secret values only.
- MITRE ATT&CK: `T1552`, `T1528`
- Detection event: `lab.secret_legacy_token_read`
- Risk: critical

### S3-ARTIFACT-001 - Artifact environment metadata exposure

- Endpoint: `GET /devops/artifacts/public/latest`
- Weakness: broad internal artifact access exposes internal URLs, deployment role names, and vault policy references.
- MITRE ATT&CK: `T1552`, `T1082`
- Detection event: `lab.artifact_environment_exposed`
- Risk: medium

## Observability

Each service continues to emit:

- structured JSON stdout logs
- `X-Request-ID` correlation
- Prometheus-style `/metrics`
- `/health` and `/ready`
- telemetry events to `log-collector`

Stage 3 event names to monitor:

- `lab.identity.audience_confusion_token_issued`
- `lab.legacy_audience_token_accepted`
- `lab.identity.stale_token_issued`
- `lab.stale_delegated_token_accepted`
- `lab.service_account_admin_shadow_access`
- `lab.ssrf_internal_service_preview`
- `lab.internal_metadata_read`
- `lab.service_discovery_dns_recon`
- `lab.service_discovery_map_recon`
- `lab.pipeline_token_exposed`
- `lab.poisoned_build_flow_simulated`
- `lab.artifact_environment_exposed`
- `lab.secret_legacy_token_read`
- `lab.pipeline_token_rejected`

Useful blue-team pivots:

- requests to `/identity/lab/tokens/*`
- any 200 response on `/internal/api/lab/*`
- service account principal accessing `/service/internal-api/*`
- `X-Pipeline-Token` usage on `/ci-hook/*` or `/lab/secrets/*`
- metadata read events where `source` is `internal-api`
- artifact reads followed by CI or secret broker events with the same request chain timing

## Runbook

Start Stage 3:

```sh
make stage3-up
```

Validate Stage 3:

```sh
make stage3-validate
```

Show service status:

```sh
make stage3-ps
```

The Stage 3 validator executes the controlled chain through the gateway and checks:

- gateway health
- direct gateway block for internal metadata
- audience-confusion token issue and legacy acceptance
- strict audience rejection control
- stale delegated token acceptance in legacy path
- service account trust abuse
- controlled SSRF-preview to internal metadata
- internal DNS recon surface
- CI config token exposure
- token-only pipeline run
- artifact environment exposure
- legacy secret broker read
- observability health for Stage 3 services
- centralized log summary access

## Migration Strategy

Stage 3 keeps vulnerable behavior isolated in explicit `lab` or simulation routes. The normal Stage 2 business portals and identity flows remain compatible.

Recommended next refactors before Stage 4:

1. Split token validators into named modules: strict, legacy-audience, and legacy-stale-session.
2. Add policy metadata to every gateway route so the route table can be rendered in the dashboard.
3. Move scenario catalog data into versioned JSON fixtures for future scenario automation.
4. Add Sigma-style detection rule files for every `lab.*` telemetry event.
5. Add a scenario timeline endpoint that correlates request IDs, service logs, and MITRE mappings.

## Safety Boundary

This stage intentionally avoids:

- arbitrary URL fetching
- command execution in CI simulation
- real secret material
- external callbacks
- malware payloads
- persistence mechanisms
- C2 or beacon simulation

All paths are local, deterministic, observable, and designed for isolated education and research.
