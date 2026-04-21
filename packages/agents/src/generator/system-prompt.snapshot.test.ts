import { describe, expect, it } from 'vitest';

import { resolvedGeneratorSystemPrompt } from './calibration.js';

describe('Generator system prompt (snapshot)', () => {
  it('matches resolved prompt with few-shot calibration', () => {
    expect(resolvedGeneratorSystemPrompt()).toMatchSnapshot();
  });
});
