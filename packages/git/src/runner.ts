import { spawn } from 'node:child_process';

export class GitCommandError extends Error {
  constructor(
    message: string,
    public readonly args: readonly string[],
    public readonly code: number | null,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'GitCommandError';
  }
}

export type GitRunOptions = {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly allowNonZero?: boolean;
};

export type GitRunResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
};

export type GitRunner = (
  args: readonly string[],
  options?: GitRunOptions,
) => Promise<GitRunResult>;

export function createGitRunner(spawnImpl: typeof spawn = spawn): GitRunner {
  return (args, options = {}) =>
    new Promise((resolve, reject) => {
      const child = spawnImpl('git', [...args], {
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        ...(options.env !== undefined ? { env: options.env } : {}),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        const exitCode = code ?? 0;
        if (exitCode !== 0 && options.allowNonZero !== true) {
          reject(
            new GitCommandError(
              `git ${args.join(' ')} exited with code ${exitCode}: ${stderr.trim()}`,
              args,
              exitCode,
              stderr,
            ),
          );
          return;
        }
        resolve({ stdout, stderr, code: exitCode });
      });
    });
}

export const runGit: GitRunner = createGitRunner();
