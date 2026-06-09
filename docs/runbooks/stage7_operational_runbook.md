# Shield-PDP Stage 7 - Operational Runbook

Start Stage 7:

```bash
make stage7-up
```

Validate Stage 7:

```bash
make stage7-validate
```

Inspect service status:

```bash
make stage7-ps
```

Primary Stage 7 routes:
- `/platform/kubernetes/`
- `/platform/gitops/`
- `/telemetry-fabric/`
- `/resilience/`
- `/environments/`
- `/zero-trust/`
- `/governance/`
- `/delivery-governance/`
- `/scale/`

Operational constraints:
- Do not connect Stage 7 simulations to public targets.
- Do not replace lab secret templates with production material.
- Keep Compose as the local compatibility baseline.
- Use Kubernetes and Helm artifacts as controlled deployment templates.
