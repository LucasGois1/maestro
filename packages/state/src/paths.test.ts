import { describe, expect, it } from 'vitest';

import {
  feedbackPath,
  handoffPath,
  projectLogPath,
  runContractsDir,
  runRoot,
  runStatePath,
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
});
