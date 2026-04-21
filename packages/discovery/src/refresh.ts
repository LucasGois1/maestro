import type { MaestroConfig } from '@maestro/config';
import { runGit } from '@maestro/git';

import { applyDiscoveryToKb } from './apply-draft.js';
import { runInferentialDiscovery } from './orchestrator.js';
import {
  loadDiscoveryState,
  saveDiscoveryState,
  type DiscoveryPersistedState,
} from './state.js';

export type RunKbRefreshOptions = {
  readonly repoRoot: string;
  readonly config: MaestroConfig;
  readonly maestroDir?: string;
  readonly runId?: string;
};

async function resolvePreferPaths(
  repoRoot: string,
): Promise<readonly string[] | undefined> {
  const prior = await loadDiscoveryState(repoRoot);
  const headResult = await runGit(['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    allowNonZero: true,
  });
  if (headResult.code !== 0) {
    return undefined;
  }
  const head = headResult.stdout.trim();
  if (!prior?.lastHead || prior.lastHead === head) {
    return undefined;
  }
  const diff = await runGit(
    ['diff', '--name-only', `${prior.lastHead}..${head}`],
    { cwd: repoRoot, allowNonZero: true },
  );
  if (diff.code !== 0) {
    return undefined;
  }
  const paths = diff.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return paths.length > 0 ? paths : undefined;
}

export async function runKbRefresh(
  options: RunKbRefreshOptions,
): Promise<{ readonly agentsMd: string; readonly architectureMd: string }> {
  const preferPaths = await resolvePreferPaths(options.repoRoot);
  const docs = await runInferentialDiscovery({
    repoRoot: options.repoRoot,
    config: options.config,
    runId: options.runId ?? 'kb-refresh',
    ...(preferPaths !== undefined
      ? { sampling: { preferPaths } }
      : {}),
  });

  await applyDiscoveryToKb(options.repoRoot, docs);

  const headResult = await runGit(['rev-parse', 'HEAD'], {
    cwd: options.repoRoot,
    allowNonZero: true,
  });
  const head = headResult.code === 0 ? headResult.stdout.trim() : null;

  const next: DiscoveryPersistedState = {
    lastHead: head,
    lastRefreshAt: new Date().toISOString(),
  };
  await saveDiscoveryState(options.repoRoot, next, options.maestroDir);

  return docs;
}
