import { describe, expect, it } from 'vitest';

import { getGitLogOneline, type GitRunner } from './index.js';

describe('getGitLogOneline', () => {
  it('uses an explicit revision range when provided', async () => {
    const calls: string[][] = [];
    const runner: GitRunner = async (args) => {
      calls.push([...args]);
      return { stdout: 'abc123 ship tests\n', stderr: '', code: 0 };
    };

    await expect(
      getGitLogOneline({
        cwd: '/repo',
        revisionRange: 'main..HEAD',
        maxCount: 5,
        runner,
      }),
    ).resolves.toBe('abc123 ship tests');
    expect(calls[0]).toEqual(['log', '--oneline', '--no-color', 'main..HEAD']);
  });

  it('falls back to maxCount when no range is present', async () => {
    let seenArgs: readonly string[] = [];
    const runner: GitRunner = async (args) => {
      seenArgs = args;
      return { stdout: 'def456 add fixture\n', stderr: '', code: 0 };
    };

    await getGitLogOneline({ cwd: '/repo', maxCount: 2, runner });

    expect(seenArgs).toEqual(['log', '--oneline', '--no-color', '-2']);
  });

  it('returns a diagnostic string when git log fails', async () => {
    const runner: GitRunner = async () => ({
      stdout: '',
      stderr: 'fatal: bad revision',
      code: 128,
    });

    await expect(getGitLogOneline({ cwd: '/repo', runner })).resolves.toBe(
      '(git log failed: fatal: bad revision)',
    );
  });
});
