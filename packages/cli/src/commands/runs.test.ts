import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createStateStore, type StateStore } from '@maestro/state';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createRunsCommand } from './runs.js';

let repoRoot: string;
let store: StateStore;
let stdout: string[];
let stderr: string[];

const io = {
  stdout: (line: string) => stdout.push(line),
  stderr: (line: string) => stderr.push(line),
};

async function run(args: string[]): Promise<void> {
  const program = createRunsCommand({ io, store });
  program.exitOverride();
  await program.parseAsync(args, { from: 'user' });
}

const seedOpts = {
  branch: 'maestro/demo',
  worktreePath: '/tmp/wt',
  prompt: 'ship',
  userAgent: 'maestro/0.1.0',
  providerDefaults: { planner: 'openai/gpt-5' },
};

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-cli-runs-'));
  store = createStateStore({ repoRoot });
  stdout = [];
  stderr = [];
  process.exitCode = 0;
});

afterEach(async () => {
  process.exitCode = 0;
  await rm(repoRoot, { recursive: true, force: true });
});

describe('maestro runs', () => {
  it('list prints header + one row per run', async () => {
    await store.create({ ...seedOpts, runId: 'run-1' });
    await store.create({ ...seedOpts, runId: 'run-2' });
    await run(['list']);
    expect(stdout[0]).toBe('runId\tstatus\tphase\tupdatedAt\tprompt');
    expect(stdout.slice(1)).toHaveLength(2);
  });

  it('list reports empty state clearly', async () => {
    await run(['list']);
    expect(stdout).toEqual(['No runs recorded.']);
  });

  it('show prints details for a specific run', async () => {
    await store.create({ ...seedOpts, runId: 'run-1' });
    await run(['show', 'run-1']);
    expect(stdout.join('\n')).toMatch(/runId:\s+run-1/);
  });

  it('show exits with 1 for unknown runs', async () => {
    await run(['show', 'missing']);
    expect(process.exitCode).toBe(1);
    expect(stderr.join('\n')).toMatch(/not found/);
  });

  it('clean --force deletes completed runs', async () => {
    const created = await store.create({ ...seedOpts, runId: 'run-1' });
    await store.update(created.runId, {
      status: 'completed',
      phase: 'completed',
      completedAt: new Date().toISOString(),
    });
    await run(['clean', '--force']);
    expect(await store.load('run-1')).toBeNull();
  });

  it('clean without --force requires confirmation and keeps runs by default', async () => {
    const created = await store.create({ ...seedOpts, runId: 'run-1' });
    await store.update(created.runId, {
      status: 'completed',
      phase: 'completed',
      completedAt: new Date().toISOString(),
    });
    await run(['clean']);
    expect(await store.load('run-1')).not.toBeNull();
  });
});
