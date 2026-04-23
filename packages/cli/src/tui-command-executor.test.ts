import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configSchema } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import { createStateStore, type StateStore } from '@maestro/state';
import { findCommandEntry } from '@maestro/tui';
import type * as AgentsModule from '@maestro/agents';
import type * as ConfigModule from '@maestro/config';
import type * as DiscoveryModule from '@maestro/discovery';
import type * as GitModule from '@maestro/git';
import type * as KbModule from '@maestro/kb';
import type * as PipelineModule from '@maestro/pipeline';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTuiCommandExecutor } from './tui-command-executor.js';

const mocks = vi.hoisted(() => ({
  executeBackgroundGardener: vi.fn(),
  loadConfig: vi.fn(),
  createWorktree: vi.fn(),
  listWorktrees: vi.fn(),
  removeWorktree: vi.fn(),
  runGit: vi.fn(),
  detectRemote: vi.fn(),
  runKbRefresh: vi.fn(),
  createKBManager: vi.fn(),
  lintKnowledgeBase: vi.fn(),
  runPipeline: vi.fn(),
  resumePipeline: vi.fn(),
}));

vi.mock('@maestro/agents', async (importOriginal) => {
  const actual = await importOriginal<typeof AgentsModule>();
  return {
    ...actual,
    executeBackgroundGardener: mocks.executeBackgroundGardener,
  };
});

vi.mock('@maestro/config', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigModule>();
  return {
    ...actual,
    loadConfig: mocks.loadConfig,
  };
});

vi.mock('@maestro/discovery', async (importOriginal) => {
  const actual = await importOriginal<typeof DiscoveryModule>();
  return {
    ...actual,
    runKbRefresh: mocks.runKbRefresh,
  };
});

vi.mock('@maestro/git', async (importOriginal) => {
  const actual = await importOriginal<typeof GitModule>();
  return {
    ...actual,
    createWorktree: mocks.createWorktree,
    detectRemote: mocks.detectRemote,
    listWorktrees: mocks.listWorktrees,
    removeWorktree: mocks.removeWorktree,
    runGit: mocks.runGit,
  };
});

vi.mock('@maestro/kb', async (importOriginal) => {
  const actual = await importOriginal<typeof KbModule>();
  return {
    ...actual,
    createKBManager: mocks.createKBManager,
    lintKnowledgeBase: mocks.lintKnowledgeBase,
  };
});

vi.mock('@maestro/pipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof PipelineModule>();
  return {
    ...actual,
    runPipeline: mocks.runPipeline,
    resumePipeline: mocks.resumePipeline,
  };
});

let repoRoot: string;
let store: StateStore;
let originalCwd: string;

const defaultConfig = configSchema.parse({
  discovery: { enabled: true },
});

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-tui-command-executor-'));
  store = createStateStore({ repoRoot });
  originalCwd = process.cwd();
  process.chdir(repoRoot);
  process.exitCode = undefined;
  vi.clearAllMocks();
  mocks.loadConfig.mockResolvedValue({ resolved: defaultConfig });
  mocks.createWorktree.mockResolvedValue({
    path: join(repoRoot, '..', 'maestro-run-1'),
    branch: 'maestro/feature-ship-auth',
  });
  mocks.detectRemote.mockResolvedValue(null);
  mocks.listWorktrees.mockResolvedValue([]);
  mocks.runGit.mockResolvedValue({ stdout: 'main\n', stderr: '', code: 0 });
  mocks.lintKnowledgeBase.mockResolvedValue({
    ok: true,
    issues: [],
    fixedFiles: [],
  });
  mocks.createKBManager.mockReturnValue({ init: vi.fn() });
  mocks.runKbRefresh.mockResolvedValue(undefined);
  mocks.executeBackgroundGardener.mockResolvedValue({
    issuesFound: 0,
    reportPath: '.maestro/docs/background-reports/run.md',
  });
  mocks.runPipeline.mockResolvedValue({});
  mocks.resumePipeline.mockResolvedValue({});
});

afterEach(async () => {
  process.chdir(originalCwd);
  process.exitCode = undefined;
  await rm(repoRoot, { recursive: true, force: true });
});

function executor() {
  return createTuiCommandExecutor({
    repoRoot,
    store,
    bus: createEventBus(),
    randomUuid: () => 'run-1',
  });
}

async function execute(input: string) {
  const command = findCommandEntry(input);
  if (!command) throw new Error(`No command entry for ${input}`);
  return executor()({ input, command });
}

async function seedRun(
  runId: string,
  status: 'running' | 'paused' | 'completed' = 'running',
) {
  await store.create({
    runId,
    branch: `maestro/${runId}`,
    worktreePath: repoRoot,
    prompt: `${runId} prompt`,
    userAgent: 'test',
    providerDefaults: {},
  });
  await store.update(runId, {
    status,
    phase: status === 'completed' ? 'completed' : 'generating',
  });
}

describe('createTuiCommandExecutor', () => {
  it('starts a run in the current checkout when --no-worktree is passed', async () => {
    const result = await execute('maestro run --no-worktree "ship auth"');

    expect(result).toEqual({ level: 'info', message: 'Run started: run-1' });
    expect(mocks.createWorktree).not.toHaveBeenCalled();
    expect(mocks.runPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        prompt: 'ship auth',
        branch: 'maestro/feat-ship-auth',
        worktreePath: repoRoot,
        repoRoot,
        store,
      }),
    );
  });

  it('creates a worktree by default and honors an explicit branch', async () => {
    await execute('run --branch maestro/custom ship auth');

    expect(mocks.createWorktree).toHaveBeenCalledWith({
      repoRoot,
      runId: 'run-1',
      branch: 'maestro/custom',
    });
    expect(mocks.runPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'maestro/custom',
        worktreePath: join(repoRoot, '..', 'maestro-run-1'),
      }),
    );
  });

  it('rejects missing prompts and active runs before starting work', async () => {
    await expect(execute('run')).resolves.toEqual({
      level: 'error',
      message: 'Usage: run <prompt>',
    });

    await seedRun('active', 'running');
    const result = await execute('run ship auth');

    expect(result.level).toBe('error');
    expect(result.message).toContain('A Maestro pipeline run is active');
    expect(mocks.runPipeline).not.toHaveBeenCalled();
  });

  it('surfaces async run failures through the shared event bus', async () => {
    const bus = createEventBus();
    const emitted: string[] = [];
    bus.on((event) => {
      if (event.type === 'pipeline.failed') emitted.push(event.error);
    });
    mocks.runPipeline.mockRejectedValueOnce(new Error('planner exploded'));
    const run = createTuiCommandExecutor({
      repoRoot,
      store,
      bus,
      randomUuid: () => 'run-1',
    });
    const command = findCommandEntry('run ship auth');
    if (!command) throw new Error('missing run command');

    await run({ input: 'run ship auth', command });

    await vi.waitFor(() => {
      expect(emitted).toEqual(['planner exploded']);
    });
  });

  it('requests resume with and without an explicit run id', async () => {
    await expect(execute('resume run-42')).resolves.toEqual({
      level: 'info',
      message: 'Resume requested: run-42',
    });

    await store.create({
      runId: 'infer-me',
      branch: 'maestro/infer',
      worktreePath: repoRoot,
      prompt: 'infer',
      userAgent: 'test',
      providerDefaults: {},
      now: () => new Date('2026-05-01T12:00:00.000Z'),
    });

    await expect(execute('resume')).resolves.toEqual({
      level: 'info',
      message: 'Resume requested: infer-me',
    });

    expect(mocks.resumePipeline).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ runId: 'run-42', repoRoot, store }),
    );
    expect(mocks.resumePipeline).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ runId: 'infer-me', repoRoot, store }),
    );
  });

  it('rejects resume when no runs exist', async () => {
    await expect(execute('resume')).resolves.toEqual({
      level: 'error',
      message:
        'No runs recorded. Start one with `/run <prompt>` then use `/resume`.',
    });
    expect(mocks.resumePipeline).not.toHaveBeenCalled();
  });

  it('routes administrative commands in-process and captures their output', async () => {
    await seedRun('run-1', 'running');

    await expect(execute('runs list')).resolves.toMatchObject({
      level: 'info',
      message: expect.stringContaining('run-1'),
    });
    await expect(execute('abort run-1')).resolves.toEqual({
      level: 'info',
      message: 'Aborted run-1',
    });
    await expect(execute('config get permissions.mode')).resolves.toEqual({
      level: 'info',
      message: 'allowlist',
    });
    await expect(execute('git status')).resolves.toMatchObject({
      level: 'info',
      message: expect.stringContaining('branch:   main'),
    });
    await expect(execute('kb lint')).resolves.toEqual({
      level: 'info',
      message: 'KB is valid.',
    });
    await expect(execute('kb refresh')).resolves.toEqual({
      level: 'info',
      message: 'Knowledge base refreshed.',
    });
    await expect(
      execute('background run --type doc --skip-llm --skip-pr'),
    ).resolves.toEqual({
      level: 'info',
      message:
        'Background run finished: issuesFound=0 report=.maestro/docs/background-reports/run.md',
    });
    await expect(execute('tui')).resolves.toEqual({
      level: 'warn',
      message: 'Already inside the TUI.',
    });
  });

  it('returns error results when command-backed handlers set exitCode', async () => {
    await expect(execute('runs show missing')).resolves.toMatchObject({
      level: 'error',
      message: expect.stringContaining('not found'),
    });

    mocks.lintKnowledgeBase.mockResolvedValueOnce({
      ok: false,
      fixedFiles: [],
      issues: [{ file: 'AGENTS.md', message: 'missing link' }],
    });

    await expect(execute('kb lint')).resolves.toMatchObject({
      level: 'error',
      message: expect.stringContaining('missing link'),
    });
  });
});
