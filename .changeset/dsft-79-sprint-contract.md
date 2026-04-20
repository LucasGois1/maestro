---
'@maestro/contract': minor
---

Add `@maestro/contract` package: Zod schema for Sprint Contract frontmatter (sprint, feature, depends_on, status, scope, acceptance_criteria, sensors_required, thresholds, negotiated_by, iterations), parser/writer that preserves the free-form markdown body, a 3-round negotiation protocol (`negotiateSprintContract`) that orchestrates architect/generator/evaluator proposers and emits `agent.decision` events, `editSprintContract` which spawns `$EDITOR` and appends `human` to `negotiated_by`, and three fixtures in `examples/contracts/` (simple, with-deps, multi-round).
