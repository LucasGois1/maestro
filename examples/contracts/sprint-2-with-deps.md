---
sprint: 2
feature: JWT service + key management
depends_on:
  - 1
status: agreed
scope:
  files_expected:
    - app/auth/jwt.py
    - app/auth/keys.py
    - tests/test_jwt.py
  files_may_touch:
    - app/config.py
acceptance_criteria:
  - id: jwt_sign
    description: JWT service signs tokens with a configurable TTL
    verifier: pytest tests/test_jwt.py::test_sign
  - id: jwt_verify_expired
    description: Service rejects expired tokens with a clear error
    verifier: pytest tests/test_jwt.py::test_expired
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
iterations: 1
---

# Sprint 2 — JWT service

## Decisions

- Architect proposed separating signing and verification; Generator agreed.
- Evaluator required an explicit acceptance criterion for expired tokens.
