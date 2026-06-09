# Runbook: Incident Replay

## Purpose

Reconstruct a simulated incident for SOC debrief or training evidence.

## Steps

1. Start full overlay: `make stage7-up`.
2. Run the relevant scenario or validator.
3. Query `/correlation/api/attack-paths`.
4. Select incident ID and principal.
5. Query `/correlation/api/timeline`.
6. Use Stage 6 or Stage 7 replay export.
7. Record replay/export ID.
8. Document detections and gaps.

## Success Criteria

- Timeline includes expected stage events.
- Detection rule IDs are present.
- Replay output is deterministic.
- Safety controls are included.
