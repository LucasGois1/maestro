import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configSchema } from '@maestro/config';
import { PipelineRunNotFoundError } from '@maestro/pipeline';
import { createStateStore, type StateStore } from '@maestro/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createResumeCommand } from './resume.js';

let repoRoot: string;
let store: StateStore;
let stdout: string[];
let stderr: string[];

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-cli-resume-'));
  store = createStateStore({ repoRoot });
  stdout = [];
  stderr = [];
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
  process.exitCode = undefined;
});

function createCommand(overrides = {}) {
  return createResumeCommand({
    io: {
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    },
    cwd: () => repoRoot,
    loadConfig: async () => ({ resolved: configSchema.parse({}) }),
    store,
    resumePipeline: vi.fn(async (options) => ({
      state: await options.store.update(options.runId ?? 'paused', {
        status: 'completed',
        phase: 'completed',
      }),
      plan: { feature: 'Auth', summary: 'Ship auth', sprints: [] },
      sprintOutcomes: [],
      merger: {
        runStatus: 'completed',
        branch: 'maestro/paused',
        commitCount: 1,
        execPlanPath: '.maestro/docs/exec-plans/completed/auth.md',
        cleanupDone: false,
        prUrl: null,
        prNumber: null,
        summary: null,
        prTitle: null,
      },
    })),
    renderApp: vi.fn(() => ({ unmount: vi.fn() })),
    stdoutIsTTY: false,
    ...overrides,
  });
}

describe('maestro resume', () => {
  it('resumes the latest paused run when no id is provided', async () => {
    await store.create({
      runId: 'paused',
      branch: 'maestro/paused',
      worktreePath: repoRoot,
      prompt: 'paused run',
      userAgent: 'test',
      providerDefaults: {},
    });
    await store.update('paused', { status: 'paused', phase: 'generating' });

    const resumePipeline = vi.fn(async (options) => ({
      state: await options.store.update(options.runId ?? 'paused', {
        status: 'completed',
        phase: 'completed',
      }),
      plan: { feature: 'Auth', summary: 'Ship auth', sprints: [] },
      sprintOutcomes: [],
      merger: {
        runStatus: 'completed',
        branch: 'maestro/paused',
        commitCount: 1,
        execPlanPath: '.maestro/docs/exec-plans/completed/auth.md',
        cleanupDone: false,
        prUrl: null,
        prNumber: null,
        summary: null,
        prTitle: null,
      },
    }));

    await createCommand({ resumePipeline }).parseAsync([], { from: 'user' });

    expect(resumePipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        repoRoot,
        store,
      }),
    );
    expect(stdout.join('\n')).toContain('Run completed: paused');
  });

  it('resumes an explicit run id', async () => {
    await store.create({
      runId: 'run-42',
      branch: 'maestro/paused',
      worktreePath: repoRoot,
      prompt: 'paused run',
      userAgent: 'test',
      providerDefaults: {},
    });
    await store.update('run-42', { status: 'paused', phase: 'generating' });
    const resumePipeline = vi.fn(async (options) => ({
      state: await options.store.update(options.runId ?? 'missing', {
        status: 'completed',
        phase: 'completed',
      }),
      plan: { feature: 'Auth', summary: 'Ship auth', sprints: [] },
      sprintOutcomes: [],
      merger: {
        runStatus: 'completed',
        branch: 'maestro/paused',
        commitCount: 1,
        execPlanPath: '.maestro/docs/exec-plans/completed/auth.md',
        cleanupDone: false,
        prUrl: null,
        prNumber: null,
        summary: null,
        prTitle: null,
      },
    }));

    await createCommand({ resumePipeline }).parseAsync(['run-42'], {
      from: 'user',
    });

    expect(resumePipeline).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-42' }),
    );
  });

  it('renders the TUI instead of textual progress in TTY mode', async () => {
    await store.create({
      runId: 'paused',
      branch: 'maestro/paused',
      worktreePath: repoRoot,
      prompt: 'paused run',
      userAgent: 'test',
      providerDefaults: {},
    });
    await store.update('paused', { status: 'paused', phase: 'generating' });
    const unmount = vi.fn();
    const renderApp = vi.fn(() => ({ unmount }));

    await createCommand({ renderApp, stdoutIsTTY: true }).parseAsync([], {
      from: 'user',
    });

    expect(renderApp).toHaveBeenCalledWith(
      expect.objectContaining({
        bus: expect.any(Object),
        commandExecutor: expect.any(Function),
        store: expect.any(Object),
        repoRoot: expect.any(String),
        loadConfig: expect.any(Function),
      }),
    );
    expect(stdout.join('\n')).not.toContain('Run completed');
    expect(unmount).toHaveBeenCalledOnce();
  });

  it('returns exit code 1 when the run cannot be found', async () => {
    const resumePipeline = vi.fn(async () => {
      throw new PipelineRunNotFoundError('missing');
    });

    await createCommand({ resumePipeline }).parseAsync(['missing'], {
      from: 'user',
    });

    expect(stderr).toEqual(['No run with id "missing"']);
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });
});
