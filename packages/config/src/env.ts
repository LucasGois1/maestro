import type { MaestroConfigInput, ProviderName } from './schema.js';

export const ENV_PREFIX = 'MAESTRO_';

/** Variáveis de ambiente para API keys por provider (CLI / docs). */
export const PROVIDER_KEY_ENV_VARS = {
  anthropic: 'MAESTRO_ANTHROPIC_KEY',
  openai: 'MAESTRO_OPENAI_KEY',
  google: 'MAESTRO_GOOGLE_KEY',
} as const;

export const OLLAMA_BASE_URL_ENV_VAR = 'MAESTRO_OLLAMA_BASE_URL';

/** Nome da variável de ambiente para credenciais ou URL (Ollama). */
export function providerCredentialEnvVar(provider: ProviderName): string {
  if (provider === 'ollama') {
    return OLLAMA_BASE_URL_ENV_VAR;
  }
  if (provider === 'anthropic') {
    return PROVIDER_KEY_ENV_VARS.anthropic;
  }
  if (provider === 'openai') {
    return PROVIDER_KEY_ENV_VARS.openai;
  }
  return PROVIDER_KEY_ENV_VARS.google;
}

export function buildEnvOverlay(
  env: NodeJS.ProcessEnv = process.env,
): MaestroConfigInput {
  const providers: MaestroConfigInput['providers'] = {};

  for (const [providerName, envVar] of Object.entries(PROVIDER_KEY_ENV_VARS)) {
    const value = env[envVar];
    if (value && value.length > 0) {
      providers[providerName as keyof typeof PROVIDER_KEY_ENV_VARS] = {
        apiKey: value,
      };
    }
  }

  const ollamaBaseUrl = env[OLLAMA_BASE_URL_ENV_VAR];
  if (ollamaBaseUrl && ollamaBaseUrl.length > 0) {
    providers.ollama = { baseUrl: ollamaBaseUrl };
  }

  if (Object.keys(providers).length === 0) {
    return {};
  }

  return { providers };
}
