import { describe, expect, it } from 'vitest';

import { isSecretPath, MASK_PLACEHOLDER, maskSecrets } from './mask.js';

describe('maskSecrets', () => {
  it('masks apiKey values at any depth', () => {
    const result = maskSecrets({
      providers: {
        anthropic: { apiKey: 'sk-real' },
        openai: { apiKey: 'sk-other' },
        ollama: { baseUrl: 'http://localhost:11434' },
      },
    });
    expect(result.providers.anthropic.apiKey).toBe(MASK_PLACEHOLDER);
    expect(result.providers.openai.apiKey).toBe(MASK_PLACEHOLDER);
    expect(result.providers.ollama.baseUrl).toBe('http://localhost:11434');
  });

  it('leaves empty apiKey unchanged (nothing to hide)', () => {
    expect(maskSecrets({ anthropic: { apiKey: '' } })).toEqual({
      anthropic: { apiKey: '' },
    });
  });

  it('handles arrays and primitives', () => {
    expect(maskSecrets([{ token: 'abc' }, 'plain', 42])).toEqual([
      { token: MASK_PLACEHOLDER },
      'plain',
      42,
    ]);
  });

  it('does not mutate its input', () => {
    const input = { providers: { anthropic: { apiKey: 'sk' } } };
    maskSecrets(input);
    expect(input.providers.anthropic.apiKey).toBe('sk');
  });
});

describe('isSecretPath', () => {
  it('identifies secret leaves', () => {
    expect(isSecretPath('providers.anthropic.apiKey')).toBe(true);
    expect(isSecretPath('providers.ollama.baseUrl')).toBe(false);
  });
});
