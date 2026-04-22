import { describe, expect, it, vi } from 'vitest';

import { createAgentRegistry } from '@maestro/agents';
import type { MaestroConfig } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import { composePolicy } from '@maestro/sandbox';

import { dispatchSensors } from './dispatcher.js';
import type { AgentRunner } from './runner.js';

describe('dispatchSensors', () => {
  it('runs block sensors before warn sensors when concurrency is one', async () => {
    const order: string[] = [];

    const results = await dispatchSensors(
      [
        {
          id: 'warn-review',
          kind: 'computational',
          command: 'warn-review',
          args: [],
          parseOutput: 'generic',
          expectExitCode: 0,
          timeoutSec: 30,
          onFail: 'warn',
          appliesTo: [],
        },
        {
          id: 'block-test',
          kind: 'computational',
          command: 'block-test',
          args: [],
          parseOutput: 'generic',
          expectExitCode: 0,
          timeoutSec: 30,
          onFail: 'block',
          appliesTo: [],
        },
      ],
      {
        runId: 'r1',
        repoRoot: '/repo',
        concurrency: 1,
        bus: createEventBus(),
        policy: composePolicy({ mode: 'allowlist' }),
        shellRunner: async ({ cmd }) => {
          order.push(cmd);
          return {
            exitCode: 0,
            stdout: '',
            stderr: '',
            durationMs: 5,
            decision: { kind: 'allow', reason: 'allowlist' },
            approvedBy: 'allowlist',
          };
        },
      },
    );

    expect(order).toEqual(['block-test', 'warn-review']);
    expect(results.map((result) => result.status)).toEqual([
      'passed',
      'passed',
    ]);
  });

  it('respects the configured concurrency limit', async () => {
    let active = 0;
    let peak = 0;

    await dispatchSensors(
      [
        {
          id: 'a',
          kind: 'computational',
          command: 'a',
          args: [],
          parseOutput: 'generic',
          expectExitCode: 0,
          timeoutSec: 30,
          onFail: 'block',
          appliesTo: [],
        },
        {
          id: 'b',
          kind: 'computational',
          command: 'b',
          args: [],
          parseOutput: 'generic',
          expectExitCode: 0,
          timeoutSec: 30,
          onFail: 'block',
          appliesTo: [],
        },
        {
          id: 'c',
          kind: 'computational',
          command: 'c',
          args: [],
          parseOutput: 'generic',
          expectExitCode: 0,
          timeoutSec: 30,
          onFail: 'block',
          appliesTo: [],
        },
      ],
      {
        runId: 'r2',
        repoRoot: '/repo',
        concurrency: 2,
        bus: createEventBus(),
        policy: composePolicy({ mode: 'allowlist' }),
        shellRunner: async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 15));
          active -= 1;
          return {
            exitCode: 0,
            stdout: '',
            stderr: '',
            durationMs: 15,
            decision: { kind: 'allow', reason: 'allowlist' },
            approvedBy: 'allowlist',
          };
        },
      },
    );

    expect(peak).toBe(2);
  });

  it('skips sensors that do not match the changed files and emits sensor events', async () => {
    const bus = createEventBus();
    const events: string[] = [];
    bus.on((event) => events.push(event.type));

    const results = await dispatchSensors(
      [
        {
          id: 'frontend',
          kind: 'computational',
          command: 'frontend',
          args: [],
          parseOutput: 'generic',
          expectExitCode: 0,
          timeoutSec: 30,
          onFail: 'block',
          appliesTo: ['packages/tui/**'],
        },
        {
          id: 'backend',
          kind: 'computational',
          command: 'backend',
          args: [],
          parseOutput: 'generic',
          expectExitCode: 0,
          timeoutSec: 30,
          onFail: 'block',
          appliesTo: ['packages/sensors/**'],
        },
      ],
      {
        runId: 'r3',
        repoRoot: '/repo',
        concurrency: 4,
        changedFiles: ['packages/sensors/src/index.ts'],
        bus,
        policy: composePolicy({ mode: 'allowlist' }),
        shellRunner: async () => ({
          exitCode: 0,
          stdout: '',
          stderr: '',
          durationMs: 5,
          decision: { kind: 'allow', reason: 'allowlist' },
          approvedBy: 'allowlist',
        }),
      },
    );

    expect(results).toEqual([
      expect.objectContaining({ sensorId: 'backend', status: 'passed' }),
      expect.objectContaining({ sensorId: 'frontend', status: 'skipped' }),
    ]);
    expect(events).toContain('sensor.started');
    expect(events).toContain('sensor.completed');
  });

  it('forwards optional run context fields to inferential sensors', async () => {
    const approver = vi.fn();
    const agentRunner = vi.fn(
      async (): Promise<{
        output: { verdict: 'approve'; findings: [] };
        text: string;
        durationMs: number;
      }> => ({
        output: { verdict: 'approve', findings: [] },
        text: '',
        durationMs: 2,
      }),
    ) as AgentRunner;

    const results = await dispatchSensors(
      [
        {
          id: 'review',
          kind: 'inferential',
          agent: 'code-reviewer',
          criteria: [],
          timeoutSec: 60,
          onFail: 'block',
          appliesTo: [],
        },
      ],
      {
        runId: 'r-opt',
        repoRoot: '/repo',
        bus: createEventBus(),
        concurrency: 1,
        maestroDir: '/maestro',
        diff: 'diff --git a/x b/x',
        policy: composePolicy({ mode: 'allowlist' }),
        approver,
        agentRunner,
        registry: createAgentRegistry(),
        config: {} as MaestroConfig,
      },
    );

    expect(results[0]?.status).toBe('passed');
    expect(agentRunner).toHaveBeenCalled();
  });
});
