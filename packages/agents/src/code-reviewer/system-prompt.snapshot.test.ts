import { describe, expect, it } from 'vitest';

import { resolvedCodeReviewerSystemPrompt } from './calibration.js';

describe('Code Reviewer system prompt (snapshot)', () => {
  it('matches resolved prompt with few-shot calibration', () => {
    expect(resolvedCodeReviewerSystemPrompt()).toMatchSnapshot();
  });
});
