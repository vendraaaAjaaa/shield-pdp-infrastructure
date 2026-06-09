# Shield-PDP Stage 7 - Kubernetes Architecture

Stage 7 adds a Kubernetes deployment model without replacing Docker Compose. Compose remains the local lab runtime, while `kubernetes/` provides distributed deployment artifacts for cyber range environments.

Core design:
- Namespaces segment edge, identity, enterprise, devops, observability, and intelligence zones.
- Deployments use `/health` and `/ready` probes.
- ResourceQuota and HPA objects model enterprise capacity controls.
- NetworkPolicy manifests model default-deny and explicit observability/identity flows.
- Ingress routes preserve the same gateway-facing service model as Compose.

Safety constraints:
- Kubernetes artifacts are deployment templates only.
- Stage 7 validation does not mutate a real cluster.
- Secrets are lab templates and must be replaced by generated lab-only values before real deployment.
