# Production-Scale Governance Chain

## Objective

Train platform and SOC teams on how GitOps, policy drift, zero-trust routing, telemetry SLA, and replay evidence fit together in an enterprise cyber range.

## Prerequisites

- `make stage7-up`
- Admin, detection engineer, or platform engineer token

## Lab Workflow

1. Validate Kubernetes manifests through `kubernetes-orchestrator`.
2. Plan a GitOps rollout through `gitops-controller`.
3. Evaluate zero-trust policy for a vendor-to-admin route.
4. Run governance compliance check.
5. Verify artifact, dependency scan, approval, and delivery policy.
6. Generate distributed telemetry trace and executive dashboard.
7. Export replay evidence.

## Telemetry Generated

- `stage7.kubernetes.manifest_validated`
- `stage7.gitops.rollout_planned`
- `stage7.mesh.policy_evaluated`
- `stage7.governance.compliance_checked`
- `stage7.governance.policy_drift_detected`
- `stage7.delivery.artifact_verified`
- `stage7.telemetry.trace_generated`
- `stage7.replay.export_generated`

## Detections Triggered

- `SHIELD-S7-K8S-GITOPS-001`
- `SHIELD-S7-ZEROTRUST-001`
- `SHIELD-S7-GOVERNANCE-001`
- `SHIELD-S7-DELIVERY-001`
- `SHIELD-S7-TELEMETRY-001`
- `SHIELD-S7-REPLAY-001`

## ATT&CK Mapping

| Technique | Lab Interpretation |
| --- | --- |
| `T1195.002` | Supply-chain and deployment governance simulation. |
| `T1021` | Policy-based service movement path. |
| `T1550.001` | Identity-aware route and service-account policy. |
| `T1041` | Telemetry/export pattern visibility. |
| `T1082` | Infrastructure discovery and reporting. |

## Cleanup

No cluster mutation or real deployment occurs. Preserve export IDs for class evidence and run:

```bash
make stage7-validate
```
