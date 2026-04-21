import { describe, expect, it } from 'vitest';

import { generatorModelOutputSchema } from './generator-output.schema.js';

describe('generatorModelOutputSchema', () => {
  it('accepts conventional commit messages', () => {
    const out = generatorModelOutputSchema.parse({
      sprintIdx: 1,
      filesChanged: [{ path: 'a.ts', changeType: 'added' }],
      commits: [{ sha: 'abc', message: 'feat(scope): subject line' }],
      selfEval: {
        coversAllCriteria: true,
        missingCriteria: [],
        concerns: [],
      },
      handoffNotes: 'ok',
    });
    expect(out.commits[0]?.message).toContain('feat');
  });

  it('rejects non-conventional commit messages', () => {
    expect(() =>
      generatorModelOutputSchema.parse({
        sprintIdx: 1,
        filesChanged: [],
        commits: [{ sha: 'abc', message: 'random text without prefix' }],
        selfEval: {
          coversAllCriteria: true,
          missingCriteria: [],
          concerns: [],
        },
        handoffNotes: 'x',
      }),
    ).toThrow();
  });
});
