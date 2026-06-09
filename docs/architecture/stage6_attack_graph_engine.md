# Shield-PDP Stage 6 - Dynamic Attack Graph Engine

The attack graph engine builds a graph from static enterprise relationships and recent telemetry.

## Service

| Service | Route | Purpose |
| --- | --- | --- |
| `attack-graph` | `/attack-graph/` | Trust mapping, privilege path analysis, service dependency graph, and blast-radius estimation |

## Graph Inputs

- directory users and roles
- service catalog
- internal DNS records
- repository and CI/CD dependencies
- vault policy relationships
- Stage 5 pivot paths
- recent telemetry from the centralized log collector

## Outputs

- `/api/graph`
- `/api/paths/privilege-escalation`
- `/api/blast-radius?service=secrets-broker`
- `/api/trust-boundaries`

## Telemetry

- `stage6.attack_graph.generated`
- `stage6.attack_graph.privilege_path_analysis`

The graph is analytical only. It does not execute exploitation or mutate service state.
