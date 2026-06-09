# Governance Architecture

Governance in Shield-PDP is operational, not decorative. It connects RBAC, secrets lifecycle, policy drift, deployment approvals, integrity validation, and compliance scoring.

## Governance Flow

```mermaid
flowchart LR
  RBAC[RBAC and Service Accounts] --> Governance[Governance Engine]
  Secrets[Secrets Lifecycle] --> Governance
  Delivery[Delivery Governance] --> Governance
  Mesh[Zero Trust Mesh] --> Governance
  K8s[Kubernetes Policy] --> Governance
  Governance --> Logs[Central Logs]
  Logs --> Detection[Stage 7 Detections]
  Detection --> SOC[SOC / Compliance Review]
```

## Governance Domains

| Domain | Examples |
| --- | --- |
| Identity | Role assignments, service-account scopes, least privilege. |
| Secrets | Rotation simulation, lifecycle tracking, no secret material generation. |
| Kubernetes | Namespace quotas, network policies, deployment probes. |
| Delivery | Artifact verification, dependency scan simulation, approval gates. |
| Zero Trust | mTLS posture, service identity, policy decisions. |
| Audit | Evidence export, drift detection, compliance score. |

## Operational Use

Use governance docs and APIs during:
- platform readiness reviews
- executive tabletop exercises
- SOC audit evidence training
- GitOps approval walkthroughs
- policy drift investigations
