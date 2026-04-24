import { describe, expect, it } from 'vitest';

import {
  completedExecPlanRelativePath,
  execPlansActiveDir,
  execPlansCompletedDir,
  feedbackPath,
  handoffPath,
  maestroRoot,
  runCheckpointsDir,
  projectLogPath,
  runContractsDir,
  runFeedbackDir,
  runLogsDir,
  runMetaPath,
  runPlanningDir,
  runPlanPath,
  runPlanSnapshotPath,
  runRoot,
  planningStatePath,
  planningSummaryPath,
  planningTranscriptPath,
  sprintOutcomeCheckpointPath,
  runStatePath,
  runsRoot,
  selfEvalPath,
} from './paths.js';

const opts = { repoRoot: '/repo', runId: 'r1' };

describe('path helpers', () => {
  it('resolves the run root', () => {
    expect(runRoot(opts)).toBe('/repo/.maestro/runs/r1');
  });

  it('resolves the state.json path', () => {
    expect(runStatePath(opts)).toBe('/repo/.maestro/runs/r1/state.json');
  });

  it('resolves the contracts directory', () => {
    expect(runContractsDir(opts)).toBe('/repo/.maestro/runs/r1/contracts');
  });

  it('resolves the handoff file for a sprint', () => {
    expect(handoffPath({ ...opts, sprint: 3 })).toBe(
      '/repo/.maestro/runs/r1/checkpoints/sprint-3-handoff.md',
    );
  });

  it('resolves feedback file per iteration', () => {
    expect(feedbackPath({ ...opts, sprint: 2, iteration: 1 })).toBe(
      '/repo/.maestro/runs/r1/feedback/sprint-2-eval-1.md',
    );
  });

  it('resolves the project log', () => {
    expect(projectLogPath('/repo')).toBe('/repo/.maestro/log.md');
  });

  it('resolves roots with the default maestro directory', () => {
    expect(maestroRoot('/repo')).toBe('/repo/.maestro');
    expect(runsRoot('/repo')).toBe('/repo/.maestro/runs');
  });

  it('resolves roots with a custom maestro directory', () => {
    expect(maestroRoot('/repo', '.custom')).toBe('/repo/.custom');
    expect(runsRoot('/repo', '.custom')).toBe('/repo/.custom/runs');
    expect(projectLogPath('/repo', '.custom')).toBe('/repo/.custom/log.md');
  });

  it('resolves run metadata, plan, logs, checkpoints, and feedback dirs', () => {
    expect(runMetaPath(opts)).toBe('/repo/.maestro/runs/r1/meta.json');
    expect(runPlanPath(opts)).toBe('/repo/.maestro/runs/r1/plan.md');
    expect(runPlanSnapshotPath(opts)).toBe(
      '/repo/.maestro/runs/r1/plan.snapshot.json',
    );
    expect(sprintOutcomeCheckpointPath({ ...opts, sprintOneBased: 2 })).toBe(
      '/repo/.maestro/runs/r1/checkpoints/sprint-2-outcome.json',
    );
    expect(runLogsDir(opts)).toBe('/repo/.maestro/runs/r1/logs');
    expect(runCheckpointsDir(opts)).toBe('/repo/.maestro/runs/r1/checkpoints');
    expect(runFeedbackDir(opts)).toBe('/repo/.maestro/runs/r1/feedback');
    expect(runPlanningDir(opts)).toBe('/repo/.maestro/runs/r1/planning');
  });

  it('resolves self-eval and exec-plan paths', () => {
    expect(selfEvalPath({ ...opts, sprint: 4 })).toBe(
      '/repo/.maestro/runs/r1/checkpoints/sprint-4-self-eval.md',
    );
    expect(execPlansCompletedDir('/repo')).toBe(
      '/repo/.maestro/docs/exec-plans/completed',
    );
    expect(execPlansActiveDir('/repo')).toBe(
      '/repo/.maestro/docs/exec-plans/active',
    );
    expect(completedExecPlanRelativePath('auth-flow.md')).toBe(
      '.maestro/docs/exec-plans/completed/auth-flow.md',
    );
  });

  it('resolves planning interview artifact paths', () => {
    expect(planningTranscriptPath(opts)).toBe(
      '/repo/.maestro/runs/r1/planning/transcript.json',
    );
    expect(planningStatePath(opts)).toBe(
      '/repo/.maestro/runs/r1/planning/state.json',
    );
    expect(planningSummaryPath(opts)).toBe(
      '/repo/.maestro/runs/r1/planning/summary.md',
    );
  });
});
