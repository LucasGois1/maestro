import { describe, expect, it } from 'vitest';

import { InvalidModelRefError, parseModelRef } from './ref.js';

describe('parseModelRef', () => {
  it('parses a provider/model ref', () => {
    expect(parseModelRef('anthropic/claude-opus-4-7')).toEqual({
      provider: 'anthropic',
      modelId: 'claude-opus-4-7',
    });
    expect(parseModelRef('openai/gpt-5')).toEqual({
      provider: 'openai',
      modelId: 'gpt-5',
    });
    expect(parseModelRef('google/gemini-3-pro')).toEqual({
      provider: 'google',
      modelId: 'gemini-3-pro',
    });
    expect(parseModelRef('ollama/llama3.3')).toEqual({
      provider: 'ollama',
      modelId: 'llama3.3',
    });
  });

  it('preserves slashes inside modelId', () => {
    expect(parseModelRef('anthropic/claude-3/experimental').modelId).toBe(
      'claude-3/experimental',
    );
  });

  it('rejects refs without a slash', () => {
    expect(() => parseModelRef('gpt-5')).toThrow(InvalidModelRefError);
  });

  it('rejects unknown providers', () => {
    expect(() => parseModelRef('cohere/command-r')).toThrow(/Unknown provider/);
  });

  it('rejects empty modelId', () => {
    expect(() => parseModelRef('openai/')).toThrow(InvalidModelRefError);
  });
});
