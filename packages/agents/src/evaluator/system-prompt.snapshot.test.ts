import { describe, expect, it } from 'vitest';

import { resolvedEvaluatorSystemPrompt } from './calibration.js';

describe('Evaluator system prompt (snapshot)', () => {
  it('matches resolved prompt with few-shot calibration', () => {
    expect(resolvedEvaluatorSystemPrompt()).toMatchSnapshot();
  });
});
