import { readFile, unlink } from 'node:fs/promises';

import { runPipelineProcessPath, type RunPathOptions } from './paths.js';

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  );
}

export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function readPipelineProcessPid(
  path: string,
): Promise<number | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'pid' in parsed) {
      const n = (parsed as { pid: unknown }).pid;
      return typeof n === 'number' && Number.isInteger(n) ? n : null;
    }
    return null;
  } catch (error) {
    if (isEnoent(error)) {
      return null;
    }
    throw error;
  }
}

export async function removePipelineProcessMarker(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (!isEnoent(error)) {
      throw error;
    }
  }
}

export async function isStaleRunningRun(opts: {
  readonly repoRoot: string;
  readonly runId: string;
  readonly maestroDir?: string;
}): Promise<boolean> {
  const pathOpts: RunPathOptions = {
    repoRoot: opts.repoRoot,
    runId: opts.runId,
    ...(opts.maestroDir !== undefined ? { maestroDir: opts.maestroDir } : {}),
  };
  const path = runPipelineProcessPath(pathOpts);
  const pid = await readPipelineProcessPid(path);
  if (pid === null) {
    return true;
  }
  return !isProcessAlive(pid);
}
