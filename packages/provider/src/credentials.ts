import {
  PROVIDER_NAMES,
  type MaestroConfig,
  type ProviderName,
} from '@maestro/config';

import { parseModelRef } from './ref.js';

/** Suggested `provider/model` refs for the discovery agent when switching provider. */
export const DISCOVERY_MODEL_DEFAULTS: Readonly<Record<ProviderName, string>> =
  {
    anthropic: 'anthropic/claude-sonnet-4-6',
    openai: 'openai/gpt-4o-mini',
    google: 'google/gemini-2.0-flash',
    ollama: 'ollama/llama3.2',
  };

export function hasApiKey(
  config: MaestroConfig,
  provider: 'anthropic' | 'openai' | 'google',
): boolean {
  const key = config.providers[provider].apiKey;
  return typeof key === 'string' && key.trim().length > 0;
}

export function hasOllamaBaseUrl(config: MaestroConfig): boolean {
  return Boolean(config.providers.ollama.baseUrl?.trim());
}

/**
 * Whether the merged config can call `createLanguageModel` for this provider
 * (API key for cloud; Ollama only needs a base URL, which defaults).
 */
export function canUseProviderForInference(
  config: MaestroConfig,
  provider: ProviderName,
): boolean {
  if (provider === 'ollama') {
    return hasOllamaBaseUrl(config);
  }
  return hasApiKey(config, provider);
}

export function listInferenceReadyProviders(
  config: MaestroConfig,
): readonly ProviderName[] {
  return PROVIDER_NAMES.filter((p) => canUseProviderForInference(config, p));
}

export function defaultDiscoveryModelProvider(
  config: MaestroConfig,
): ProviderName {
  return parseModelRef(config.defaults.discovery.model).provider;
}

/**
 * If the configured discovery model's provider is usable, returns `config`.
 * Otherwise picks a single **cloud** provider when unambiguous; if none, falls
 * back to Ollama when it is the only option. Returns `null` when ambiguous.
 */
export function autoResolveDiscoveryModelConfig(
  config: MaestroConfig,
): MaestroConfig | null {
  const target = defaultDiscoveryModelProvider(config);
  if (canUseProviderForInference(config, target)) {
    return config;
  }
  const cloudReady = PROVIDER_NAMES.filter(
    (p) => p !== 'ollama' && canUseProviderForInference(config, p),
  );
  if (cloudReady.length === 1) {
    const only = cloudReady[0];
    if (only !== undefined) {
      return withDiscoveryAgentModel(config, DISCOVERY_MODEL_DEFAULTS[only]);
    }
  }
  if (cloudReady.length === 0 && canUseProviderForInference(config, 'ollama')) {
    return withDiscoveryAgentModel(config, DISCOVERY_MODEL_DEFAULTS.ollama);
  }
  return null;
}

export function withDiscoveryAgentModel(
  config: MaestroConfig,
  modelRef: string,
): MaestroConfig {
  return {
    ...config,
    defaults: {
      ...config.defaults,
      discovery: {
        ...config.defaults.discovery,
        model: modelRef,
      },
    },
  };
}
