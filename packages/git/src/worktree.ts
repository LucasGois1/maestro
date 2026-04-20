import { homedir } from 'node:os';
import { join } from 'node:path';

import { runGit, type GitRunner } from './runner.js';

export type WorktreeInfo = {
  readonly path: string;
  readonly branch?: string;
  readonly head?: string;
};

export type CreateWorktreeOptions = {
  readonly repoRoot: string;
  readonly runId: string;
  readonly branch: string;
  readonly baseRef?: string;
  readonly worktreesRoot?: string;
  readonly runner?: GitRunner;
};

export type RemoveWorktreeOptions = {
  readonly repoRoot: string;
  readonly worktreePath: string;
  readonly force?: boolean;
  readonly runner?: GitRunner;
};

export function defaultWorktreesRoot(repoName: string, runId: string): string {
  return join(homedir(), '.maestro', 'worktrees', `${repoName}-${runId}`);
}

function repoBasename(repoRoot: string): string {
  const parts = repoRoot.split(/[/\\]/u).filter(Boolean);
  return parts[parts.length - 1] ?? 'repo';
}

export async function createWorktree(
  options: CreateWorktreeOptions,
): Promise<WorktreeInfo> {
  const runner = options.runner ?? runGit;
  const path =
    options.worktreesRoot ??
    defaultWorktreesRoot(repoBasename(options.repoRoot), options.runId);
  const args = ['worktree', 'add', '-b', options.branch, path];
  if (options.baseRef) args.push(options.baseRef);
  await runner(args, { cwd: options.repoRoot });
  return { path, branch: options.branch };
}

export async function removeWorktree(
  options: RemoveWorktreeOptions,
): Promise<void> {
  const runner = options.runner ?? runGit;
  const args = ['worktree', 'remove'];
  if (options.force) args.push('--force');
  args.push(options.worktreePath);
  await runner(args, { cwd: options.repoRoot });
}

export type ListWorktreesOptions = {
  readonly repoRoot: string;
  readonly runner?: GitRunner;
};

export async function listWorktrees(
  options: ListWorktreesOptions,
): Promise<WorktreeInfo[]> {
  const runner = options.runner ?? runGit;
  const { stdout } = await runner(['worktree', 'list', '--porcelain'], {
    cwd: options.repoRoot,
  });
  return parseWorktreePorcelain(stdout);
}

export function parseWorktreePorcelain(output: string): WorktreeInfo[] {
  const blocks = output
    .split(/\n\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  const trees: WorktreeInfo[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    let path: string | undefined;
    let branch: string | undefined;
    let head: string | undefined;
    for (const line of lines) {
      if (line.startsWith('worktree '))
        path = line.slice('worktree '.length).trim();
      else if (line.startsWith('HEAD '))
        head = line.slice('HEAD '.length).trim();
      else if (line.startsWith('branch ')) {
        const ref = line.slice('branch '.length).trim();
        branch = ref.replace(/^refs\/heads\//u, '');
      }
    }
    if (!path) continue;
    const info: WorktreeInfo = {
      path,
      ...(branch !== undefined ? { branch } : {}),
      ...(head !== undefined ? { head } : {}),
    };
    trees.push(info);
  }
  return trees;
}
