---
sprint: 1
feature: Session bootstrap
depends_on: []
status: agreed
scope:
  files_expected:
    - app/auth/session.py
    - tests/test_session.py
  files_may_touch: []
acceptance_criteria:
  - id: session_create
    description: Creates a session for a valid user
    verifier: pytest tests/test_session.py::test_create
sensors_required:
  - ruff
  - pytest
thresholds:
  coverage_delta: '>= 0'
negotiated_by:
  - architect
  - generator
  - evaluator
iterations: 1
---

# Sprint 1 — Session bootstrap

Groundwork for authentication: introduces a minimal session record and test.
