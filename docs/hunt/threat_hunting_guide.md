# Threat Hunting Guide

Shield-PDP hunting workflows teach telemetry pivoting, anomaly analysis, ATT&CK-guided hunt packs, and replay-assisted investigation.

## Hunt Methodology

1. Define a hypothesis.
2. Select telemetry scope.
3. Query by indicator, behavior, identity, or timeline.
4. Pivot into attack graph and correlation.
5. Validate detections.
6. Write a hunt note.
7. Export replay evidence when useful.

## Hunt Types

| Hunt Type | Example Indicator |
| --- | --- |
| IOC hunt | Event name, replay ID, campaign ID. |
| Identity abuse hunt | `T1550.001`, service-account principals, stale token events. |
| Anomaly hunt | Off-hours digital twin activity, critical severity spikes. |
| Attack pattern hunt | MITRE technique or stage-specific event family. |
| Timeline hunt | Replay ID or campaign run ID. |

## Stage 6 Hunt Packs

| Hunt Pack | Focus |
| --- | --- |
| Identity abuse | Audience confusion, stale token, service-account misuse. |
| DevOps supply chain | CI token exposure, poisoned pipeline simulation, artifact leakage. |
| Low-noise operations | Jitter, delayed execution, route shaping. |
| Persistence simulation | Registration, cleanup, residual active records. |

## Stealth Activity Indicators

- Low-and-slow profile used.
- Off-hours digital twin activity.
- Delayed execution marker.
- Route rotation simulation.
- Telemetry drop or logging degradation chaos event.

## Replay-Assisted Hunting

Replay helps hunters compare:
- expected scenario order
- observed detection order
- missing telemetry
- principal drift
- service graph changes

## Hunt Note Template

| Field | Value |
| --- | --- |
| Hypothesis | What behavior is being tested? |
| Query | What route/query was used? |
| Matches | Count and representative events. |
| MITRE | Techniques observed. |
| Detection Coverage | Rules triggered and missing. |
| Replay Evidence | Replay/export/snapshot ID. |
| Recommendation | Tuning or mitigation. |
