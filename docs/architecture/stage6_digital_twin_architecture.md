# Shield-PDP Stage 6 - Digital Twin Architecture

Stage 6 adds a synthetic enterprise digital twin that generates realistic background telemetry without touching real users, systems, or external infrastructure.

## Service

| Service | Route | Purpose |
| --- | --- | --- |
| `digital-twin` | `/digital-twin/` | Generates employee, developer, CI/CD, HR, finance, chat, ticket, cron, and service-communication telemetry |

## Activity Profiles

- `jakarta-business-day`
- `engineering-release-window`
- `finance-close`
- `off-hours-anomaly`

Each profile is timezone aware and emits `synthetic_background_activity=true`.

## Safety

All activity is generated as synthetic telemetry only. No real login, commit, CI run, message, ticket, HR action, finance action, or service call is performed.

## Telemetry

Primary events:

- `digital_twin.employee_login`
- `digital_twin.developer_commit`
- `digital_twin.cicd_pipeline_run`
- `digital_twin.cron_activity`
- `digital_twin.hr_workflow`
- `digital_twin.finance_workflow`
- `digital_twin.internal_chat_message`
- `digital_twin.ticket_activity`
- `digital_twin.service_communication`
- `digital_twin.off_hours_activity`
