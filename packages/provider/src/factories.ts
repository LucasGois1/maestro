import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { MaestroConfig, ProviderName } from '@maestro/config';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { createOllama } from 'ai-sdk-ollama';

export class MissingApiKeyError extends Error {
  constructor(public readonly provider: ProviderName) {
    super(
      `Provider "${provider}" requires an API key. Set ${envVarFor(provider)} or providers.${provider}.apiKey in config.json.`,
    );
    this.name = 'MissingApiKeyError';
  }
}

function envVarFor(provider: ProviderName): string {
  switch (provider) {
    case 'anthropic':
      return 'MAESTRO_ANTHROPIC_KEY';
    case 'openai':
      return 'MAESTRO_OPENAI_KEY';
    case 'google':
      return 'MAESTRO_GOOGLE_KEY';
    case 'ollama':
      return 'MAESTRO_OLLAMA_BASE_URL';
  }
}

export function createLanguageModel(
  provider: ProviderName,
  modelId: string,
  config: MaestroConfig,
): LanguageModelV3 {
  switch (provider) {
    case 'anthropic':
      return createAnthropicModel(modelId, config);
    case 'openai':
      return createOpenAIModel(modelId, config);
    case 'google':
      return createGoogleModel(modelId, config);
    case 'ollama':
      return createOllamaModel(modelId, config);
  }
}

function createAnthropicModel(
  modelId: string,
  config: MaestroConfig,
): LanguageModelV3 {
  const apiKey = config.providers.anthropic.apiKey?.trim();
  if (!apiKey) throw new MissingApiKeyError('anthropic');
  return createAnthropic({ apiKey })(modelId);
}

function createOpenAIModel(
  modelId: string,
  config: MaestroConfig,
): LanguageModelV3 {
  const apiKey = config.providers.openai.apiKey?.trim();
  if (!apiKey) throw new MissingApiKeyError('openai');
  return createOpenAI({ apiKey })(modelId);
}

function createGoogleModel(
  modelId: string,
  config: MaestroConfig,
): LanguageModelV3 {
  const apiKey = config.providers.google.apiKey?.trim();
  if (!apiKey) throw new MissingApiKeyError('google');
  return createGoogleGenerativeAI({ apiKey })(modelId);
}

function createOllamaModel(
  modelId: string,
  config: MaestroConfig,
): LanguageModelV3 {
  return createOllama({ baseURL: config.providers.ollama.baseUrl })(modelId);
}
