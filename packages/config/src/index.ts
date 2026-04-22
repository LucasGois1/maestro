export const CONFIG_PACKAGE_NAME = '@maestro/config';

export {
  AGENT_NAMES,
  BRANCHING_STRATEGIES,
  configSchema,
  DEFAULT_CONFIG,
  PERMISSION_MODES,
  PROVIDER_NAMES,
  type AgentName,
  type BackgroundConfig,
  type BranchingStrategy,
  type MaestroConfig,
  type MaestroConfigInput,
  type PermissionMode,
  type ProviderName,
} from './schema.js';

export {
  CONFIG_FILE_NAME,
  MAESTRO_DIR_NAME,
  resolveConfigPaths,
  type ConfigPaths,
} from './paths.js';

export { deepMerge, deepMergeAll, isPlainObject } from './merge.js';

export {
  buildEnvOverlay,
  ENV_PREFIX,
  OLLAMA_BASE_URL_ENV_VAR,
  PROVIDER_KEY_ENV_VARS,
  providerCredentialEnvVar,
} from './env.js';

export { isSecretPath, maskSecrets, MASK_PLACEHOLDER } from './mask.js';

export { coerceScalar, getByPath, setByPath } from './accessor.js';

export {
  ConfigParseError,
  ConfigValidationError,
  loadConfig,
  readConfigFile,
  writeConfigFile,
  type LoadConfigOptions,
  type LoadedConfig,
  type LoadedSource,
} from './loader.js';
