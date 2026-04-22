import { describe, expect, it } from 'vitest';

import { computeEvalMetrics } from './evals.js';

describe('eval metrics', () => {
  it('computes precision, recall and F1 from positive and negative fixtures', () => {
    const metrics = computeEvalMetrics([
      { id: 'sql-injection', expected: true, actual: true },
      { id: 'hardcoded-secret', expected: true, actual: false },
      { id: 'clean-refactor', expected: false, actual: false },
      { id: 'style-only', expected: false, actual: true },
    ]);

    expect(metrics.truePositive).toBe(1);
    expect(metrics.falseNegative).toBe(1);
    expect(metrics.trueNegative).toBe(1);
    expect(metrics.falsePositive).toBe(1);
    expect(metrics.precision).toBe(0.5);
    expect(metrics.recall).toBe(0.5);
    expect(metrics.f1).toBe(0.5);
  });

  it('returns zero metrics for empty runs', () => {
    expect(computeEvalMetrics([])).toMatchObject({
      precision: 0,
      recall: 0,
      f1: 0,
    });
  });
});
