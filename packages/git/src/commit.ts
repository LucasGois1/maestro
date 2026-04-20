import { runGit, type GitRunner } from './runner.js';

export type CommitOptions = {
  readonly cwd: string;
  readonly type: string;
  readonly scope?: string;
  readonly subject: string;
  readonly body?: string;
  readonly coAuthors?: readonly string[];
  readonly addAll?: boolean;
  readonly runner?: GitRunner;
};

function buildMessage(options: CommitOptions): string {
  const header = options.scope
    ? `${options.type}(${options.scope}): ${options.subject}`
    : `${options.type}: ${options.subject}`;
  const parts = [header];
  if (options.body && options.body.trim().length > 0) {
    parts.push('', options.body.trim());
  }
  if (options.coAuthors && options.coAuthors.length > 0) {
    parts.push('');
    for (const coauthor of options.coAuthors) {
      parts.push(`Co-Authored-By: ${coauthor}`);
    }
  }
  return parts.join('\n');
}

export async function commitSprint(options: CommitOptions): Promise<string> {
  const runner = options.runner ?? runGit;
  if (options.addAll !== false) {
    await runner(['add', '-A'], { cwd: options.cwd });
  }
  const message = buildMessage(options);
  await runner(['commit', '-m', message], { cwd: options.cwd });
  const { stdout } = await runner(['rev-parse', 'HEAD'], { cwd: options.cwd });
  return stdout.trim();
}

export { buildMessage as buildCommitMessage };
