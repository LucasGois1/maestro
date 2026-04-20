import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from '@maestro/core';
import { composePolicy, type RunCommandResult } from '@maestro/sandbox';

import { runSensor } from './runner.js';

describe('runSensor', () => {
  it('maps computational failures to warned when onFail is warn', async () => {
    const shellRunner = vi.fn<
      (typeof runSensor extends never ? never : never),
      []
    >();
    shellRunner.mockResolvedValue({
      exitCode: 1,
      stdout: JSON.stringify([
        {
          code: 'F401',
          message: 'unused import',
          filename: 'app.py',
          location: { row: 2, column: 1 },
        },
      ]),
      stderr: '',
      durationMs: 25,
      decision: { kind: 'allow', reason: 'allowlist' },
      approvedBy: 'allowlist',
    } satisfies RunCommandResult);

    const result = await runSensor(
      {
        id: 'ruff',
        kind: 'computational',
        command: 'ruff check .',
        args: [],
        parseOutput: 'ruff-json',
        expectExitCode: 0,
        timeoutSec: 30,
        onFail: 'warn',
        appliesTo: [],
      },
      {
        runId: 'r1',
        repoRoot: '/repo',
        bus: createEventBus(),
        policy: composePolicy({ mode: 'allowlist' }),
        shellRunner,
      },
    );

    expect(result.status).toBe('warned');
    expect(result.violations).toHaveLength(1);
  });

  it('marks timed out sensors explicitly', async () => {
    const shellRunner = vi.fn(async () => {
      throw {
        name: 'CommandTimedOutError',
        message: 'pytest --slow timed out after 1000ms.',
        commandLine: 'pytest --slow',
        timeoutMs: 1000,
        stdout: '',
        stderr: '',
      };
    });

    const result = await runSensor(
      {
        id: 'pytest',
        kind: 'computational',
        command: 'pytest --slow',
        args: [],
        parseOutput: 'generic',
        expectExitCode: 0,
        timeoutSec: 1,
        onFail: 'block',
        appliesTo: [],
      },
      {
        runId: 'r2',
        repoRoot: '/repo',
        bus: createEventBus(),
        policy: composePolicy({ mode: 'allowlist' }),
        shellRunner,
      },
    );

    expect(result.status).toBe('timeout');
    expect(result.durationMs).toBe(1000);
  });

  it('maps code-review findings into normalized violations', async () => {
    const agentRunner = vi.fn(async () => ({
      output: {
        verdict: 'request-changes' as const,
        findings: [
          {
            path: 'packages/sensors/src/index.ts',
            line: 12,
            message: 'Needs a stronger type',
            severity: 'error' as const,
          },
        ],
      },
      text: '',
      durationMs: 32,
    }));

    const result = await runSensor(
      {
        id: 'code-review',
        kind: 'inferential',
        agent: 'code-reviewer',
        onFail: 'warn',
        appliesTo: [],
      },
      {
        runId: 'r3',
        repoRoot: '/repo',
        diff: 'diff --git a/file.ts b/file.ts',
        bus: createEventBus(),
        agentRunner,
      },
    );

    expect(result.status).toBe('warned');
    expect(result.violations).toEqual([
      expect.objectContaining({
        path: 'packages/sensors/src/index.ts',
        line: 12,
        severity: 'error',
      }),
    ]);
  });
});
