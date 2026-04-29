import { describe, expect, it } from 'vitest';

import { resolvedPlannerSystemPrompt } from './calibration.js';

describe('Planner system prompt (snapshot)', () => {
  it('matches resolved prompt with few-shot calibration', () => {
    expect(resolvedPlannerSystemPrompt()).toMatchSnapshot();
  });

  it('keeps interview questions focused on product and deliverable, not delivery process', () => {
    const prompt = resolvedPlannerSystemPrompt();

    expect(prompt).toContain('Do not ask about commit messages');
    expect(prompt).toContain('PR descriptions');
    expect(prompt).toContain('branch names');
    expect(prompt).toContain('release process');
    expect(prompt).toContain('Ask about deadlines only when timing changes product scope');
  });
});
