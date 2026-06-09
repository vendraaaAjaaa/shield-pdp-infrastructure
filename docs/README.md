# Shield-PDP Documentation Portal

This documentation set is the internal handbook for operating, teaching, validating, and extending Shield-PDP as an enterprise cyber range.

> Scope: All activities described here are synthetic, isolated-lab scoped, observable, controllable, replayable, and non-destructive.

## Documentation Map

| Area | Audience | Entry Point |
| --- | --- | --- |
| Getting started | New users, instructors, platform engineers | [getting-started/README.md](getting-started/README.md) |
| Enterprise architecture | Architects, platform engineers, detection engineers | [architecture/enterprise_topology.md](architecture/enterprise_topology.md) |
| Operations | Cyber range operators, SRE, platform teams | [operations/operations_guide.md](operations/operations_guide.md) |
| Labs and learning tracks | Instructors, students, security teams | [labs/learning_tracks.md](labs/learning_tracks.md) |
| Attack-chain walkthroughs | Purple team, SOC, detection engineers | [attack-chains/README.md](attack-chains/README.md) |
| Red-team simulation | Red team operators, purple team coordinators | [playbooks/red_team_operator_guide.md](playbooks/red_team_operator_guide.md) |
| SOC workflow | SOC analysts, incident responders | [playbooks/soc_analyst_guide.md](playbooks/soc_analyst_guide.md) |
| Threat hunting | Threat hunters, detection engineers | [hunt/threat_hunting_guide.md](hunt/threat_hunting_guide.md) |
| Replay and forensics | Incident responders, SOC leads | [replay/replay_forensics_guide.md](replay/replay_forensics_guide.md) |
| Governance | Compliance, security leadership, platform owners | [governance/governance_compliance_guide.md](governance/governance_compliance_guide.md) |
| Kubernetes and GitOps | Platform engineers | [kubernetes/kubernetes_operations.md](kubernetes/kubernetes_operations.md), [gitops/gitops_operations.md](gitops/gitops_operations.md) |
| Observability | Telemetry engineers, detection engineers | [observability/observability_guide.md](observability/observability_guide.md) |
| API reference | Integrators, validators, lab developers | [api/api_reference.md](api/api_reference.md) |
| Troubleshooting | Operators and maintainers | [troubleshooting/troubleshooting_guide.md](troubleshooting/troubleshooting_guide.md) |
| Runbooks | On-call and exercise operators | [runbooks/](runbooks/) |
| Reference | Terminology, docx export, stage matrix | [reference/terminology.md](reference/terminology.md) |

## Recommended Reading Order

1. [Getting Started](getting-started/README.md)
2. [Enterprise Topology](architecture/enterprise_topology.md)
3. [Service Dependencies](architecture/service_dependencies.md)
4. [Telemetry, Detection, And Replay Pipeline](architecture/telemetry_detection_replay_pipeline.md)
5. [Attack Chain Walkthroughs](attack-chains/README.md)
6. [SOC Analyst Guide](playbooks/soc_analyst_guide.md)
7. [Operations Guide](operations/operations_guide.md)
8. [Stage Validation Runbook](runbooks/stage_validation.md)

## Documentation Standards

- Use stage names consistently: Stage 1 through Stage 7.
- Frame all attack scenarios as simulation and defensive learning.
- Include telemetry and detection notes for every exercise.
- Prefer command examples that target local lab endpoints.
- Do not document public exploitation workflows or uncontrolled offensive tooling.

## Exporting To DOCX

The Markdown is structured with export-friendly headings, tables, callouts, and short sections. Use [reference/docx_ready_handbook.md](reference/docx_ready_handbook.md) as the table of contents for a single handbook export.
