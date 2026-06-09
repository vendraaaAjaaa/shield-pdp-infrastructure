# Governance And Compliance Guide

Shield-PDP governance teaches how platform controls, identity, secrets, policy drift, delivery approval, and audit evidence fit into enterprise cyber range operations.

## Governance Domains

| Domain | Stage | Example Evidence |
| --- | --- | --- |
| RBAC | Stage 2+ | `/identity/rbac/roles`, service accounts. |
| Secrets lifecycle | Stage 3 and Stage 7 | Secrets broker paths, rotation simulation. |
| Detection coverage | Stage 4+ | Detection validation coverage percentage. |
| Adversary safety | Stage 5 | Safety controls on beacon, pivot, persistence. |
| Intelligence coverage | Stage 6 | Coverage matrix, blindspot analysis. |
| Infrastructure governance | Stage 7 | Namespace quotas, policy drift, approvals. |

## Policy Drift

Stage 7 includes a policy drift example for service-account minimum scope. The point is to train review workflow:

1. Detect drift.
2. Assess affected identities.
3. Review blast radius.
4. Document remediation.
5. Validate telemetry and replay evidence.

## Secrets Lifecycle

Secret rotation simulation returns references only. It never generates usable production secret material.

Expected evidence:
- rotation ID
- secret reference
- lifecycle tracked
- `new_secret_material_generated=false`

## Audit Workflow

1. Run `make stage7-validate`.
2. Export dashboard and replay evidence.
3. Capture governance score.
4. Capture drift list.
5. Capture delivery approval IDs.
6. Attach detection coverage summary.

## Compliance Simulation

Compliance scoring is educational. It is not a replacement for a formal audit, but it provides realistic evidence patterns for internal training.
