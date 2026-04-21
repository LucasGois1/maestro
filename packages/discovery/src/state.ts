import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type DiscoveryPersistedState = {
  readonly lastHead: string | null;
  readonly lastRefreshAt: string;
};

export function discoveryStatePath(
  repoRoot: string,
  maestroDir = '.maestro',
): string {
  return join(repoRoot, maestroDir, 'discovery-state.json');
}

export async function loadDiscoveryState(
  repoRoot: string,
  maestroDir?: string,
): Promise<DiscoveryPersistedState | null> {
  try {
    const raw = await readFile(
      discoveryStatePath(repoRoot, maestroDir),
      'utf8',
    );
    const parsed = JSON.parse(raw) as Partial<DiscoveryPersistedState>;
    if (
      typeof parsed.lastRefreshAt !== 'string' ||
      (parsed.lastHead !== null &&
        parsed.lastHead !== undefined &&
        typeof parsed.lastHead !== 'string')
    ) {
      return null;
    }
    return {
      lastHead: parsed.lastHead ?? null,
      lastRefreshAt: parsed.lastRefreshAt,
    };
  } catch {
    return null;
  }
}

export async function saveDiscoveryState(
  repoRoot: string,
  state: DiscoveryPersistedState,
  maestroDir?: string,
): Promise<void> {
  const path = discoveryStatePath(repoRoot, maestroDir);
  await mkdir(join(repoRoot, maestroDir ?? '.maestro'), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}
