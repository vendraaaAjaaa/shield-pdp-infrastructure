# JWT Audience Confusion

## Objective

Demonstrate why JWT issuer, audience, expiry, and role checks must be validated consistently across internal services.

## Prerequisites

- Stage 3 or later enterprise overlay.
- Developer or admin role.

## Lab Attack Path

1. Request a lab-controlled token with a mismatched audience from the identity service.
2. Submit it to the legacy audience-unaware internal API route.
3. Compare behavior against the strict validation route.
4. Review detection and correlation output.

## Expected Behavior

| Route | Expected Result |
| --- | --- |
| Legacy lab route | Accepts the delegated token for training purposes. |
| Strict route | Rejects the mismatched audience. |

## Telemetry Generated

- `lab.identity.audience_confusion_token_issued`
- `lab.legacy_audience_token_accepted`

## Detections Triggered

- `SHIELD-S4-JWT-AUD-001`

## ATT&CK Mapping

| Technique | Reason |
| --- | --- |
| `T1550.001` | Token abuse simulation. |
| `T1606` | Token forgery or trust confusion pattern. |

## Defensive Lessons

- Validate `iss`, `aud`, `nbf`, `exp`, and signature in every service.
- Avoid relying only on gateway headers for privileged downstream actions.
- Log token audience and route context for detection engineering.

## Cleanup

No persistent state is created. Run `make stage3-validate` or `make stage4-validate`.
