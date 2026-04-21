import { describe, expect, it } from 'vitest';

import { resolvedArchitectSystemPrompt } from './calibration.js';

describe('Architect system prompt (snapshot)', () => {
  it('matches resolved prompt with few-shot calibration', () => {
    expect(resolvedArchitectSystemPrompt()).toMatchSnapshot();
  });
});
