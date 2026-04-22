import { describe, expect, it } from 'vitest';

import { plannerInputSchema } from './planner-input.schema.js';

describe('plannerInputSchema', () => {
  it('accepts prompt-only input', () => {
    const parsed = plannerInputSchema.parse({ prompt: 'Ship auth' });
    expect(parsed.replan).toBeUndefined();
  });

  it('accepts prompt with replan context', () => {
    const parsed = plannerInputSchema.parse({
      prompt: 'Ship auth',
      replan: {
        attempt: 1,
        blockedSprintIdx: 0,
        blockedSprintName: 'Sprint 1',
        blockedSprintObjective: 'Too broad',
        boundaryCheck: 'refactor_needed',
        previousPlanSummary: 'Sprint 1 — A: x',
        boundaryNotes: 'Narrow scope',
      },
    });
    expect(parsed.replan?.attempt).toBe(1);
    expect(parsed.replan?.escalationReason).toBeUndefined();
  });
});
