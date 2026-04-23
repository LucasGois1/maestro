import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { ExecuteBackgroundResult } from '@maestro/agents';
import {
  createStateStore,
  runPipelineProcessPath,
  type StateStore,
} from '@maestro/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBackgroundCommand } from './background.js';

let repoRoot: string;
let stdout: string[];
let stderr: string[];
let store: StateStore;
const runBackground = vi.fn<[], Promise<ExecuteBackgroundResult>>();

async function run(args: string[]): Promise<void> {
  const program = createBackgroundCommand({
    io: {
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    },
    store,
    cwd: () => repoRoot,
    runBackground,
    randomUuid: () => 'test-run-id',
  });
  program.exitOverride();
  await program.parseAsync(args, { from: 'user' });
}

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-bg-'));
  await mkdir(join(repoRoot, '.maestro'), { recursive: true });
  await writeFile(join(repoRoot, '.maestro', 'config.json'), '{}\n', 'utf8');
  store = createStateStore({ repoRoot });
  stdout = [];
  stderr = [];
  process.exitCode = 0;
  runBackground.mockReset();
  runBackground.mockResolvedValue({
    issuesFound: 0,
    reportPath: '.maestro/docs/background-reports/x.md',
    output: {
      runType: 'all',
      issuesFound: 0,
      prsOpened: [],
      reportPath: '.maestro/docs/background-reports/x.md',
    },
  });
});

afterEach(async () => {
  process.exitCode = 0;
  await rm(repoRoot, { recursive: true, force: true });
});

describe('maestro background', () => {
  it('rejects invalid --type', async () => {
    await run(['run', '--type', 'nope']);
    expect(process.exitCode).toBe(1);
    expect(stderr.join('\n')).toMatch(/Invalid --type/);
    expect(runBackground).not.toHaveBeenCalled();
  });

  it('exits 2 when a pipeline run is active', async () => {
    await store.create({
      runId: 'r1',
      branch: 'maestro/demo',
      worktreePath: '/tmp/wt',
      prompt: 'ship',
      userAgent: 'maestro/0.1.0',
      providerDefaults: {},
    });
    const marker = runPipelineProcessPath({ repoRoot, runId: 'r1' });
    await mkdir(dirname(marker), { recursive: true });
    await writeFile(
      marker,
      `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
    );
    await run(['run']);
    expect(process.exitCode).toBe(2);
    expect(stderr.join('\n')).toMatch(/pipeline run is active/);
    expect(runBackground).not.toHaveBeenCalled();
  });

  it('runs background gardener and exits 0 when clean', async () => {
    await run(['run', '--type', 'all']);
    expect(process.exitCode).toBe(0);
    expect(runBackground).toHaveBeenCalledOnce();
    expect(stdout.join('\n')).toMatch(/issuesFound=0/);
  });

  it('exits 1 when issues were found', async () => {
    runBackground.mockResolvedValue({
      issuesFound: 2,
      reportPath: '.maestro/docs/background-reports/y.md',
      output: {
        runType: 'doc',
        issuesFound: 2,
        prsOpened: [],
        reportPath: '.maestro/docs/background-reports/y.md',
      },
    });
    await run(['run', '--type', 'doc', '--skip-llm', '--skip-pr']);
    expect(process.exitCode).toBe(1);
    expect(runBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        skipLlm: true,
        skipPr: true,
        runType: 'doc',
      }),
    );
  });
});
