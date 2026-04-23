import { basename } from 'node:path';

import { runGit } from '@maestro/git';

/**
 * Repo folder name + current branch for the TUI header (idle home and shell).
 */
export async function resolveWorkspaceHeader(repoRoot: string): Promise<{
  readonly repoName: string;
  readonly branch: string | null;
}> {
  const repoName = basename(repoRoot);
  try {
    const inside = await runGit(['rev-parse', '--is-inside-work-tree'], {
      cwd: repoRoot,
      allowNonZero: true,
    });
    if (inside.stdout.trim() !== 'true') {
      return { repoName, branch: null };
    }
    const head = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoRoot,
      allowNonZero: true,
    });
    const branch = head.stdout.trim();
    if (branch.length === 0) {
      return { repoName, branch: null };
    }
    return { repoName, branch };
  } catch {
    return { repoName, branch: null };
  }
}
