---
'@maestro/core': minor
'@maestro/pipeline': minor
---

Add `@maestro/pipeline` package: orchestrates Planner → Architect → Contracting → Generator → Evaluator (with retry budget and escalation) → Merger, persists run state after every phase via `@maestro/state`, writes contract drafts and sprint handoff artifacts, and emits the new `PipelineEvent` union added to `@maestro/core` (`pipeline.started | stage_entered | sprint_started | sprint_retried | sprint_escalated | paused | resumed | completed | failed`). Graceful pause honours an `AbortSignal` and stops at the next phase boundary; `resumePipeline()` reloads the last run and continues. CLI `maestro resume` and git-divergence detection remain deferred (need `maestro run` and DSFT-84 respectively).
