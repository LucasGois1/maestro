import type { ProviderName } from '@maestro/config';

export type InitPickerModelChoice = {
  readonly tier: 'frontier' | 'balanced' | 'efficient';
  readonly label: string;
  readonly ref: string;
};

/** Three curated `provider/model` refs per provider for `maestro init` pickers. */
export const INIT_PICKER_MODELS: Record<
  ProviderName,
  readonly InitPickerModelChoice[]
> = {
  anthropic: [
    {
      tier: 'frontier',
      label: 'Opus 4.7 (highest quality)',
      ref: 'anthropic/claude-opus-4-7',
    },
    {
      tier: 'balanced',
      label: 'Sonnet 4.6 (balanced)',
      ref: 'anthropic/claude-sonnet-4-6',
    },
    {
      tier: 'efficient',
      label: 'Haiku 4.5 (fast / cost-efficient)',
      ref: 'anthropic/claude-haiku-4-5',
    },
  ],
  openai: [
    {
      tier: 'frontier',
      label: 'GPT-5.4 (most capable)',
      ref: 'openai/gpt-5.4',
    },
    {
      tier: 'balanced',
      label: 'GPT-5 (balanced)',
      ref: 'openai/gpt-5',
    },
    {
      tier: 'efficient',
      label: 'GPT-5 nano (economical)',
      ref: 'openai/gpt-5-nano',
    },
  ],
  google: [
    {
      tier: 'frontier',
      label: 'Gemini 3 Pro',
      ref: 'google/gemini-3-pro',
    },
    {
      tier: 'balanced',
      label: 'Gemini 3 Flash',
      ref: 'google/gemini-3-flash',
    },
    {
      tier: 'efficient',
      label: 'Gemini 2.0 Flash (economical)',
      ref: 'google/gemini-2.0-flash',
    },
  ],
  ollama: [
    {
      tier: 'frontier',
      label: 'llama3.2 (local)',
      ref: 'ollama/llama3.2',
    },
    {
      tier: 'balanced',
      label: 'llama3.2',
      ref: 'ollama/llama3.2',
    },
    {
      tier: 'efficient',
      label: 'llama3.2',
      ref: 'ollama/llama3.2',
    },
  ],
};

export function initPickerChoicesFor(
  provider: ProviderName,
): readonly InitPickerModelChoice[] {
  return INIT_PICKER_MODELS[provider];
}
