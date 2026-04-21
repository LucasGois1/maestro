import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runGit } from './runner.js';
import { commitMaestroKbInit } from './maestro-kb-init.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-git-init-'));
  await runGit(['init', '-b', 'main'], { cwd: repoRoot });
  await runGit(['config', 'user.email', 't@e.st'], { cwd: repoRoot });
  await runGit(['config', 'user.name', 'Test'], { cwd: repoRoot });
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
});
