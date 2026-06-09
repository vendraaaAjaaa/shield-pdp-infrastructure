# Runbook: Stage Validation

## Purpose

Validate compatibility from the base lab through Stage 7.

## Command Sequence

```bash
make validate
make stage2-validate
make stage3-validate
make stage4-validate
make stage5-validate
make stage6-validate
make stage7-validate
```

## Pass Criteria

- Every command exits with status `0`.
- No validation reports `failed`.
- Stage 7 health target count is at least `38`.
- Detection coverage for Stage 5, Stage 6, and Stage 7 is at least `90%`.

## Failure Escalation

If a stage fails, rerun that stage after checking service health. Then rerun all later stages.
