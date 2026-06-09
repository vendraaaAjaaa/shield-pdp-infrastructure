# Shield-PDP Stage 6 - Time-Travel Replay and Forensic Reconstruction

Stage 6 extends replay into deterministic forensic reconstruction.

## Service

| Service | Route | Purpose |
| --- | --- | --- |
| `intelligence-dashboard` | `/intelligence/` | Role dashboards, defensive summaries, executive reporting, and time-travel reconstruction |

## Reconstruction Output

- infrastructure state
- attack timeline
- detection flow
- graph state summary
- deterministic snapshot metadata

## Endpoint

```text
POST /intelligence/api/time-travel/reconstruct
```

## Event

- `stage6.replay.reconstruction_completed`

The reconstruction reads telemetry and generates a snapshot. It does not replay destructive actions.
