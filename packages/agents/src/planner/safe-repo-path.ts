import { normalize, relative, resolve } from 'node:path';

/**
 * Resolves `userPath` under `repoRoot` and rejects path traversal.
 */
export function resolvePathUnderRepo(
  repoRoot: string,
  userPath: string,
): string {
  const trimmed = userPath.trim().replace(/^[/\\]+/u, '');
  const abs = resolve(repoRoot, normalize(trimmed));
  const root = resolve(repoRoot);
  const rel = relative(root, abs);
  if (rel.startsWith('..') || rel === '..') {
    throw new Error('Path escapes repository root');
  }
  return abs;
}
