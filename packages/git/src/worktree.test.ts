import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runGit } from './runner.js';
import { commitSprint } from './commit.js';
import {
  createWorktree,
  listWorktrees,
  parseWorktreePorcelain,
  removeWorktree,
} from './worktree.js';

let repoRoot: string;
let worktreeRoot: string;

async function setupRepo(): Promise<void> {
  await runGit(['init', '-b', 'main'], { cwd: repoRoot });
  await runGit(['config', 'user.email', 'maestro@example.com'], {
    cwd: repoRoot,
  });
  await runGit(['config', 'user.name', 'Maestro Test'], { cwd: repoRoot });
  await runGit(['config', 'commit.gpgsign', 'false'], { cwd: repoRoot });
  await writeFile(join(repoRoot, 'README.md'), 'hello\n', 'utf8');
  await commitSprint({
    cwd: repoRoot,
    type: 'chore',
    subject: 'initial commit',
  });
}

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-git-'));
  worktreeRoot = await mkdtemp(join(tmpdir(), 'maestro-worktree-'));
  await setupRepo();
});

afterEach(async () => {
  await Promise.all([
    rm(repoRoot, { recursive: true, force: true }),
    rm(worktreeRoot, { recursive: true, force: true }),
  ]);
});

describe('worktree lifecycle', () => {
  it('create + list + remove round-trip', async () => {
    const worktreePath = join(worktreeRoot, 'wt-1');
    const info = await createWorktree({
      repoRoot,
      runId: 'r1',
      branch: 'maestro/test-wt',
      worktreesRoot: worktreePath,
    });
    expect(info.path).toBe(worktreePath);
    expect(info.branch).toBe('maestro/test-wt');

    const list = await listWorktrees({ repoRoot });
    const resolved = worktreePath.replace(/^\/var\//u, '/private/var/');
    const match = (w: { path: string }) =>
      w.path === worktreePath || w.path === resolved;
    expect(list.some(match)).toBe(true);

    await removeWorktree({ repoRoot, worktreePath, force: true });
    const after = await listWorktrees({ repoRoot });
    expect(after.some(match)).toBe(false);
  });
});

describe('parseWorktreePorcelain', () => {
  it('parses the porcelain output format', () => {
    const sample = [
      'worktree /repo',
      'HEAD abc123',
      'branch refs/heads/main',
      '',
      'worktree /repo/.wt/foo',
      'HEAD def456',
      'branch refs/heads/feature',
    ].join('\n');
    const parsed = parseWorktreePorcelain(sample);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.branch).toBe('main');
    expect(parsed[1]?.path).toBe('/repo/.wt/foo');
    expect(parsed[1]?.branch).toBe('feature');
  });
});
