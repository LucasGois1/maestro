import { configSchema } from '@maestro/config';
import { describe, expect, it, vi } from 'vitest';

import { getModel } from './get-model.js';

const config = configSchema.parse({
  providers: {
    anthropic: { apiKey: 'sk-anthropic' },
    openai: { apiKey: 'sk-openai' },
    google: { apiKey: 'sk-google' },
  },
});

describe('getModel', () => {
  it('returns a language model for each provider ref', () => {
    const anthropic = getModel('anthropic/claude-haiku-4-5', { config });
    const openai = getModel('openai/gpt-5-nano', { config });
    const google = getModel('google/gemini-3-flash', { config });
    const ollama = getModel('ollama/llama3.3', { config });

    expect(anthropic.modelId).toBe('claude-haiku-4-5');
    expect(openai.modelId).toBe('gpt-5-nano');
    expect(google.modelId).toBe('gemini-3-flash');
    expect(ollama.modelId).toBe('llama3.3');
  });

  it('wraps with the observability middleware when onEvent is provided', () => {
    const onEvent = vi.fn();
    const model = getModel('anthropic/claude-haiku-4-5', { config, onEvent });
    expect(typeof model.doGenerate).toBe('function');
  });

  it('uses DEFAULT_CONFIG providers when no config is passed', () => {
    expect(() => getModel('ollama/llama3.3')).not.toThrow();
    expect(() => getModel('anthropic/claude-haiku-4-5')).toThrow(/apiKey/);
  });
});
