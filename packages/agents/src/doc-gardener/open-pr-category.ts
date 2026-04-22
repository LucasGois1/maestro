import {
  buildPrCommand,
  detectRemote,
  executePrCommand,
  parsePrUrlFromCliOutput,
  runGit,
  UnsupportedPlatformError,
  type DetectRemoteOptions,
  type ExecPrOptions,
  type GitRunner,
} from '@maestro/git';

import { resolveDefaultBranch } from './background-git.js';
import type { GardenerPrOpened } from './gardener-output.schema.js';

export type OpenPrDeps = {
  readonly detectRemote: (options: DetectRemoteOptions) => ReturnType<
    typeof detectRemote
  >;
  readonly runGit: GitRunner;
  readonly executePr: (
    options: ExecPrOptions,
  ) => Promise<{ stdout: string; code: number }>;
};

export const defaultOpenPrDeps: OpenPrDeps = {
  detectRemote,
  runGit,
  executePr: executePrCommand,
};

export function mergeOpenPrDeps(partial?: Partial<OpenPrDeps>): OpenPrDeps {
  return {
    detectRemote: partial?.detectRemote ?? defaultOpenPrDeps.detectRemote,
    runGit: partial?.runGit ?? defaultOpenPrDeps.runGit,
    executePr: partial?.executePr ?? defaultOpenPrDeps.executePr,
  };
}

/**
 * Abre um PR para a categoria (branch vazio + gh/glab). Retorna null se remoto/plataforma ou git/gh falharem.
 */
export async function openPrForCategory(
  repoRoot: string,
  category: 'doc-fix' | 'code-cleanup',
  title: string,
  body: string,
  deps: OpenPrDeps = defaultOpenPrDeps,
): Promise<GardenerPrOpened | null> {
  const remote = await deps.detectRemote({ cwd: repoRoot });
  if (!remote || remote.platform === 'unknown') return null;

  const base = await resolveDefaultBranch(deps.runGit, repoRoot);
  const coBase = await deps.runGit(['checkout', base], {
    cwd: repoRoot,
    allowNonZero: true,
  });
  if (coBase.code !== 0) return null;

  const branch = `maestro/background/${category}-${Date.now().toString()}`;
  const co = await deps.runGit(['checkout', '-b', branch], { cwd: repoRoot });
  if (co.code !== 0) return null;
  const em = await deps.runGit(
    ['commit', '--allow-empty', '-m', `chore(maestro): ${category}`],
    { cwd: repoRoot },
  );
  if (em.code !== 0) return null;
  const pu = await deps.runGit(['push', '-u', 'origin', branch], {
    cwd: repoRoot,
    allowNonZero: true,
  });
  if (pu.code !== 0) return null;
  try {
    const cmd = buildPrCommand({
      platform: remote.platform,
      pr: {
        title,
        summary: body,
        sprints: [],
        labels: ['maestro', 'background', category],
      },
      head: branch,
      baseBranch: base,
    });
    const result = await deps.executePr({ command: cmd, cwd: repoRoot });
    const parsed = parsePrUrlFromCliOutput(result.stdout);
    const url = parsed.prUrl ?? '';
    if (url.length === 0) return null;
    return {
      url,
      title,
      category,
      filesChanged: 0,
    };
  } catch (e) {
    if (e instanceof UnsupportedPlatformError) return null;
    throw e;
  }
}
