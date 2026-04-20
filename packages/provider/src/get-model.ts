import { DEFAULT_CONFIG, type MaestroConfig } from '@maestro/config';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { wrapLanguageModel } from 'ai';

import { createLanguageModel } from './factories.js';
import {
  createObservabilityMiddleware,
  type ProviderEventListener,
} from './observability.js';
import { parseModelRef } from './ref.js';

export type GetModelOptions = {
  readonly config?: MaestroConfig;
  readonly onEvent?: ProviderEventListener;
};

export function getModel(
  ref: string,
  options: GetModelOptions = {},
): LanguageModelV3 {
  const { provider, modelId } = parseModelRef(ref);
  const config = options.config ?? DEFAULT_CONFIG;
  const base = createLanguageModel(provider, modelId, config);

  if (!options.onEvent) {
    return base;
  }

  return wrapLanguageModel({
    model: base,
    middleware: createObservabilityMiddleware(options.onEvent),
  });
}
