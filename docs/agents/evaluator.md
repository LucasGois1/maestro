# Evaluator (QA) — DSFT-93

The **Evaluator** is stage 4 of the pipeline. It checks the sprint contract, the generator JSON output, and the working tree diff, optionally using tools. It returns a **ternary decision**: `passed`, `failed`, or `escalated`.

## Inputs (pipeline)

- `runId`, `sprintIdx` (1-based, matches planner sprint `idx`), `repoRoot`, `worktreeRoot`, `iteration` (retry attempt, 1-based)
- `sprintContract` (markdown string), `generatorOutput` (last generator JSON), `codeDiff` (`git diff` in the worktree, possibly truncated)
- `sprint`, `acceptance` (acceptance lines from the plan)

## Outputs

- `decision`: `passed` | `failed` | `escalated`
- `structuredFeedback`: markdown (summary, criteria, evidence)
- `suggestedActions`: short strings fed back to the generator on `failed`
- `coverage` (optional 0–1), `sensorsRun`, `artifacts`

## Tools

| Tool              | Role                                                              |
| ----------------- | ----------------------------------------------------------------- |
| `readFile`        | Read text under **worktree** root                                 |
| `runShell`        | Shell with cwd = worktree; sandbox policy applies                 |
| `runSensor`       | Registered sensors from `.maestro/sensors.json`                   |
| `navigateBrowser` | **v0.1:** HTTP GET snapshot of a public URL (not Chrome DevTools) |
| `querySqlite`     | Read-only `SELECT` via `sqlite3` CLI if installed                 |
| `callApi`         | HTTP to allowed hosts; localhost / private ranges blocked         |

## Files written

Each evaluation run writes:

`<repo>/.maestro/runs/<runId>/feedback/sprint-<sprint>-eval-<iteration>.md`

Frontmatter includes `decision`, `runId`, `sprint`, `iteration`; body is `structuredFeedback`.

## Pipeline behaviour

- `passed` → continue to the next sprint or merger.
- `failed` → retry generator with enriched `evaluatorFeedback` (failures, structured feedback, suggested actions) until retries are exhausted.
- `escalated` → pipeline pauses immediately (human / environment blocker).

## Limitations

- **navigateBrowser** does not drive a real browser; it fetches HTTP(s) content only.
- **querySqlite** requires the `sqlite3` binary in `PATH`.
