import {
  loadConfig,
  type LoadedConfig,
  type LoadConfigOptions,
} from '@maestro/config';

import { autoResolveAllDefaultModelsWhenSingleProvider } from './credentials.js';

/**
 * Carrega e valida a configuração, depois aplica
 * {@link autoResolveAllDefaultModelsWhenSingleProvider} (rede de segurança para um único provider com chave).
 */
export async function loadConfigWithAutoResolvedModels(
  options?: LoadConfigOptions,
): Promise<LoadedConfig> {
  const loaded = await loadConfig(options);
  return {
    ...loaded,
    resolved:
      autoResolveAllDefaultModelsWhenSingleProvider(loaded.resolved) ??
      loaded.resolved,
  };
}
