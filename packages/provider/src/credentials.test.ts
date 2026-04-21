import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG, type MaestroConfig } from '@maestro/config';

import {
  autoResolveDiscoveryModelConfig,
  canUseProviderForInference,
  DISCOVERY_MODEL_DEFAULTS,
  listInferenceReadyProviders,
  withDiscoveryAgentModel,
} from './credentials.js';

function cfg(partial: Partial<MaestroConfig>): MaestroConfig {
  return { ...DEFAULT_CONFIG, ...partial };
}

describe('credentials', () => {
  it('detects API keys for cloud providers', () => {
    const c = cfg({
      providers: {
        ...DEFAULT_CONFIG.providers,
        openai: { apiKey: 'sk-test' },
      },
    });
    expect(canUseProviderForInference(c, 'openai')).toBe(true);
    expect(canUseProviderForInference(c, 'anthropic')).toBe(false);
  });

  it('autoResolve switches model when default provider has no key but another does', () => {
    const c = cfg({
      providers: {
        ...DEFAULT_CONFIG.providers,
        openai: { apiKey: 'sk-test' },
      },
    });
    const next = autoResolveDiscoveryModelConfig(c);
    expect(next).not.toBeNull();
    expect(next?.defaults.discovery.model).toBe(DISCOVERY_MODEL_DEFAULTS.openai);
  });

  it('autoResolve returns null when the default provider lacks a key and several others are configured', () => {
    const c = cfg({
      providers: {
        ...DEFAULT_CONFIG.providers,
        anthropic: {},
        openai: { apiKey: 'a' },
        google: { apiKey: 'b' },
      },
    });
    expect(autoResolveDiscoveryModelConfig(c)).toBeNull();
    expect(listInferenceReadyProviders(c).length).toBeGreaterThanOrEqual(2);
  });

  it('withDiscoveryAgentModel updates only discovery default model', () => {
    const next = withDiscoveryAgentModel(
      DEFAULT_CONFIG,
      'openai/gpt-4o-mini',
    );
    expect(next.defaults.discovery.model).toBe('openai/gpt-4o-mini');
    expect(next.defaults.planner.model).toBe(DEFAULT_CONFIG.defaults.planner.model);
  });
});
