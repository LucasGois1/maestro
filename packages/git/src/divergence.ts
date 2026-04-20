import { runGit, type GitRunner } from './runner.js';

export type DivergenceReport = {
  readonly branchOk: boolean;
  readonly currentBranch: string;
  readonly expectedBranch: string;
  readonly newCommits: number;
  readonly diverged: boolean;
};

export type DetectDivergenceOptions = {
  readonly cwd: string;
  readonly expectedBranch: string;
  readonly since: string;
  readonly runner?: GitRunner;
};

export async function detectDivergence(
  options: DetectDivergenceOptions,
): Promise<DivergenceReport> {
  const runner = options.runner ?? runGit;
  const branchResult = await runner(['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: options.cwd,
  });
  const currentBranch = branchResult.stdout.trim();

  const logResult = await runner(
    [
      'log',
      `--since=${options.since}`,
      '--pretty=oneline',
      options.expectedBranch,
    ],
    { cwd: options.cwd, allowNonZero: true },
  );
  const newCommits =
    logResult.code === 0 && logResult.stdout.trim().length > 0
      ? logResult.stdout.trim().split(/\r?\n/u).length
      : 0;

  const branchOk = currentBranch === options.expectedBranch;
  return {
    branchOk,
    currentBranch,
    expectedBranch: options.expectedBranch,
    newCommits,
    diverged: !branchOk || newCommits > 0,
  };
}
