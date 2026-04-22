import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { commitSprint, getWorkingTreeDiff, runGit } from './index.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-git-diff-'));
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
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('getWorkingTreeDiff', () => {
  it('returns the current working tree diff', async () => {
    await writeFile(join(repoRoot, 'README.md'), 'hello\nworld\n', 'utf8');

    const diff = await getWorkingTreeDiff(repoRoot);

    expect(diff).toContain('diff --git');
    expect(diff).toContain('+world');
  });

  it('truncates large diffs with a marker', async () => {
    await writeFile(join(repoRoot, 'README.md'), 'hello\nworld\n', 'utf8');

    const diff = await getWorkingTreeDiff(repoRoot, { maxChars: 12 });

    expect(diff).toMatch(/^diff --git/u);
    expect(diff).toContain('[diff truncated]');
  });

  it('returns a diagnostic string when git diff fails', async () => {
    const nonRepo = await mkdtemp(join(tmpdir(), 'maestro-git-diff-empty-'));
    try {
      await expect(getWorkingTreeDiff(nonRepo)).resolves.toContain(
        'git diff failed:',
      );
    } finally {
      await rm(nonRepo, { recursive: true, force: true });
    }
  });
});
