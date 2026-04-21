import { createGitRunner } from './runner.js';

const DEFAULT_MAX = 48_000;

/**
 * `git diff` no diretório dado (worktree ou clone). Trunca saída longa.
 */
export async function getWorkingTreeDiff(
  cwd: string,
  options?: { maxChars?: number },
): Promise<string> {
  const run = createGitRunner();
  const maxChars = options?.maxChars ?? DEFAULT_MAX;
  try {
    const r = await run(['diff', '--no-color'], { cwd });
    const out = r.stdout;
    if (out.length <= maxChars) {
      return out;
    }
    return `${out.slice(0, maxChars)}\n\n[diff truncated]\n`;
  } catch (e) {
    return `(git diff failed: ${e instanceof Error ? e.message : String(e)})\n`;
  }
}
