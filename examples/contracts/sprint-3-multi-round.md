---
sprint: 3
feature: Password reset flow
depends_on:
  - 2
status: agreed
scope:
  files_expected:
    - app/auth/reset.py
    - app/mail/reset_email.py
    - tests/test_reset.py
  files_may_touch:
    - app/auth/session.py
acceptance_criteria:
  - id: reset_request
    description: Authenticated user can request a reset email
    verifier: pytest tests/test_reset.py::test_request
  - id: reset_token_expiry
    description: Reset tokens expire after 30 minutes
    verifier: pytest tests/test_reset.py::test_expiry
  - id: reset_rate_limit
    description: Endpoint rate-limits per email to 3/hour
    verifier: pytest tests/test_reset.py::test_rate_limit
sensors_required:
  - ruff
  - mypy
  - pytest
thresholds:
  coverage_delta: '>= 0'
  type_errors_new: '== 0'
  arch_violations: '== 0'
negotiated_by:
  - architect
  - generator
  - evaluator
  - human
iterations: 3
---

# Sprint 3 — Password reset

## Round log

- Round 1: Architect proposed scope; Generator flagged mail layer missing.
- Round 2: Evaluator added rate-limit acceptance; Generator converged.
- Round 3: Human edited to require a second approver on pricing changes.
