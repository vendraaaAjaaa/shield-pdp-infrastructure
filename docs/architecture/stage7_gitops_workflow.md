# Shield-PDP Stage 7 - GitOps Workflow

GitOps support is organized under `gitops/` and `helm/shield-pdp/`.

Workflow:
- Render or review Helm values.
- Validate Kubernetes overlays.
- Plan rollout through the `gitops-controller` simulation.
- Record approval and policy evidence through delivery governance.
- Simulate rollback readiness before promotion.

ArgoCD-compatible manifests live in `gitops/argocd/`. They intentionally reference an `.invalid` repository URL to prevent accidental public deployment while documenting the expected internal GitOps shape.
