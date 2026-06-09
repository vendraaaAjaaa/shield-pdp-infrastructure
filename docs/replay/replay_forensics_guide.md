# Replay And Forensic Reconstruction Guide

Replay is the mechanism that turns simulation telemetry into teachable incident evidence.

## Replay Sources

| Source | Route | Use |
| --- | --- | --- |
| Stage 4 SOC replay | `/purple/api/replay/stage3-attack-chain` | Recreate identity-to-secrets chain. |
| Stage 5 adversary replay | `/ops/api/replay/adversary-timeline` | Recreate beacon/pivot/persistence timeline. |
| Stage 6 time travel | `/intelligence/api/time-travel/reconstruct` | Reconstruct attack graph and detection flow. |
| Stage 7 replay export | `/scale/api/replay/export` | Export enterprise-scale state, governance, traces, failover, approvals. |

## Replay Integrity Requirements

- deterministic output
- event ordering preserved
- request IDs preserved
- rule IDs preserved
- synthetic safety controls included
- no external dependencies

## Forensic Reconstruction Workflow

1. Select replay or campaign ID.
2. Fetch timeline from correlation.
3. Generate reconstruction.
4. Compare detection flow with expected rules.
5. Review graph or infrastructure state.
6. Export replay evidence for debrief.

## Evidence Package

An exercise evidence package should include:
- replay export ID
- timeline event count
- detection rule list
- incident IDs
- principal summary
- attack graph or topology summary
- mitigation notes
