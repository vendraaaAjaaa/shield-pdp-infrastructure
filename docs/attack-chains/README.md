# Attack Chain Walkthroughs

These walkthroughs are defensive training scenarios. They explain how Shield-PDP generates telemetry, detections, and replay evidence for realistic enterprise weaknesses.

> Do not treat these walkthroughs as public exploitation guides. All paths use local lab endpoints, synthetic data, and controlled simulation services.

## Scenario Index

| Scenario | Stage | Primary Learning |
| --- | --- | --- |
| [SSRF to CI token to secrets broker](ssrf_internal_recon_ci_secrets.md) | Stage 3-4 | Internal trust abuse and detection correlation. |
| [JWT audience confusion](jwt_audience_confusion.md) | Stage 3-4 | Token validation gaps and strict audience enforcement. |
| [Service account pivot](service_account_pivot.md) | Stage 3-6 | Service role misuse and attack graph visibility. |
| [Beacon simulation workflow](beacon_simulation_workflow.md) | Stage 5 | Safe beacon telemetry, task simulation, and detection. |
| [Persistence simulation workflow](persistence_simulation_workflow.md) | Stage 5 | Reversible persistence markers and cleanup evidence. |
| [Production-scale governance chain](production_scale_governance_chain.md) | Stage 7 | GitOps, policy drift, telemetry SLA, governance response. |

## Common Exercise Format

Each scenario includes:
- objective
- prerequisites
- attack path in lab-safe terms
- telemetry generated
- detections triggered
- MITRE ATT&CK mapping
- replay notes
- cleanup steps

## Exercise Safety Checklist

- Confirm `make stage7-up` has completed.
- Use only `localhost` gateway routes.
- Do not add external targets or callbacks.
- Keep all simulation IDs and request IDs for replay.
- Run the relevant validation script after the exercise.
