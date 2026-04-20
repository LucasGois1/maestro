import {
  detectRemote,
  listWorktrees,
  removeWorktree,
  runGit,
  type GitRunner,
  type WorktreeInfo,
} from '@maestro/git';
import { Command } from 'commander';

type Io = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

const defaultIo: Io = {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
};

export type GitCommandOptions = {
  readonly io?: Io;
  readonly runner?: GitRunner;
  readonly cwd?: () => string;
};

function resolveCwd(options: GitCommandOptions): string {
  return (options.cwd ?? (() => process.cwd()))();
}

function formatWorktree(info: WorktreeInfo): string {
  const branch = info.branch ? `@${info.branch}` : '';
  const head = info.head ? ` (${info.head.slice(0, 7)})` : '';
  return `${info.path}${branch}${head}`;
}

export function createGitCommand(options: GitCommandOptions = {}): Command {
  const io = options.io ?? defaultIo;
  const runner = options.runner ?? runGit;

  const cmd = new Command('git').description('Git worktree and PR helpers');

  cmd
    .command('status')
    .description('Show worktrees, current branch, and remote platform')
    .action(async () => {
      const cwd = resolveCwd(options);
      try {
        const [branch, worktrees, remote] = await Promise.all([
          runner(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd }).catch(() => ({
            stdout: '(none)',
            stderr: '',
            code: 1,
          })),
          listWorktrees({ repoRoot: cwd, runner }).catch(
            (): WorktreeInfo[] => [],
          ),
          detectRemote({ cwd, runner }),
        ]);

        io.stdout(`branch:   ${branch.stdout.trim() || '(none)'}`);
        io.stdout(
          remote
            ? `remote:   ${remote.name} → ${remote.url} [${remote.platform}]`
            : 'remote:   (none)',
        );
        io.stdout('worktrees:');
        if (worktrees.length === 0) {
          io.stdout('  (none)');
        } else {
          for (const wt of worktrees) io.stdout(`  - ${formatWorktree(wt)}`);
        }
      } catch (error) {
        io.stderr((error as Error).message);
        process.exitCode = 1;
      }
    });

  cmd
    .command('cleanup')
    .description('Remove Maestro worktrees (requires --force)')
    .option('--force', 'Skip confirmation')
    .option('--prefix <prefix>', 'Only remove paths matching this prefix')
    .action(async (flags: { force?: boolean; prefix?: string }) => {
      const cwd = resolveCwd(options);
      const worktrees = await listWorktrees({ repoRoot: cwd, runner });
      const prefix = flags.prefix ?? '.maestro';
      const targets = worktrees.filter(
        (wt) => wt.path.includes(prefix) && wt.path !== cwd,
      );
      if (targets.length === 0) {
        io.stdout(`No worktrees matching "${prefix}".`);
        return;
      }
      if (!flags.force) {
        io.stderr(
          `About to remove ${targets.length} worktree(s). Re-run with --force to proceed.`,
        );
        for (const wt of targets) io.stderr(`  - ${formatWorktree(wt)}`);
        process.exitCode = 1;
        return;
      }
      for (const wt of targets) {
        try {
          await removeWorktree({
            repoRoot: cwd,
            worktreePath: wt.path,
            force: true,
            runner,
          });
          io.stdout(`Removed ${wt.path}`);
        } catch (error) {
          io.stderr(`Failed to remove ${wt.path}: ${(error as Error).message}`);
          process.exitCode = 1;
        }
      }
    });

  return cmd;
}
