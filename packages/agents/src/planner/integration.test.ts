import { describe, expect, it } from 'vitest';

import { NARROW_DELIVERY, SIMPLE } from './fixtures-data.js';
import { isPlannerEscalation } from './plan-output.schema.js';
import { normalizePlannerModelOutput } from './normalize.js';

describe('Planner (integration, deterministic)', () => {
  it('normalizes a multi-sprint product fixture', () => {
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

  it('normalizes a single-sprint narrow-delivery fixture', () => {
    const raw = NARROW_DELIVERY.output;
    if (isPlannerEscalation(raw)) {
      throw new Error('expected success plan');
    }
    const plan = normalizePlannerModelOutput(raw, {
      runId: 'run-int-2',
      prompt: NARROW_DELIVERY.input.prompt,
    });
    expect(plan.sprints).toHaveLength(1);
    expect(plan.feature.length).toBeGreaterThan(0);
    expect(plan.userStories).toHaveLength(1);
  });
});
