---
'@maestro/core': minor
'@maestro/agents': minor
---

Add agent framework: `AgentDefinition` interface, `createAgentRegistry` with pipeline-stage validation and override-by-id, `runAgent` runner that validates input/output via Zod and streams deltas through a typed `EventBus`, and `loadCustomAgents` for dynamic import of user-authored agents from `.maestro/agents/`. Includes stubs for the seven built-in agents (planner, architect, generator, evaluator, merger, code-reviewer, doc-gardener) and a `secret-auditor` custom-agent example in `examples/`.
