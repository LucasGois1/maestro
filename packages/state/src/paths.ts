import { join } from 'node:path';

export const MAESTRO_DIR = '.maestro';
/** Subárvore `docs/exec-plans` dentro de `.maestro/`. */
export const EXEC_PLANS_RELATIVE_SEGMENTS = ['docs', 'exec-plans'] as const;
export const RUNS_DIR = 'runs';
export const CONTRACTS_DIR = 'contracts';
export const CHECKPOINTS_DIR = 'checkpoints';
export const LOGS_DIR = 'logs';
export const FEEDBACK_DIR = 'feedback';

export const STATE_FILE = 'state.json';
export const META_FILE = 'meta.json';
export const PLAN_FILE = 'plan.md';
/** Snapshot JSON do `PlannerOutput` normalizado (retomada sem re-planear). */
export const PLAN_SNAPSHOT_FILE = 'plan.snapshot.json';
export const PROJECT_LOG_FILE = 'log.md';

export type RunPathOptions = {
  readonly repoRoot: string;
  readonly runId: string;
  readonly maestroDir?: string;
};

export function maestroRoot(repoRoot: string, dirOverride?: string): string {
  return join(repoRoot, dirOverride ?? MAESTRO_DIR);
}

export function runsRoot(repoRoot: string, dirOverride?: string): string {
  return join(maestroRoot(repoRoot, dirOverride), RUNS_DIR);
}

export function runRoot(opts: RunPathOptions): string {
  return join(runsRoot(opts.repoRoot, opts.maestroDir), opts.runId);
}

export function runStatePath(opts: RunPathOptions): string {
  return join(runRoot(opts), STATE_FILE);
}

export function runMetaPath(opts: RunPathOptions): string {
  return join(runRoot(opts), META_FILE);
}

export function runPlanPath(opts: RunPathOptions): string {
  return join(runRoot(opts), PLAN_FILE);
}

export function runPlanSnapshotPath(opts: RunPathOptions): string {
  return join(runRoot(opts), PLAN_SNAPSHOT_FILE);
}

export function sprintOutcomeCheckpointPath(
  opts: RunPathOptions & { readonly sprintOneBased: number },
): string {
  return join(
    runCheckpointsDir(opts),
    `sprint-${opts.sprintOneBased.toString()}-outcome.json`,
  );
}

export function runContractsDir(opts: RunPathOptions): string {
  return join(runRoot(opts), CONTRACTS_DIR);
}

export function runCheckpointsDir(opts: RunPathOptions): string {
  return join(runRoot(opts), CHECKPOINTS_DIR);
}

export function runLogsDir(opts: RunPathOptions): string {
  return join(runRoot(opts), LOGS_DIR);
}

export function runFeedbackDir(opts: RunPathOptions): string {
  return join(runRoot(opts), FEEDBACK_DIR);
}

export function handoffPath(opts: RunPathOptions & { sprint: number }): string {
  return join(runCheckpointsDir(opts), `sprint-${opts.sprint}-handoff.md`);
}

export function selfEvalPath(
  opts: RunPathOptions & { sprint: number },
): string {
  return join(runCheckpointsDir(opts), `sprint-${opts.sprint}-self-eval.md`);
}

export function feedbackPath(
  opts: RunPathOptions & { sprint: number; iteration: number },
): string {
  return join(
    runFeedbackDir(opts),
    `sprint-${opts.sprint}-eval-${opts.iteration}.md`,
  );
}

export function projectLogPath(repoRoot: string, dirOverride?: string): string {
  return join(maestroRoot(repoRoot, dirOverride), PROJECT_LOG_FILE);
}

export function execPlansCompletedDir(
  repoRoot: string,
  maestroDir?: string,
): string {
  return join(
    maestroRoot(repoRoot, maestroDir),
    ...EXEC_PLANS_RELATIVE_SEGMENTS,
    'completed',
  );
}

export function execPlansActiveDir(
  repoRoot: string,
  maestroDir?: string,
): string {
  return join(
    maestroRoot(repoRoot, maestroDir),
    ...EXEC_PLANS_RELATIVE_SEGMENTS,
    'active',
  );
}

/** Caminho POSIX relativo à raiz do repo (ex.: `.maestro/docs/exec-plans/completed/foo.md`). */
export function completedExecPlanRelativePath(fileName: string): string {
  return [
    MAESTRO_DIR,
    ...EXEC_PLANS_RELATIVE_SEGMENTS,
    'completed',
    fileName,
  ].join('/');
}
