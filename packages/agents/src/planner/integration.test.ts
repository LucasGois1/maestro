import { describe, expect, it } from 'vitest';

import { SIMPLE } from './fixtures-data.js';
import { isPlannerEscalation } from './plan-output.schema.js';
import { normalizePlannerModelOutput } from './normalize.js';

describe('Planner (integration, deterministic)', () => {
  it('normalizes a one-line-style prompt fixture to ≥2 sprints', () => {
    const raw = SIMPLE.output;
    if (isPlannerEscalation(raw)) {
      throw new Error('expected success plan');
    }
    const plan = normalizePlannerModelOutput(raw, {
      runId: 'run-int',
      prompt: SIMPLE.input.prompt,
    });
    expect(plan.sprints.length).toBeGreaterThanOrEqual(2);
    expect(plan.feature.length).toBeGreaterThan(0);
    expect(plan.userStories.length).toBeGreaterThanOrEqual(1);
  });
});
