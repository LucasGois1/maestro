import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createStateStore,
  readProjectLog,
  type StateStore,
} from '@maestro/state';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAbortCommand } from './abort.js';

let repoRoot: string;
let store: StateStore;
let stdout: string[];
let stderr: string[];

async function run(args: string[]): Promise<void> {
  const program = createAbortCommand({
    io: {
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    },
    store,
    cwd: () => repoRoot,
  });
  program.exitOverride();
  await program.parseAsync(args, { from: 'user' });
}

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-abort-'));
  store = createStateStore({ repoRoot });
  stdout = [];
  stderr = [];
  process.exitCode = 0;
});

afterEach(async () => {
  process.exitCode = 0;
  await rm(repoRoot, { recursive: true, force: true });
});

describe('maestro abort', () => {
  it('cancels the latest run and appends to the project log', async () => {
    await store.create({
      runId: 'r1',
      branch: 'maestro/demo',
      worktreePath: '/tmp/wt',
      prompt: 'ship',
      userAgent: 'maestro/0.1.0',
      providerDefaults: {},
    });
    await run([]);
    const state = await store.load('r1');
    expect(state?.status).toBe('canceled');
    expect(state?.phase).toBe('failed');
    const log = await readProjectLog(repoRoot);
    expect(log).toContain('run.aborted');
  });

  it('exits 1 when no run exists', async () => {
    await run([]);
    expect(process.exitCode).toBe(1);
    expect(stderr.join('\n')).toMatch(/No run to abort/);
  });
});
