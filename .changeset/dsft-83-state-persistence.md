---
'@maestro/state': minor
'@maestro/cli': minor
---

Add `@maestro/state` package: Zod-validated `RunState`, atomic writes via tmp-file + rename, `StateStore` (`create / load / update / list / latest / delete`), sprint handoff artifact writer (`.maestro/runs/<id>/checkpoints/sprint-N-handoff.md`), and a project-level append-only log at `.maestro/log.md`. Adds `maestro runs list | show | clean` CLI subcommands. `maestro resume` and git-divergence detection are deferred until the Pipeline Engine and Git Integration epics land.
