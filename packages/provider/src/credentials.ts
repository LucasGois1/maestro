import {
  AGENT_NAMES,
  PROVIDER_NAMES,
  type MaestroConfig,
  type ProviderName,
} from '@maestro/config';

import {
  applyModelStackToConfig,
  BALANCED_MODEL_STACK_BY_PROVIDER,
} from './curated-model-presets.js';
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

/** True when every `defaults.<agent>.model` provider has credentials (or Ollama URL). */
export function allDefaultModelProvidersReady(config: MaestroConfig): boolean {
  for (const name of AGENT_NAMES) {
    const model = config.defaults[name]?.model;
    if (typeof model !== 'string' || model.length === 0) {
      return false;
    }
    const { provider } = parseModelRef(model);
    if (!canUseProviderForInference(config, provider)) {
      return false;
    }
  }
  return true;
}

/**
 * When exactly one inference provider is credentialed and at least one default
 * model still points at an unusable provider, rewrite all agent defaults to
 * the balanced stack for that provider (same spirit as discovery auto-resolve).
 */
export function autoResolveAllDefaultModelsWhenSingleProvider(
  config: MaestroConfig,
): MaestroConfig | null {
  const ready = listInferenceReadyProviders(config);
  if (ready.length !== 1) {
    return null;
  }
  if (allDefaultModelProvidersReady(config)) {
    return null;
  }
  const only = ready[0];
  if (only === undefined) {
    return null;
  }
  const stack = BALANCED_MODEL_STACK_BY_PROVIDER[only];
  return applyModelStackToConfig(config, stack);
}
