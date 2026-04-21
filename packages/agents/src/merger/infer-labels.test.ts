import { describe, expect, it } from 'vitest';

import { inferLabelsFromPaths } from './infer-labels.js';

describe('inferLabelsFromPaths', () => {
  it('infers backend and frontend from typical monorepo paths', () => {
    expect(
      inferLabelsFromPaths([
        'packages/backend/src/api.ts',
        'apps/web/src/app/page.tsx',
      ]),
    ).toEqual(['backend', 'frontend']);
  });

  it('returns empty array when no heuristic matches', () => {
    expect(inferLabelsFromPaths(['foo/bar.txt'])).toEqual([]);
  });
});
