# GitOps Operations

GitOps artifacts define reproducible deployment flows for internal cyber range environments.

## Directory Layout

| Path | Purpose |
| --- | --- |
| `gitops/argocd` | ArgoCD-compatible application manifests. |
| `gitops/environments/local` | Local environment kustomization. |
| `gitops/environments/distributed` | Distributed environment kustomization. |
| `helm/shield-pdp` | Helm chart and templates. |

## Workflow

1. Validate Compose baseline.
2. Review Kubernetes overlay.
3. Render Helm chart in internal CI.
4. Run policy validation.
5. Request deployment approval.
6. Sync through GitOps controller.
7. Preserve rollback evidence.

## Stage 7 Simulation APIs

| Route | Purpose |
| --- | --- |
| `/platform/gitops/api/applications` | ArgoCD-style application inventory. |
| `/platform/gitops/api/helm/releases` | Helm release model. |
| `/platform/gitops/api/rollouts/plan` | Staged rollout planning simulation. |
| `/platform/gitops/api/rollbacks/simulate` | Rollback readiness simulation. |

## Governance Requirements

- Rollout plans require traceable request IDs.
- Approvals are recorded by `delivery-governance`.
- Policy validation must pass before rollout planning.
- Rollbacks are simulated and must be replayable.
