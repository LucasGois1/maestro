export const PROVIDER_PACKAGE_NAME = '@maestro/provider';

export { loadConfigWithAutoResolvedModels } from './load-config-resolved.js';
export { getModel, type GetModelOptions } from './get-model.js';
export { createLanguageModel, MissingApiKeyError } from './factories.js';
export {
  allDefaultModelProvidersReady,
  autoResolveAllDefaultModelsWhenSingleProvider,
  autoResolveDiscoveryModelConfig,
  canUseProviderForInference,
  defaultDiscoveryModelProvider,
  DISCOVERY_MODEL_DEFAULTS,
  hasApiKey,
  hasOllamaBaseUrl,
  listInferenceReadyProviders,
  withDiscoveryAgentModel,
} from './credentials.js';
export {
  applyModelStackToConfig,
  BALANCED_MODEL_STACK_BY_PROVIDER,
  GOOGLE_MODEL_STACK_BALANCED,
  GOOGLE_MODEL_STACK_CAPABLE,
  GOOGLE_MODEL_STACK_EFFICIENT,
  LEGACY_SCHEMA_ANTHROPIC_STACK,
  modelStackForProviderTier,
  OLLAMA_MODEL_STACK_BALANCED,
  OPENAI_MODEL_STACK_BALANCED,
  OPENAI_MODEL_STACK_CAPABLE,
  OPENAI_MODEL_STACK_EFFICIENT,
  type ModelPresetTier,
} from './curated-model-presets.js';
export {
  INIT_PICKER_MODELS,
  initPickerChoicesFor,
  type InitPickerModelChoice,
} from './init-picker-models.js';
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
