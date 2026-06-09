# Learning Tracks

Shield-PDP supports beginner-to-expert learning paths. Each track is designed for defensive learning in an isolated lab.

## Beginner Track

| Module | Outcome | Suggested Validation |
| --- | --- | --- |
| JWT basics | Understand token claims, expiry, and RBAC. | `make stage2-validate` |
| SSRF concepts | Understand internal service preview risk. | `make stage3-validate` |
| IDOR and BOLA | Compare vulnerable and secured object access. | `make validate` |
| Telemetry basics | Read structured logs and request IDs. | `/logs/events/summary` |

## Intermediate Track

| Module | Outcome | Suggested Validation |
| --- | --- | --- |
| CI/CD trust abuse | Understand pipeline token and artifact exposure. | `make stage3-validate` |
| Secrets exposure | Understand legacy secret policy simulation. | `make stage3-validate` |
| Token trust | Compare strict and legacy token handling. | `make stage4-validate` |
| Internal recon | Use service discovery and metadata telemetry defensively. | `make stage4-validate` |

## Advanced Track

| Module | Outcome | Suggested Validation |
| --- | --- | --- |
| Adversary campaigns | Run controlled campaign workflows. | `make stage5-validate` |
| Stealth simulation | Analyze low-noise and jitter events. | `make stage5-validate` |
| Replay forensics | Reconstruct attack timelines. | `make stage6-validate` |
| Hunt workflows | Execute hunt packs and workspace notes. | `make stage6-validate` |

## Expert Track

| Module | Outcome | Suggested Validation |
| --- | --- | --- |
| Distributed telemetry | Generate traces and evaluate telemetry SLA. | `make stage7-validate` |
| Governance simulation | Evaluate compliance, policy drift, secret lifecycle. | `make stage7-validate` |
| Chaos engineering | Simulate telemetry drop and recovery. | `make stage6-validate` |
| Attack graph intelligence | Analyze privilege paths and blast radius. | `make stage6-validate` |
| Zero-trust simulation | Evaluate service mesh policy and mTLS posture. | `make stage7-validate` |

## Instructor Notes

- Begin every class with safety scope.
- Use validators as grading checkpoints.
- Require students to include telemetry and detection evidence.
- Avoid asking students to invent real exploit payloads.
- End each module with remediation discussion.
