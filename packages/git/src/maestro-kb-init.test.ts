import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runGit, type GitRunResult, type GitRunner } from './runner.js';
import { commitMaestroKbInit } from './maestro-kb-init.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-git-init-'));
  await runGit(['init', '-b', 'main'], { cwd: repoRoot });
  await runGit(['config', 'user.email', 't@e.st'], { cwd: repoRoot });
  await runGit(['config', 'user.name', 'Test'], { cwd: repoRoot });
  await runGit(['config', 'commit.gpgsign', 'false'], { cwd: repoRoot });
  await runGit(['config', 'tag.gpgsign', 'false'], { cwd: repoRoot });
  await runGit(['config', 'gpg.format', 'openpgp'], { cwd: repoRoot });
  await writeFile(join(repoRoot, 'README.md'), '# x\n', 'utf8');
  await runGit(['add', 'README.md'], { cwd: repoRoot });
  await runGit(['commit', '-m', 'init'], { cwd: repoRoot });
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('commitMaestroKbInit', () => {
  it('creates branch, stages .maestro, and commits', async () => {
    await mkdir(join(repoRoot, '.maestro'), { recursive: true });
    await writeFile(join(repoRoot, '.maestro', 'AGENTS.md'), '# A\n', 'utf8');

    const result = await commitMaestroKbInit({
      cwd: repoRoot,
      branchName: 'maestro/init',
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') {
      return;
    }
    expect(result.branch).toBe('maestro/init');

    const branch = await runGit(['branch', '--show-current'], {
      cwd: repoRoot,
    });
    expect(branch.stdout.trim()).toBe('maestro/init');

    const show = await runGit(['show', '--stat'], { cwd: repoRoot });
    expect(show.stdout).toContain('.maestro/AGENTS.md');
  });

  it('returns skipped when cwd is not a git repository', async () => {
    const plain = await mkdtemp(join(tmpdir(), 'maestro-not-git-'));
    try {
      const result = await commitMaestroKbInit({
        cwd: plain,
        branchName: 'maestro/init',
      });
      expect(result.kind).toBe('skipped');
    } finally {
      await rm(plain, { recursive: true, force: true });
    }
  });

  it('checks out an existing branch and treats an unchanged tree as ok', async () => {
    const calls: string[][] = [];
    const runner = scriptedRunner(
      [
        { stdout: 'true\n', stderr: '', code: 0 },
        { stdout: 'abc123\n', stderr: '', code: 0 },
        { stdout: '', stderr: '', code: 0 },
        { stdout: '', stderr: '', code: 0 },
        {
          stdout: '',
          stderr: 'nothing to commit, working tree clean\n',
          code: 1,
        },
        { stdout: 'head-sha\n', stderr: '', code: 0 },
      ],
      calls,
    );

    await expect(
      commitMaestroKbInit({
        cwd: '/repo',
        branchName: 'maestro/init',
        runner,
      }),
    ).resolves.toEqual({
      kind: 'ok',
      branch: 'maestro/init',
      commitSha: 'head-sha',
    });
    expect(calls).toContainEqual(['checkout', 'maestro/init']);
    expect(calls).not.toContainEqual(['checkout', '-b', 'maestro/init']);
  });

  it('returns a structured error when git commit fails for another reason', async () => {
    const calls: string[][] = [];
    const runner = scriptedRunner(
      [
        { stdout: 'true\n', stderr: '', code: 0 },
        { stdout: '', stderr: 'missing branch\n', code: 1 },
        { stdout: '', stderr: '', code: 0 },
        { stdout: '', stderr: '', code: 0 },
        { stdout: '', stderr: 'gpg failed\n', code: 128 },
      ],
      calls,
    );

    await expect(
      commitMaestroKbInit({
        cwd: '/repo',
        branchName: 'maestro/init',
        maestroDir: '.custom-maestro',
        subject: 'seed docs',
        runner,
      }),
    ).resolves.toEqual({ kind: 'error', message: 'gpg failed' });
    expect(calls).toContainEqual(['checkout', '-b', 'maestro/init']);
    expect(calls).toContainEqual(['add', '--', '.custom-maestro']);
    expect(calls).toContainEqual([
      'commit',
      '-m',
      'docs(.custom-maestro): seed docs',
    ]);
  });
});

function scriptedRunner(
  results: readonly GitRunResult[],
  calls: string[][],
): GitRunner {
  let index = 0;
  return async (args) => {
    calls.push([...args]);
    const result = results[index];
    index += 1;
    if (result === undefined) {
      throw new Error(`unexpected git call: ${args.join(' ')}`);
    }
    return result;
  };
}
