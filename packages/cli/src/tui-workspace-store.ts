import {
  createInitialTuiState,
  createTuiStore,
  type TuiColorMode,
  type TuiMode,
  type TuiStore,
} from '@maestro/tui';

import { resolveWorkspaceHeader } from './resolve-workspace-header.js';

export type CreateTuiStoreForWorkspaceOptions = {
  readonly repoRoot: string;
  readonly colorMode?: TuiColorMode;
  readonly mode?: TuiMode;
};

export async function createTuiStoreForWorkspace(
  options: CreateTuiStoreForWorkspaceOptions,
): Promise<TuiStore> {
  const { repoName, branch } = await resolveWorkspaceHeader(options.repoRoot);
  const baseHeader = createInitialTuiState().header;
  return createTuiStore({
    ...(options.colorMode !== undefined ? { colorMode: options.colorMode } : {}),
    ...(options.mode !== undefined ? { mode: options.mode } : {}),
    header: { ...baseHeader, repoName, branch },
  });
}
