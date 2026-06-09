# Shield-PDP Stage 5 - MITRE ATT&CK Mapping

Stage 5 maps safe simulation events to ATT&CK techniques for detection engineering and purple-team validation.

| Event | Tactics | Techniques | Notes |
| --- | --- | --- | --- |
| `adversary.operation.started` | Resource Development, Execution | campaign dependent | Operation start marker for timeline reconstruction |
| `adversary.operation.step` | campaign dependent | campaign dependent | Per-stage chain marker with service and sequence metadata |
| `adversary.operation.completed` | Discovery, Credential Access, Lateral Movement, Collection | T1550.001, T1078, T1590, T1552, T1119 | Campaign completion and incident trigger |
| `adversary.opsec.low_noise_profile_used` | Defense Evasion, Command and Control | T1029, T1071.001 | Low-noise timing profile marker |
| `adversary.beacon.session_started` | Command and Control | T1071.001, T1105 | Simulated session state only |
| `adversary.beacon.heartbeat` | Command and Control | T1071.001 | Callback interval, jitter, and sleep profile telemetry |
| `adversary.beacon.task_polled` | Execution, Discovery, Credential Access | T1059, T1590, T1552 | Allowlisted synthetic task polling |
| `adversary.beacon.task_result` | Execution, Discovery, Credential Access | T1059, T1590, T1552 | Synthetic result only; no command execution |
| `adversary.redirector.route_selected` | Command and Control | T1090, T1071.001 | Controlled route-chain selection |
| `adversary.redirector.traffic_shaped` | Defense Evasion, Command and Control | T1090, T1029, T1071.001 | Traffic profile and gateway trace preservation |
| `adversary.pivot.simulated` | Lateral Movement, Privilege Escalation | T1021, T1078, T1550.001 | Trust-boundary path model |
| `adversary.lateral_movement.simulated` | Lateral Movement | T1021, T1078 | No exploit execution |
| `adversary.persistence.registered` | Persistence, Privilege Escalation | T1053.005, T1547, T1543, T1550.001 | In-memory reversible record only |
| `adversary.persistence.cleaned` | Defensive Response | none | Cleanup verification marker |
| `adversary.replay.started` | Discovery, Lateral Movement, Persistence | T1071.001, T1021, T1053.005 | SOC replay marker |

## Coverage Areas

- Initial Access: represented by campaign start and Stage 3 inherited attack paths.
- Execution: represented by synthetic beacon task results only.
- Discovery: service catalog, identity, DNS, metadata, and internal route simulation.
- Credential Access: token, secret broker, and CI credential misuse simulation.
- Privilege Escalation: delegated-token and service-account trust paths.
- Defense Evasion: OPSEC timing, jitter, and low-noise profile markers.
- Lateral Movement: pivot path simulation across enterprise zones.
- Collection: controlled campaign markers and artifact/secret metadata references.
