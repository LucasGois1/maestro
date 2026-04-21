import type { MaestroConfig, ProviderName } from '@maestro/config';
import { PROVIDER_NAMES } from '@maestro/config';
import {
  autoResolveDiscoveryModelConfig,
  canUseProviderForInference,
  DISCOVERY_MODEL_DEFAULTS,
  hasApiKey,
  hasOllamaBaseUrl,
  withDiscoveryAgentModel,
} from '@maestro/provider';
import {
  ListPickerScreen,
  resolveColorMode,
  type ListPickerItem,
} from '@maestro/tui';
import { render } from 'ink';
import { createElement } from 'react';

function providerLabel(p: ProviderName): string {
  switch (p) {
    case 'anthropic':
      return 'Anthropic';
    case 'openai':
      return 'OpenAI';
    case 'google':
      return 'Google';
    case 'ollama':
      return 'Ollama (local)';
    default:
      return p;
  }
}

function buildPickerItems(config: MaestroConfig): ListPickerItem[] {
  const items: ListPickerItem[] = [];
  for (const p of PROVIDER_NAMES) {
    if (p === 'ollama') {
      continue;
    }
    if (hasApiKey(config, p)) {
      items.push({
        key: p,
        title: `${providerLabel(p)} — API key configured`,
        subtitle: `Model: ${DISCOVERY_MODEL_DEFAULTS[p]}`,
      });
    }
  }
  if (hasOllamaBaseUrl(config)) {
    items.push({
      key: 'ollama',
      title: `${providerLabel('ollama')}`,
      subtitle: `Endpoint ${config.providers.ollama.baseUrl} · ${DISCOVERY_MODEL_DEFAULTS.ollama}`,
    });
  }
  items.push({
    key: 'skip',
    title: 'Skip AI — repository scan only (no generated docs)',
    subtitle: 'Same as maestro init --no-ai',
  });
  return items;
}

function initialPickerIndex(
  config: MaestroConfig,
  items: readonly ListPickerItem[],
): number {
  const firstReady = items.findIndex(
    (it) =>
      it.key !== 'skip' &&
      canUseProviderForInference(config, it.key as ProviderName),
  );
  return firstReady >= 0 ? firstReady : 0;
}

export type DiscoveryProviderSetupResult =
  | { readonly kind: 'proceed'; readonly config: MaestroConfig }
  | { readonly kind: 'skip-ai' };

/**
 * When the default discovery model is unreachable (missing API key), prompts for
 * another provider using Ink, or offers skipping inferential discovery.
 */
export async function runDiscoveryProviderSetupInk(options: {
  readonly config: MaestroConfig;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<DiscoveryProviderSetupResult> {
  const env = options.env ?? process.env;
  const colorMode = resolveColorMode({ args: [], env });

  const auto = autoResolveDiscoveryModelConfig(options.config);
  if (auto !== null) {
    return { kind: 'proceed', config: auto };
  }

  const items = buildPickerItems(options.config);
  const initialIndex = initialPickerIndex(options.config, items);

  return await new Promise<DiscoveryProviderSetupResult>((resolve) => {
    const ink = render(
      createElement(ListPickerScreen, {
        title: 'Discovery — choose model provider',
        description:
          'The default discovery model uses a provider that has no credentials in this environment. Select which provider should run the discovery agent, or skip AI.',
        items,
        initialIndex,
        colorMode,
        onConfirm: (item: ListPickerItem) => {
          ink.unmount();
          if (item.key === 'skip') {
            resolve({ kind: 'skip-ai' });
            return;
          }
          const p = item.key as ProviderName;
          resolve({
            kind: 'proceed',
            config: withDiscoveryAgentModel(
              options.config,
              DISCOVERY_MODEL_DEFAULTS[p],
            ),
          });
        },
      }),
    );
  });
}

/** Non-interactive: same heuristics as {@link autoResolveDiscoveryModelConfig}. */
export function resolveDiscoveryConfigNonInteractive(
  config: MaestroConfig,
): MaestroConfig | null {
  return autoResolveDiscoveryModelConfig(config);
}
