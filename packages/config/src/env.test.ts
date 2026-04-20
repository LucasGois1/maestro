import { describe, expect, it } from 'vitest';

import { buildEnvOverlay } from './env.js';

describe('buildEnvOverlay', () => {
  it('returns empty overlay when no env vars are set', () => {
    expect(buildEnvOverlay({})).toEqual({});
  });

  it('maps MAESTRO_*_KEY to provider apiKey', () => {
    const overlay = buildEnvOverlay({
      MAESTRO_ANTHROPIC_KEY: 'sk-anthropic',
      MAESTRO_OPENAI_KEY: 'sk-openai',
      MAESTRO_GOOGLE_KEY: 'sk-google',
    });
    expect(overlay).toEqual({
      providers: {
        anthropic: { apiKey: 'sk-anthropic' },
        openai: { apiKey: 'sk-openai' },
        google: { apiKey: 'sk-google' },
      },
    });
  });

  it('maps MAESTRO_OLLAMA_BASE_URL to ollama.baseUrl', () => {
    expect(buildEnvOverlay({ MAESTRO_OLLAMA_BASE_URL: 'http://other:11434' }))
      .toEqual({ providers: { ollama: { baseUrl: 'http://other:11434' } } });
  });

  it('ignores empty env values', () => {
    expect(buildEnvOverlay({ MAESTRO_ANTHROPIC_KEY: '' })).toEqual({});
  });
});
