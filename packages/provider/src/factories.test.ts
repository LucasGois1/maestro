import { configSchema } from '@maestro/config';
import { describe, expect, it } from 'vitest';

import { createLanguageModel, MissingApiKeyError } from './factories.js';

function configWith(overrides: Record<string, unknown> = {}) {
  return configSchema.parse({
    providers: overrides,
  });
}

describe('createLanguageModel', () => {
  it('builds an Anthropic model when key is present', () => {
    const model = createLanguageModel(
      'anthropic',
      'claude-haiku-4-5',
      configWith({ anthropic: { apiKey: 'sk-test' } }),
    );
    expect(model.provider).toMatch(/anthropic/);
    expect(model.modelId).toBe('claude-haiku-4-5');
  });

  it('builds an OpenAI model when key is present', () => {
    const model = createLanguageModel(
      'openai',
      'gpt-5-nano',
      configWith({ openai: { apiKey: 'sk-test' } }),
    );
    expect(model.provider).toMatch(/openai/);
    expect(model.modelId).toBe('gpt-5-nano');
  });

  it('builds a Google model when key is present', () => {
    const model = createLanguageModel(
      'google',
      'gemini-3-flash',
      configWith({ google: { apiKey: 'sk-test' } }),
    );
    expect(model.provider).toMatch(/google/);
    expect(model.modelId).toBe('gemini-3-flash');
  });

  it('builds an Ollama model without a key (local)', () => {
    const model = createLanguageModel('ollama', 'llama3.3', configWith());
    expect(model.provider).toMatch(/ollama/);
    expect(model.modelId).toBe('llama3.3');
  });

  it('throws MissingApiKeyError when the cloud provider key is absent', () => {
    expect(() =>
      createLanguageModel('anthropic', 'claude-haiku-4-5', configWith()),
    ).toThrow(MissingApiKeyError);
    expect(() => createLanguageModel('openai', 'gpt-5', configWith())).toThrow(
      MissingApiKeyError,
    );
    expect(() =>
      createLanguageModel('google', 'gemini-3-pro', configWith()),
    ).toThrow(MissingApiKeyError);
  });
});
