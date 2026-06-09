# Shield-PDP Stage 6 - Detection Gap Analysis

The coverage intelligence service analyzes ATT&CK coverage, service visibility, and telemetry blindspots.

## Service

| Service | Route | Purpose |
| --- | --- | --- |
| `coverage-intel` | `/coverage/` | ATT&CK heatmap, coverage matrix, blindspot analysis, visibility score, and executive report |

## Endpoints

- `/api/attack-heatmap`
- `/api/matrix`
- `/api/blindspots`
- `/api/visibility-score`
- `/api/executive-report`

## Scoring

Visibility score is based on monitored service targets with recent telemetry. Blindspots are services present in the overlay target list but absent from the recent telemetry window.

## Telemetry

- `stage6.coverage.analysis_generated`
- `stage6.coverage.blindspot_identified`
