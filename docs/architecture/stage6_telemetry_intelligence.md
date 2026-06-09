# Shield-PDP Stage 6 - Telemetry Intelligence

Stage 6 uses the Stage 4 centralized log collector and detection pipeline as the source of truth for intelligence workflows.

## Intelligence Sources

- synthetic digital twin activity
- Stage 3 vulnerable enterprise path telemetry
- Stage 4 detections and correlation
- Stage 5 adversary operation telemetry
- Stage 6 graph, hunt, coverage, chaos, and replay telemetry

## Common Fields

- `event_id`
- `request_id`
- `principal`
- `lab_stage`
- `safe_simulation`
- `simulation_scope`
- `synthetic_background_activity`
- `campaign_run_id`
- `replay_id`

## Defensive Analysis

`/intelligence/api/analysis/incident-summary` produces explainable defensive summaries only. It does not generate exploit steps, payloads, or offensive automation.
