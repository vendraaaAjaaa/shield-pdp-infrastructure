# Kubernetes Operations

Shield-PDP Kubernetes support is designed for internal distributed cyber range deployments while preserving Docker Compose local mode.

## Directory Layout

| Path | Purpose |
| --- | --- |
| `kubernetes/base` | Namespace, config, secret template, deployment, service, HPA, network policy, ingress. |
| `kubernetes/overlays/local` | Local-lab Kustomize overlay. |
| `kubernetes/overlays/distributed` | Distributed cyber range overlay. |

## Deployment Concepts

- Namespace segmentation mirrors Compose trust zones.
- Deployments use `/health` and `/ready`.
- Resource quotas model enterprise capacity governance.
- Network policies model default-deny behavior and explicit observability/identity access.
- Secrets are templates and must be replaced with lab-generated values.

## Pre-Deployment Review

| Check | Required |
| --- | --- |
| Image repository points to internal registry | Yes |
| Lab secret templates replaced | Yes |
| Ingress host matches internal DNS | Yes |
| Network policies are supported by cluster CNI | Yes |
| Resource quota values match class size | Yes |
| Stage validation passes in Compose | Yes |

## Safety Note

Kubernetes manifests are not offensive tooling. They provide deployment structure for the cyber range services and must remain isolated to internal lab environments.
