import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configSchema } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    branch: 'maestro/real-run-branch',
    baseBranch: 'main',
    remote: {
      platform: 'github' as const,
      url: 'https://github.com/acme/maestro.git',
      name: 'origin',
    },
    requireDraftPr: false,
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
  it('reads, writes, appends maestro docs, and exposes no raw shell', async () => {
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
    expect(tools).not.toHaveProperty('runShell');
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

  it('opens a pull request with the run branch and retries without labels', async () => {
    const commands: Array<{ cmd: string; args: readonly string[] }> = [];
    const runShell = vi.fn(async (input: { cmd: string; args: readonly string[] }) => {
      commands.push(input);
      if (input.cmd === 'git') {
        return { exitCode: 0, stdout: '', stderr: '', durationMs: 1 };
      }
      if (input.args.includes('--label')) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: "could not add label: 'missing' not found",
          durationMs: 1,
        };
      }
      return {
        exitCode: 0,
        stdout: 'https://github.com/acme/maestro/pull/42\n',
        stderr: '',
        durationMs: 1,
      };
    });
    const tools = createMergerToolSet(ctx(), { runShell });

    const raw = await toolExec<{
      title: string;
      body: string;
      labels: string[];
      branch: string;
    }>(tools.openPullRequest)({
      title: 'docs(contributing): translate guide',
      body: 'Translate CONTRIBUTING.md.',
      labels: ['missing'],
      branch: 'maestro/fake-agent-branch',
    });

    expect(JSON.parse(raw)).toMatchObject({
      ok: true,
      prUrl: 'https://github.com/acme/maestro/pull/42',
      prNumber: 42,
      branch: 'maestro/real-run-branch',
      retriedWithoutLabels: true,
    });
    expect(commands[0]).toEqual({
      cmd: 'git',
      args: ['push', 'origin', 'maestro/real-run-branch'],
    });
    expect(commands[1]?.args).toEqual(
      expect.arrayContaining(['--head', 'maestro/real-run-branch']),
    );
    expect(commands[1]?.args).toEqual(expect.arrayContaining(['--label']));
    expect(commands[2]?.args).toEqual(
      expect.arrayContaining(['--head', 'maestro/real-run-branch']),
    );
    expect(commands[2]?.args).not.toContain('--label');
  });

  it('reports merge context from run-owned invariants', async () => {
    const tools = createMergerToolSet(ctx(), {
      gitLog: async () => 'abc123 docs: change',
    });

    const raw = await toolExec<Record<string, never>>(tools.getMergeContext)({});

    expect(JSON.parse(raw)).toMatchObject({
      branch: 'maestro/real-run-branch',
      baseBranch: 'main',
      remote: {
        platform: 'github',
        name: 'origin',
      },
      recentCommits: 'abc123 docs: change',
    });
  });
});
