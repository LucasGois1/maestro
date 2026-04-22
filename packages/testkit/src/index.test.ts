import { describe, expect, it } from 'vitest';

import {
  createGitFixture,
  createMockTextModel,
  createVcr,
  computeEvalMetrics,
} from './index.js';

describe('@maestro/testkit exports', () => {
  it('exports the public DSFT-97 helpers', () => {
    expect(typeof createGitFixture).toBe('function');
    expect(typeof createMockTextModel).toBe('function');
    expect(typeof createVcr).toBe('function');
    expect(typeof computeEvalMetrics).toBe('function');
  });
});
