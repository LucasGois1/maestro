import { describe, expect, it } from 'vitest';

import { resolvedMergerSystemPrompt } from './calibration.js';

describe('Merger system prompt (snapshot)', () => {
  it('matches resolved prompt with few-shot calibration', () => {
    expect(resolvedMergerSystemPrompt()).toMatchSnapshot();
  });
});
