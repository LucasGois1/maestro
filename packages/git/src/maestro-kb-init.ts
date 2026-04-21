import { MAESTRO_DIR_NAME } from '@maestro/config';

import { runGit, type GitRunner } from './runner.js';

export type CommitMaestroKbInitOptions = {
  readonly cwd: string;
  readonly branchName: string;
  readonly maestroDir?: string;
  readonly subject?: string;
  readonly runner?: GitRunner;
};

export type CommitMaestroKbInitResult =
  | { readonly kind: 'ok'; readonly branch: string; readonly commitSha: string }
  | { readonly kind: 'skipped'; readonly reason: 'not_a_git_repository' }
  | { readonly kind: 'error'; readonly message: string };

const DEFAULT_SUBJECT = 'bootstrap Maestro knowledge base';

export async function commitMaestroKbInit(
  options: CommitMaestroKbInitOptions,
): Promise<CommitMaestroKbInitResult> {
  const runner = options.runner ?? runGit;
  const maestroRel = options.maestroDir ?? MAESTRO_DIR_NAME;

  const inside = await runner(['rev-parse', '--is-inside-work-tree'], {
    cwd: options.cwd,
    allowNonZero: true,
  });
  if (inside.code !== 0) {
    return { kind: 'skipped', reason: 'not_a_git_repository' };
  }

  const branchRef = await runner(
    ['rev-parse', '--verify', `refs/heads/${options.branchName}`],
    { cwd: options.cwd, allowNonZero: true },
  );
  const branchExists = branchRef.code === 0;
  if (branchExists) {
    await runner(['checkout', options.branchName], { cwd: options.cwd });
  } else {
    await runner(['checkout', '-b', options.branchName], { cwd: options.cwd });
  }

  await runner(['add', '--', maestroRel], { cwd: options.cwd });

  const subject = options.subject ?? DEFAULT_SUBJECT;
  const message = `docs(${maestroRel}): ${subject}`;

  const commitResult = await runner(['commit', '-m', message], {
    cwd: options.cwd,
    allowNonZero: true,
  });
  if (commitResult.code !== 0) {
    const hint = commitResult.stderr.trim() || commitResult.stdout.trim();
    if (/nothing to commit|no changes added to commit/i.test(hint)) {
      const head = await runner(['rev-parse', 'HEAD'], { cwd: options.cwd });
      return {
        kind: 'ok',
        branch: options.branchName,
        commitSha: head.stdout.trim(),
      };
    }
    return {
      kind: 'error',
      message: hint || `git commit failed with code ${commitResult.code}`,
    };
  }

  const head = await runner(['rev-parse', 'HEAD'], { cwd: options.cwd });
  return {
    kind: 'ok',
    branch: options.branchName,
    commitSha: head.stdout.trim(),
  };
}
