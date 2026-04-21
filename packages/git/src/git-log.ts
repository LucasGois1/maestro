import { runGit, type GitRunner } from './runner.js';

export type GitLogOnelineOptions = {
  readonly cwd: string;
  /** Ex.: `main..HEAD` ou `abc123..HEAD` */
  readonly revisionRange?: string;
  readonly maxCount?: number;
  readonly runner?: GitRunner;
};

/**
 * Saída `git log --oneline` (truncada pelo git).
 */
export async function getGitLogOneline(
  options: GitLogOnelineOptions,
): Promise<string> {
  const runner = options.runner ?? runGit;
  const args = ['log', '--oneline', '--no-color'];
  if (options.revisionRange !== undefined && options.revisionRange.length > 0) {
    args.push(options.revisionRange);
  } else {
    const n = options.maxCount ?? 30;
    args.push(`-${n.toString()}`);
  }
  const result = await runner(args, { cwd: options.cwd, allowNonZero: true });
  if (result.code !== 0) {
    return `(git log failed: ${result.stderr.trim()})`;
  }
  return result.stdout.trimEnd();
}
