import { describe, expect, it } from 'vitest';

import { resolvedDocGardenerSystemPrompt } from './calibration.js';

describe('Doc Gardener system prompt snapshot', () => {
  it('matches resolved prompt with calibration', () => {
    expect(resolvedDocGardenerSystemPrompt()).toMatchSnapshot();
  });
});
