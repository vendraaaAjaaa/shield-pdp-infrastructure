# Shield-PDP Stage 5 - Adversary Operations Architecture

Stage 5 adds controlled adversary operations simulation on top of the Stage 1-4 enterprise, telemetry, and purple-team foundation. The design preserves the existing overlay compose strategy and does not replace Stage 2-4 services.

## Service Map

| Service | Mode | Route | Purpose |
| --- | --- | --- | --- |
| adversary-control | `adversary-control` | `/ops/` | Campaign templates, operator sessions, replay timeline, heatmap, and operation dashboard |
| beacon-sim | `beacon-sim` | `/beacons/` | Safe beacon session state, heartbeat simulation, jitter, sleep profiles, and allowlisted synthetic task results |
| redirector-sim | `redirector-sim` | `/redirector/` | Redirector route-chain and traffic-shaping simulation with gateway trace preservation |
| pivot-sim | `pivot-sim` | `/pivots/` | Lateral movement and trust-boundary path simulation without exploitation |
| persistence-sim | `persistence-sim` | `/persistence/` | Reversible persistence registration and cleanup simulation |

All services are built from `services/enterprise-core` and selected with `SERVICE_MODE`, matching the Stage 2-4 multi-mode pattern.

## Trust Boundaries

Stage 5 introduces an `adversary-operations` zone connected to:

- `shield_pdp_teamserver` for controlled red-team workflow simulation.
- `shield_pdp_enterprise` for gateway access and enterprise route modeling.
- `shield_pdp_identity` for JWT/RBAC and service account validation.
- `shield_pdp_observability` for structured event collection and detection correlation.

The gateway exposes only authenticated routes. Human access requires `red_team_operator`, `soc_analyst`, `detection_engineer`, or `admin`. Service-to-service access uses Stage 2 service account JWTs.

## Safety Controls

Every Stage 5 telemetry event carries:

- `lab_stage=stage5-adversary-operations`
- `attack_simulation=true`
- `safe_simulation=true`
- `simulation_scope=isolated-lab`
- controls confirming `destructive_actions=false`, `command_execution=false`, `external_callbacks=false`, `public_targets=false`, and `reversible=true`

Beacon tasks reject raw command input. The `simulate_command` task accepts only named synthetic profiles and returns predefined simulated output.

## Overlay Usage

Stage 5 is enabled with:

```bash
make stage5-up
make stage5-ps
make stage5-validate
```

The make target sets:

```bash
STAGE3_TARGETS_ENABLED=true
STAGE4_TARGETS_ENABLED=true
STAGE5_TARGETS_ENABLED=true
```

This keeps Stage 2-4 health monitoring intact while adding Stage 5 targets.
