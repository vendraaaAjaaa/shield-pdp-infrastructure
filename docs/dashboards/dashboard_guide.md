# Dashboard Guide

Shield-PDP dashboards are role-oriented views over the same telemetry and simulation state.

## Dashboard Inventory

| Dashboard | Route | Audience | Purpose |
| --- | --- | --- | --- |
| Base SOC dashboard | `http://localhost:3000` | API lab users | Base API health and secure control evidence. |
| SOC dashboard | `/purple/` | SOC analysts | Incidents, triage, replay. |
| Adversary operations | `/ops/` | Red team operators | Campaigns, sessions, replay catalog. |
| Intelligence dashboard | `/intelligence/` | SOC, hunters, executives | Attack graph, coverage, summary, replay. |
| Scale dashboard | `/scale/` | Platform, executives | Cluster health, governance score, telemetry SLA, resilience posture. |

## Dashboard Review Flow

1. Confirm route access with appropriate role.
2. Review widgets and endpoint inventory.
3. Generate or validate scenario telemetry.
4. Cross-check with detection alerts.
5. Export or record replay IDs for debrief.

## Executive View Notes

Executive views intentionally summarize:
- attack impact score
- blast radius
- coverage score
- telemetry SLA
- governance score
- incident timeline summary

They should be used for tabletop discussion, not as a replacement for analyst triage.
