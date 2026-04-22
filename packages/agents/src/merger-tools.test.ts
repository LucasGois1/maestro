import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configSchema } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMergerToolSet } from './merger-tools.js';

let repoRoot: string;
let worktreeRoot: string;

function toolExec<I>(value: unknown): (input: I) => Promise<string> {
  return (value as { execute: (input: I) => Promise<string> }).execute;
}

function ctx() {
  return {
    repoRoot,
    worktreeRoot,
    config: configSchema.parse({ permissions: { mode: 'yolo' } }),
    runId: 'run-merge',
    bus: createEventBus(),
    maestroDir: '.custom-maestro',
  };
}

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-merger-tools-repo-'));
  worktreeRoot = await mkdtemp(join(tmpdir(), 'maestro-merger-tools-wt-'));
  await writeFile(join(worktreeRoot, 'README.md'), 'hello\n', 'utf8');
});

afterEach(async () => {
  await Promise.all([
    rm(repoRoot, { recursive: true, force: true }),
    rm(worktreeRoot, { recursive: true, force: true }),
  ]);
});

describe('createMergerToolSet', () => {
  it('reads, writes, appends maestro docs, and runs shell commands', async () => {
    const tools = createMergerToolSet(ctx());

    await expect(
      toolExec<{ path: string }>(tools.readFile)({ path: 'README.md' }),
    ).resolves.toBe('hello\n');
    await expect(
      toolExec<{ path: string; content: string }>(tools.writeFile)({
        path: 'src/result.txt',
        content: 'done\n',
      }),
    ).resolves.toBe('Written: src/result.txt');
    await expect(
      readFile(join(worktreeRoot, 'src', 'result.txt'), 'utf8'),
    ).resolves.toBe('done\n');
    await expect(
      toolExec<{ path: string; content: string }>(tools.appendFile)({
        path: 'log.md',
        content: '- merged\n',
      }),
    ).resolves.toBe('Appended: log.md');
    await expect(
      readFile(join(repoRoot, '.custom-maestro', 'log.md'), 'utf8'),
    ).resolves.toBe('- merged\n');
    await expect(
      toolExec<{ cmd: string; args: string[] }>(tools.runShell)({
        cmd: 'git',
        args: ['--version'],
      }),
    ).resolves.toContain('OK');
  });

  it('uses gitLog hooks and rejects maestro path escapes', async () => {
    const tools = createMergerToolSet(ctx(), {
      gitLog: async (input) => JSON.stringify(input),
    });

    await expect(
      toolExec<{ maxCount?: number; revisionRange?: string }>(tools.gitLog)({
        maxCount: 5,
        revisionRange: 'main..HEAD',
      }),
    ).resolves.toBe('{"revisionRange":"main..HEAD","maxCount":5}');
    await expect(
      toolExec<{ path: string; content: string }>(tools.appendFile)({
        path: '../outside.md',
        content: 'bad',
      }),
    ).resolves.toContain('Append error: Path escapes .maestro root');
  });
});
