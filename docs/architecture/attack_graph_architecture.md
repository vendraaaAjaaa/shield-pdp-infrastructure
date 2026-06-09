# Attack Graph Architecture

The attack graph models relationships between users, roles, services, DNS, repositories, vault policies, telemetry events, and simulated pivot paths.

## Graph Inputs

- Directory users and roles.
- Service catalog and gateway exposure.
- Internal DNS records.
- Repository and CI/CD relationships.
- Vault policy simulation.
- Stage 5 pivot paths.
- Stage 6 and Stage 7 telemetry.

## Graph Output

| Output | Use |
| --- | --- |
| Nodes | Services, identities, DNS records, repositories, policies, observed principals. |
| Edges | Trust relationships, role assignments, pipeline triggers, pivots, observed activity. |
| Privilege paths | Candidate trust paths touching privileged services. |
| Blast radius | Reachability and risk scoring from a starting service. |
| Multi-environment graph | Region, tenant, VPN, vendor, and shared-service trust links. |

## SOC Usage

1. Generate graph from recent telemetry.
2. Identify high-severity privilege paths.
3. Pivot to correlated alerts.
4. Export replay or timeline evidence.
5. Document mitigation opportunities.
