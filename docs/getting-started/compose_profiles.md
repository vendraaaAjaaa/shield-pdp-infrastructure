# Docker Compose Profiles

Shield-PDP uses a layered Compose strategy. Each stage adds services while preserving compatibility with earlier stages.

## Profile Strategy

```mermaid
flowchart LR
  Base[Base Compose] --> S2[stage2-core]
  S2 --> S3[stage3-core]
  S3 --> S4[stage4-core]
  S4 --> S5[stage5-core]
  S5 --> S6[stage6-core]
  S6 --> S7[stage7-core]
```

## Commands

| Stage | Start | Status | Validate |
| --- | --- | --- | --- |
| Base | `make up` | `make ps` | `make validate` |
| Stage 2 | `make stage2-up` | `make stage2-ps` | `make stage2-validate` |
| Stage 3 | `make stage3-up` | `make stage3-ps` | `make stage3-validate` |
| Stage 4 | `make stage4-up` | `make stage4-ps` | `make stage4-validate` |
| Stage 5 | `make stage5-up` | `make stage5-ps` | `make stage5-validate` |
| Stage 6 | `make stage6-up` | `make stage6-ps` | `make stage6-validate` |
| Stage 7 | `make stage7-up` | `make stage7-ps` | `make stage7-validate` |

## Operational Notes

- `stage7-core` starts all enterprise simulation services required by Stages 2-7.
- The enterprise gateway is recreated after stage startup so route inventory and upstream resolution match the active profile.
- Health checks are mandatory for all enterprise services.
- Compose remains the recommended local lab runtime even when Kubernetes artifacts are present.
