import { describe, expect, it } from 'vitest';

import { collectAssistantTextFromToolLoopResult } from './tool-loop-text.js';

describe('collectAssistantTextFromToolLoopResult', () => {
  it('uses top-level text when the last step produced assistant text', () => {
    expect(
      collectAssistantTextFromToolLoopResult({
        text: '{"a":1}',
        steps: [{ text: 'old' }, { text: '' }],
      }),
    ).toBe('{"a":1}');
  });

  it('falls back to the latest prior step when the last step text is empty', () => {
    expect(
      collectAssistantTextFromToolLoopResult({
        text: '',
        steps: [
          { text: '' },
          { text: '{"plan":true}' },
          { text: '' },
        ],
      }),
    ).toBe('{"plan":true}');
  });

  it('returns empty string when no step has assistant text', () => {
    expect(
      collectAssistantTextFromToolLoopResult({
        text: '  ',
        steps: [{ text: '' }, { text: '\n' }],
      }),
    ).toBe('');
  });
});
