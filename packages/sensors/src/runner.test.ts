import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createAgentRegistry } from '@maestro/agents';
import { createEventBus } from '@maestro/core';
import type { MaestroConfig } from '@maestro/config';
import { composePolicy, type RunCommandResult } from '@maestro/sandbox';

import { runSensor, type AgentRunner, type ShellRunner } from './runner.js';

describe('runSensor', () => {
  it('maps computational failures to warned when onFail is warn', async () => {
    const shellRunner = vi.fn<ShellRunner>(
      async () =>
        ({
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
        }) satisfies RunCommandResult,
    );

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
    const shellRunner = vi.fn<ShellRunner>(async () => {
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
    const agentRunner = vi.fn(
      async (): Promise<{
        output: {
          verdict: 'request-changes';
          findings: Array<{
            path: string;
            line: number;
            message: string;
            severity: 'error';
          }>;
        };
        text: string;
        durationMs: number;
      }> => ({
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
      }),
    ) as AgentRunner;

    const result = await runSensor(
      {
        id: 'code-review',
        kind: 'inferential',
        agent: 'code-reviewer',
        criteria: [],
        timeoutSec: 60,
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

  it('maps non-timeout shell failures to error status', async () => {
    const shellRunner = vi.fn<ShellRunner>(async () => {
      throw new Error('spawn ENOENT');
    });

    const result = await runSensor(
      {
        id: 'missing-bin',
        kind: 'computational',
        command: 'nope',
        args: [],
        parseOutput: 'generic',
        expectExitCode: 0,
        timeoutSec: 5,
        onFail: 'block',
        appliesTo: [],
      },
      {
        runId: 'r-err',
        repoRoot: '/repo',
        bus: createEventBus(),
        policy: composePolicy({ mode: 'allowlist' }),
        shellRunner,
      },
    );

    expect(result.status).toBe('error');
    expect(result.stderr).toContain('ENOENT');
  });

  it('uses cwd when provided for computational sensors', async () => {
    const shellRunner = vi.fn<ShellRunner>(
      async ({ cwd }) =>
        ({
          exitCode: 0,
          stdout: cwd ?? '',
          stderr: '',
          durationMs: 1,
          decision: { kind: 'allow', reason: 'allowlist' },
          approvedBy: 'allowlist',
        }) satisfies RunCommandResult,
    );

    await runSensor(
      {
        id: 'scoped',
        kind: 'computational',
        command: 'pwd',
        args: [],
        cwd: 'packages/sensors',
        parseOutput: 'generic',
        expectExitCode: 0,
        timeoutSec: 5,
        onFail: 'block',
        appliesTo: [],
      },
      {
        runId: 'r-cwd',
        repoRoot: '/repo',
        bus: createEventBus(),
        policy: composePolicy({ mode: 'allowlist' }),
        shellRunner,
      },
    );

    expect(shellRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: expect.stringMatching(/packages[/\\]sensors$/u),
      }),
    );
  });

  it('marks inferential approve runs without findings as passed', async () => {
    const agentRunner = vi.fn(
      async (): Promise<{
        output: {
          violations: [];
          summary: string;
          pass: boolean;
        };
        text: string;
        durationMs: number;
      }> => ({
        output: {
          violations: [],
          summary: 'No issues.',
          pass: true,
        },
        text: '',
        durationMs: 4,
      }),
    ) as AgentRunner;

    const result = await runSensor(
      {
        id: 'clean-review',
        kind: 'inferential',
        agent: 'code-reviewer',
        criteria: [],
        timeoutSec: 60,
        onFail: 'block',
        appliesTo: [],
      },
      {
        runId: 'r-ok',
        repoRoot: '/repo',
        diff: '',
        bus: createEventBus(),
        agentRunner,
        config: {} as MaestroConfig,
      },
    );

    expect(result.status).toBe('passed');
    expect(result.violations).toEqual([]);
  });

  it('maps inferential agent runner failures to error status', async () => {
    const agentRunner = vi.fn(async () => {
      throw new Error('upstream unavailable');
    }) as AgentRunner;

    const result = await runSensor(
      {
        id: 'fragile',
        kind: 'inferential',
        agent: 'code-reviewer',
        criteria: [],
        timeoutSec: 60,
        onFail: 'block',
        appliesTo: [],
      },
      {
        runId: 'r-fail',
        repoRoot: '/repo',
        bus: createEventBus(),
        agentRunner,
      },
    );

    expect(result.status).toBe('error');
    expect(result.stderr).toContain('upstream unavailable');
  });

  it('resolves inferential agents from the registry when provided', async () => {
    const registry = createAgentRegistry();
    registry.register({
      id: 'registry-only',
      role: 'sensor',
      systemPrompt: 'test',
      inputSchema: z.object({ diff: z.string() }),
      outputSchema: z.object({
        verdict: z.enum(['approve', 'request-changes', 'comment']),
        findings: z.array(z.unknown()),
      }),
    });

    const agentRunner = vi.fn(
      async (): Promise<{
        output: { verdict: 'approve'; findings: [] };
        text: string;
        durationMs: number;
      }> => ({
        output: { verdict: 'approve', findings: [] },
        text: '',
        durationMs: 1,
      }),
    ) as AgentRunner;

    const result = await runSensor(
      {
        id: 'via-reg',
        kind: 'inferential',
        agent: 'registry-only',
        criteria: ['style'],
        timeoutSec: 30,
        onFail: 'block',
        appliesTo: [],
      },
      {
        runId: 'r-reg',
        repoRoot: '/repo',
        bus: createEventBus(),
        registry,
        agentRunner,
      },
    );

    expect(result.status).toBe('passed');
  });

  it('rejects unknown inferential agents before execution', async () => {
    await expect(
      runSensor(
        {
          id: 'bad-agent',
          kind: 'inferential',
          agent: 'no-such-agent',
          criteria: [],
          timeoutSec: 60,
          onFail: 'block',
          appliesTo: [],
        },
        {
          runId: 'r-x',
          repoRoot: '/repo',
          bus: createEventBus(),
        },
      ),
    ).rejects.toThrow(/Unknown inferential sensor agent/iu);
  });

  it('maps DSFT-95 code-review output with SQL error to failed when onFail is block', async () => {
    const agentRunner = vi.fn(
      async (): Promise<{
        output: {
          violations: Array<{
            severity: 'error';
            category: 'security';
            file: string;
            line: number;
            message: string;
            suggestion: string;
          }>;
          summary: string;
          pass: boolean;
        };
        text: string;
        durationMs: number;
      }> => ({
        output: {
          violations: [
            {
              severity: 'error',
              category: 'security',
              file: 'api.py',
              line: 2,
              message: 'SQL injection risk',
              suggestion: 'Use parameters',
            },
          ],
          summary: 'Security issue',
          pass: false,
        },
        text: '',
        durationMs: 2,
      }),
    ) as AgentRunner;

    const result = await runSensor(
      {
        id: 'code-review',
        kind: 'inferential',
        agent: 'code-reviewer',
        criteria: [],
        timeoutSec: 60,
        onFail: 'block',
        appliesTo: [],
      },
      {
        runId: 'r-sql',
        repoRoot: '/repo',
        diff: 'diff --git a/api.py b/api.py',
        bus: createEventBus(),
        agentRunner,
        config: {} as MaestroConfig,
      },
    );

    expect(result.status).toBe('failed');
    expect(result.violations[0]?.severity).toBe('error');
    expect(result.violations[0]?.path).toBe('api.py');
  });

  it('maps pristine DSFT-95 output to passed', async () => {
    const agentRunner = vi.fn(
      async (): Promise<{
        output: {
          violations: [];
          summary: string;
          pass: boolean;
        };
        text: string;
        durationMs: number;
      }> => ({
        output: {
          violations: [],
          summary: 'LGTM',
          pass: true,
        },
        text: '',
        durationMs: 1,
      }),
    ) as AgentRunner;

    const result = await runSensor(
      {
        id: 'code-review',
        kind: 'inferential',
        agent: 'code-reviewer',
        criteria: [],
        timeoutSec: 60,
        onFail: 'warn',
        appliesTo: [],
      },
      {
        runId: 'r-clean',
        repoRoot: '/repo',
        diff: '+ok',
        bus: createEventBus(),
        agentRunner,
        config: {} as MaestroConfig,
      },
    );

    expect(result.status).toBe('passed');
    expect(result.violations).toHaveLength(0);
  });
});
