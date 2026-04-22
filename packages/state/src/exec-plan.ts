import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  completedExecPlanRelativePath,
  execPlansCompletedDir,
} from './paths.js';

export type WriteCompletedExecPlanOptions = {
  readonly repoRoot: string;
  readonly maestroDir?: string;
  /** Só o nome do ficheiro, ex. `auth-flow.md` */
  readonly fileName: string;
  readonly markdown: string;
};

/**
 * Grava o exec-plan em `.maestro/docs/exec-plans/completed/<fileName>`.
 * Devolve o caminho relativo POSIX para documentar no merger / PR.
 */
export async function writeCompletedExecPlan(
  options: WriteCompletedExecPlanOptions,
): Promise<{ readonly relativePathPosix: string }> {
  const dir = execPlansCompletedDir(options.repoRoot, options.maestroDir);
  await mkdir(dir, { recursive: true });
  const abs = join(dir, options.fileName);
  await writeFile(abs, options.markdown, 'utf8');
  return {
    relativePathPosix: completedExecPlanRelativePath(options.fileName),
  };
}
