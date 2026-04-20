---
'@maestro/sandbox': minor
'@maestro/cli': minor
---

Add `@maestro/sandbox` package with the v0.1 permission model: a shell-style glob matcher (supports `*`, `?`, and multi-segment `|` patterns for piped commands), `composePolicy`/`checkCommand` that honour `strict`/`allowlist`/`yolo` modes while always enforcing the denylist, a `runShellCommand` runner that never uses `shell: true` and appends every invocation to `.maestro/runs/<id>/audit.jsonl`, and an `ApprovalPrompter` interface so the TUI can inject modal approvals later. Default allowlist covers common dev commands (pytest, go test, ruff, eslint, git status/diff, etc.) and the denylist blocks `rm -rf /`, `sudo`, `curl | sh`, `chmod 777`, `git push -f`, and fork bombs. Adds `maestro abort [runId]` CLI subcommand which marks the target run as `canceled` and logs a `run.aborted` entry to `.maestro/log.md`.
