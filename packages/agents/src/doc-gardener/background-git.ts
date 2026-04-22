import type { GitRunner } from '@maestro/git';

/**
 * Resolve o nome curto do branch default de `origin` (ex.: `main`), ou `main`/`master` se existirem localmente.
 */
export async function resolveDefaultBranch(
  run: GitRunner,
  cwd: string,
): Promise<string> {
  const sym = await run(['symbolic-ref', 'refs/remotes/origin/HEAD'], {
    cwd,
    allowNonZero: true,
  });
  if (sym.code === 0) {
    const line = sym.stdout.trim();
    const ref = /^refs\/remotes\/origin\/(.+)$/u.exec(line);
    if (ref?.[1] !== undefined && ref[1].length > 0) {
      return ref[1];
    }
  }
  for (const b of ['main', 'master']) {
    const v = await run(['rev-parse', '--verify', b], { cwd, allowNonZero: true });
    if (v.code === 0) return b;
  }
  return 'main';
}

export async function isWorkingTreeClean(
  run: GitRunner,
  cwd: string,
): Promise<boolean> {
  const st = await run(['status', '--porcelain'], { cwd });
  return st.stdout.trim().length === 0;
}
