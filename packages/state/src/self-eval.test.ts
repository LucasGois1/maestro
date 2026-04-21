import { describe, expect, it } from 'vitest';

import { renderSelfEvalMarkdown } from './self-eval.js';

describe('renderSelfEvalMarkdown', () => {
  it('renders criteria and concerns', () => {
    const md = renderSelfEvalMarkdown({
      coversAllCriteria: false,
      missingCriteria: ['Test X'],
      concerns: ['Risk Y'],
    });
    expect(md).toContain('**Covers all criteria:** no');
    expect(md).toContain('Test X');
    expect(md).toContain('Risk Y');
  });
});
