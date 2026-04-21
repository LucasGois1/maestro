export const PROVIDER_PACKAGE_NAME = '@maestro/provider';

export { getModel, type GetModelOptions } from './get-model.js';
export { createLanguageModel, MissingApiKeyError } from './factories.js';
export {
  autoResolveDiscoveryModelConfig,
  canUseProviderForInference,
  defaultDiscoveryModelProvider,
  DISCOVERY_MODEL_DEFAULTS,
  hasApiKey,
  hasOllamaBaseUrl,
  listInferenceReadyProviders,
  withDiscoveryAgentModel,
} from './credentials.js';
export { InvalidModelRefError, parseModelRef, type ModelRef } from './ref.js';
export {
  createObservabilityMiddleware,
  type ProviderEvent,
  type ProviderEventListener,
  type ProviderOperation,
} from './observability.js';

export {
  generateObject,
  generateText,
  hasToolCall,
  stepCountIs,
  streamObject,
  streamText,
  tool,
  ToolLoopAgent,
  wrapLanguageModel,
} from 'ai';
