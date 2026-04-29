import { describe, expect, it } from 'vitest';

import { resolvedMergerSystemPrompt } from './calibration.js';

describe('Merger system prompt (snapshot)', () => {
  it('matches resolved prompt with few-shot calibration', () => {
    expect(resolvedMergerSystemPrompt()).toMatchSnapshot();
  });

  it('requires specialized merge tools instead of raw shell branch handling', () => {
    const prompt = resolvedMergerSystemPrompt();

    expect(prompt).toContain('Use getMergeContext');
    expect(prompt).toContain('openPullRequest');
    expect(prompt).toContain('Never derive, rewrite, shorten, or invent branch');
    expect(prompt).toContain('Do not use raw shell commands');
  });
});
