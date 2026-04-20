import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildCommitMessage, commitSprint } from './commit.js';
import { runGit } from './runner.js';

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'maestro-commit-'));
  await runGit(['init', '-b', 'main'], { cwd });
  await runGit(['config', 'user.email', 'maestro@example.com'], { cwd });
  await runGit(['config', 'user.name', 'Maestro Test'], { cwd });
  await runGit(['config', 'commit.gpgsign', 'false'], { cwd });
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('buildCommitMessage', () => {
  it('renders a conventional header with optional scope and trailers', () => {
    const message = buildCommitMessage({
      cwd,
      type: 'feat',
      scope: 'auth',
      subject: 'add JWT signing',
      body: 'Split sign and verify into separate modules.',
      coAuthors: ['Claude Opus 4.7 <noreply@anthropic.com>'],
    });
    expect(message).toContain('feat(auth): add JWT signing');
    expect(message).toContain('Split sign and verify');
    expect(message).toContain(
      'Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>',
    );
  });

  it('omits the scope parentheses when no scope is provided', () => {
    const message = buildCommitMessage({
      cwd,
      type: 'chore',
      subject: 'bump deps',
    });
    expect(message.split('\n')[0]).toBe('chore: bump deps');
  });
});

describe('commitSprint', () => {
  it('commits staged changes and returns the new HEAD sha', async () => {
    await writeFile(join(cwd, 'file.txt'), 'content\n', 'utf8');
    const sha = await commitSprint({
      cwd,
      type: 'feat',
      scope: 'demo',
      subject: 'add file',
    });
    expect(sha).toMatch(/^[0-9a-f]{7,40}$/u);

    const log = await runGit(['log', '--oneline'], { cwd });
    expect(log.stdout).toContain('feat(demo): add file');
  });
});
