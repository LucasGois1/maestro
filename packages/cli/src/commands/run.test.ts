import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigValidationError, configSchema } from '@maestro/config';
import { createStateStore, type StateStore } from '@maestro/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRunCommand } from './run.js';

let repoRoot: string;
let store: StateStore;
let stdout: string[];
let stderr: string[];

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-cli-run-'));
  store = createStateStore({ repoRoot });
  stdout = [];
  stderr = [];
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
  process.exitCode = undefined;
});

async function parseRun(args: string[], overrides = {}) {
  const command = createRunCommand({
    io: {
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    },
    cwd: () => repoRoot,
    loadConfig: async () => ({ resolved: configSchema.parse({}) }),
    store,
    randomUuid: () => 'run-1',
    createWorktree: vi.fn(async () => ({
      path: join(repoRoot, '..', 'worktree-run-1'),
      branch: 'maestro/feat-ship-auth',
    })),
    runPipeline: vi.fn(async (options) => ({
      state: await options.store.create({
        runId: options.runId,
        branch: options.branch,
        worktreePath: options.worktreePath,
        prompt: options.prompt,
        userAgent: 'test',
        providerDefaults: {},
      }),
      plan: { feature: 'Auth', summary: 'Ship auth', sprints: [] },
      sprintOutcomes: [],
      merger: {
        runStatus: 'completed',
        branch: options.branch,
        commitCount: 1,
        execPlanPath: '.maestro/docs/exec-plans/completed/auth.md',
        cleanupDone: false,
      },
    })),
    renderApp: vi.fn(() => ({ unmount: vi.fn() })),
    stdoutIsTTY: false,
    ...overrides,
  });
  await command.parseAsync(args, { from: 'user' });
  return command;
}

describe('maestro run', () => {
  it('creates a worktree, computes a branch, and runs the pipeline', async () => {
    const createWorktree = vi.fn(async () => ({
      path: join(repoRoot, '..', 'worktree-run-1'),
      branch: 'maestro/feat-ship-auth',
    }));
    const runPipeline = vi.fn(async (options) => ({
      state: await options.store.create({
        runId: options.runId,
        branch: options.branch,
        worktreePath: options.worktreePath,
        prompt: options.prompt,
        userAgent: 'test',
        providerDefaults: {},
      }),
      plan: { feature: 'Auth', summary: 'Ship auth', sprints: [] },
      sprintOutcomes: [],
      merger: {
        runStatus: 'completed',
        branch: options.branch,
        commitCount: 1,
        execPlanPath: '.maestro/docs/exec-plans/completed/auth.md',
        cleanupDone: false,
      },
    }));

    await parseRun(['ship', 'auth'], { createWorktree, runPipeline });

    expect(createWorktree).toHaveBeenCalledWith(
      expect.objectContaining({
        repoRoot,
        runId: 'run-1',
        branch: 'maestro/feat-ship-auth',
      }),
    );
    expect(runPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        prompt: 'ship auth',
        branch: 'maestro/feat-ship-auth',
        repoRoot,
      }),
    );
    expect(stdout.join('\n')).toContain('Run completed: run-1');
  });

  it('uses cwd as the worktree when --no-worktree is passed', async () => {
    const createWorktree = vi.fn();
    const runPipeline = vi.fn(async (options) => ({
      state: await options.store.create({
        runId: options.runId,
        branch: options.branch,
        worktreePath: options.worktreePath,
        prompt: options.prompt,
        userAgent: 'test',
        providerDefaults: {},
      }),
      plan: { feature: 'Auth', summary: 'Ship auth', sprints: [] },
      sprintOutcomes: [],
      merger: {
        runStatus: 'completed',
        branch: options.branch,
        commitCount: 0,
        execPlanPath: '.maestro/docs/exec-plans/completed/auth.md',
        cleanupDone: false,
      },
    }));

    await parseRun(['--no-worktree', 'ship', 'auth'], {
      createWorktree,
      runPipeline,
    });

    expect(createWorktree).not.toHaveBeenCalled();
    expect(runPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: repoRoot }),
    );
  });

  it('blocks a new run when another pipeline run is active', async () => {
    await store.create({
      runId: 'active',
      branch: 'maestro/active',
      worktreePath: repoRoot,
      prompt: 'active run',
      userAgent: 'test',
      providerDefaults: {},
    });
    const runPipeline = vi.fn();

    await parseRun(['ship', 'auth'], { runPipeline });

    expect(runPipeline).not.toHaveBeenCalled();
    expect(stderr.join('\n')).toContain('A Maestro pipeline run is active');
    expect(process.exitCode).toBe(2);
    process.exitCode = undefined;
  });

  it('renders the TUI instead of textual progress in TTY mode', async () => {
    const unmount = vi.fn();
    const renderApp = vi.fn(() => ({ unmount }));

    await parseRun(['--no-worktree', 'ship', 'auth'], {
      renderApp,
      stdoutIsTTY: true,
    });

    expect(renderApp).toHaveBeenCalledWith(
      expect.objectContaining({
        bus: expect.any(Object),
        commandExecutor: expect.any(Function),
        store: expect.any(Object),
      }),
    );
    expect(stdout.join('\n')).not.toContain('Run started');
    expect(stdout.join('\n')).not.toContain('Run completed');
    expect(unmount).toHaveBeenCalledOnce();
  });

  it('returns exit code 1 when config validation fails', async () => {
    await parseRun(['ship', 'auth'], {
      loadConfig: async () => {
        throw new ConfigValidationError('invalid config', [
          {
            code: 'custom',
            path: ['permissions', 'mode'],
            message: 'Invalid permissions mode',
            input: 'chaotic',
          },
        ]);
      },
    });

    expect(process.exitCode).toBe(1);
    expect(stderr.join('\n')).toContain('Configuration is invalid');
    expect(stderr.join('\n')).toContain('permissions.mode');
    process.exitCode = undefined;
  });

  it('preserves the run state and returns exit code 1 when the pipeline fails', async () => {
    await parseRun(['--no-worktree', 'ship', 'auth'], {
      runPipeline: vi.fn(async () => {
        throw new Error('planner failed');
      }),
    });

    expect(stderr).toEqual(['planner failed']);
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });
});
