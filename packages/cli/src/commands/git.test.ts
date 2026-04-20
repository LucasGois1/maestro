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
});

describe('maestro git cleanup', () => {
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
});
