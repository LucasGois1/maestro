import { describe, expect, it, vi } from 'vitest';
import type { GitRunner } from '@maestro/git';

import { createGitCommand } from './git.js';

function makeRunner(map: Record<string, string>): GitRunner {
  return vi.fn(async (args: readonly string[]) => {
    const key = args.join(' ');
    return { stdout: map[key] ?? '', stderr: '', code: 0 };
  }) as unknown as GitRunner;
}

async function run(
  runner: GitRunner,
  args: string[],
  io: { stdout: string[]; stderr: string[] },
): Promise<void> {
  const program = createGitCommand({
    io: {
      stdout: (line) => io.stdout.push(line),
      stderr: (line) => io.stderr.push(line),
    },
    runner,
    cwd: () => '/tmp/repo',
  });
  program.exitOverride();
  await program.parseAsync(args, { from: 'user' });
}

describe('maestro git status', () => {
  it('prints branch, remote, and worktrees', async () => {
    const runner = makeRunner({
      'rev-parse --abbrev-ref HEAD': 'maestro/demo\n',
      'worktree list --porcelain':
        'worktree /tmp/repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /tmp/wt\nHEAD def\nbranch refs/heads/maestro/demo\n',
      'remote get-url origin': 'git@github.com:acme/repo.git\n',
    });
    const io = { stdout: [] as string[], stderr: [] as string[] };
    await run(runner, ['status'], io);
    const joined = io.stdout.join('\n');
    expect(joined).toContain('branch:   maestro/demo');
    expect(joined).toContain('github.com:acme/repo.git');
    expect(joined).toContain('/tmp/wt');
  });

  it('prints fallbacks when branch/worktrees/remote are unavailable', async () => {
    const runner = vi.fn(async (args: readonly string[]) => {
      if (args.join(' ') === 'remote get-url origin') {
        return { stdout: '', stderr: '', code: 1 };
      }
      throw new Error('git unavailable');
    }) as unknown as GitRunner;
    const io = { stdout: [] as string[], stderr: [] as string[] };

    await run(runner, ['status'], io);

    const joined = io.stdout.join('\n');
    expect(joined).toContain('branch:   (none)');
    expect(joined).toContain('remote:   (none)');
    expect(joined).toContain('worktrees:\n  (none)');
  });
});

describe('maestro git cleanup', () => {
  it('prints a clear message when no worktrees match', async () => {
    const runner = makeRunner({
      'worktree list --porcelain':
        'worktree /tmp/repo\nbranch refs/heads/main\n',
    });
    const io = { stdout: [] as string[], stderr: [] as string[] };

    await run(runner, ['cleanup'], io);

    expect(io.stdout).toEqual(['No worktrees matching ".maestro".']);
  });

  it('refuses to delete without --force', async () => {
    const runner = makeRunner({
      'worktree list --porcelain':
        'worktree /tmp/repo\nbranch refs/heads/main\n\nworktree /Users/x/.maestro/worktrees/demo\nbranch refs/heads/maestro/demo\n',
    });
    const io = { stdout: [] as string[], stderr: [] as string[] };
    await run(runner, ['cleanup'], io);
    expect(process.exitCode).toBe(1);
    expect(io.stderr.join('\n')).toMatch(/--force/);
    process.exitCode = 0;
  });

  it('removes matching worktrees with --force', async () => {
    const runner = makeRunner({
      'worktree list --porcelain':
        'worktree /tmp/repo\nbranch refs/heads/main\n\nworktree /Users/x/.maestro/worktrees/demo\nHEAD abcdef0123\nbranch refs/heads/maestro/demo\n',
    });
    const io = { stdout: [] as string[], stderr: [] as string[] };

    await run(runner, ['cleanup', '--force'], io);

    expect(io.stdout).toEqual(['Removed /Users/x/.maestro/worktrees/demo']);
    expect(runner).toHaveBeenCalledWith(
      ['worktree', 'remove', '--force', '/Users/x/.maestro/worktrees/demo'],
      { cwd: '/tmp/repo' },
    );
  });

  it('continues cleanup after a worktree removal error', async () => {
    const runner = vi.fn(async (args: readonly string[]) => {
      if (args.join(' ') === 'worktree list --porcelain') {
        return {
          stdout:
            'worktree /tmp/repo\nbranch refs/heads/main\n\nworktree /Users/x/.maestro/worktrees/demo\nbranch refs/heads/maestro/demo\n',
          stderr: '',
          code: 0,
        };
      }
      throw new Error('locked');
    }) as unknown as GitRunner;
    const io = { stdout: [] as string[], stderr: [] as string[] };

    await run(runner, ['cleanup', '--force'], io);

    expect(process.exitCode).toBe(1);
    expect(io.stderr.join('\n')).toMatch(/Failed to remove .*locked/);
    process.exitCode = 0;
  });
});
