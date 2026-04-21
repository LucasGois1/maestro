import { describe, expect, it } from 'vitest';

import { resolvedPlannerSystemPrompt } from './calibration.js';

describe('Planner system prompt (snapshot)', () => {
  it('matches resolved prompt with few-shot calibration', () => {
    expect(resolvedPlannerSystemPrompt()).toMatchSnapshot();
  });
});
