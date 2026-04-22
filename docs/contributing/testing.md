# Testing Strategy

DSFT-97 closes the Maestro testing strategy as four coordinated layers. Each
layer has a narrow job and should stay deterministic by default.

## Layer 1: unit

Run:

```sh
pnpm test:unit
pnpm test:coverage
```

Unit tests live next to package source files. They cover deterministic behavior:
pipeline transitions, config parsing, contract rendering, sensors, git fixtures,
KB lint/init, providers, CLI commands, and TUI state/components.

Coverage is enforced at 85% lines/statements/functions and 80% branches. Runtime
or interactive adapters that are tested through integration or eval layers can be
excluded in the package Vitest config, but the deterministic core should remain
inside the gate.

## Layer 2: mock integration

Run:

```sh
pnpm test:integration
```

Integration tests use committed fixtures from `tests/fixtures/runs/` plus
helpers from `@maestro/testkit`. They exercise end-to-end orchestration with
mocked LLM behavior, including happy path, evaluator rejection loops,
compaction/context triggers, sensor timeout, permission denial, and resume after
pause.

## Layer 3: VCR replay

Run:

```sh
pnpm test:replay
pnpm test:record
```

Replay is mandatory in CI. Cassettes live in `tests/fixtures/cassettes/` as
versioned JSON and must be deterministic without network access.

Recording is manual only. Use small artificial prompts and inspect the cassette
before committing it. Do not commit API keys, bearer tokens, private keys, or
customer/user data. The VCR helper rejects obvious secrets, but humans are still
responsible for reviewing cassette contents.

## Layer 4: evals

Run:

```sh
pnpm test:evals
```

Eval fixtures for the code-reviewer live in `tests/evals/code-reviewer/`.
Positive examples should be actionable findings; negative examples should be
clean or non-actionable changes. The harness reports precision, recall, false
positives, false negatives, and F1, then fails below the configured threshold.

## Prompt snapshots

Run:

```sh
pnpm prompts:check
pnpm prompts:update
```

Prompt snapshots are reviewed separately from unit coverage so intentional prompt
changes are visible. Use `prompts:update` only when the prompt change is expected
and has been reviewed.

## CI jobs

The main CI workflow runs lint, typecheck, unit tests, mock integration, prompt
snapshots, coverage, and build as separate jobs. Coverage reports are uploaded as
artifacts. The replay workflow runs `pnpm test:replay` directly instead of
skipping when fixtures are present.
