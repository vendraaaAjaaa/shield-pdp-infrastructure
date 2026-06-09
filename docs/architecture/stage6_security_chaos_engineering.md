# Shield-PDP Stage 6 - Security Chaos Engineering

Security chaos engineering is implemented as reversible simulation records and telemetry only.

## Service

| Service | Route | Purpose |
| --- | --- | --- |
| `chaos-sim` | `/chaos/` | Controlled resilience simulations for telemetry, auth, secrets, RBAC, CI/CD, logging, and outage scenarios |

## Scenarios

- telemetry drop
- auth desync
- secret exposure
- RBAC misconfiguration
- expired token
- logging degradation
- CI/CD instability
- partial service outage

## Safety

The service does not actually degrade logging, stop services, change RBAC, expose secrets, or break authentication. It emits tagged simulation telemetry and maintains reversible in-memory injection records.

## Events

- `stage6.chaos.injected`
- `stage6.chaos.reverted`
- scenario-specific `stage6.chaos.*_simulated` events
