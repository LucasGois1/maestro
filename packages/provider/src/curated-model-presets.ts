import {
  AGENT_NAMES,
  type AgentName,
  type MaestroConfig,
  type ProviderName,
} from '@maestro/config';

export type ModelPresetTier = 'frontier' | 'balanced' | 'efficient';

/** Full per-agent stack aligned with legacy schema defaults (Anthropic). */
export const LEGACY_SCHEMA_ANTHROPIC_STACK: Record<AgentName, string> = {
  planner: 'anthropic/claude-sonnet-4-6',
  architect: 'anthropic/claude-sonnet-4-6',
  generator: 'anthropic/claude-opus-4-7',
  evaluator: 'anthropic/claude-opus-4-7',
  merger: 'anthropic/claude-haiku-4-5',
  'code-reviewer': 'anthropic/claude-sonnet-4-6',
  'doc-gardener': 'anthropic/claude-haiku-4-5',
  discovery: 'anthropic/claude-sonnet-4-6',
};

export const OPENAI_MODEL_STACK_BALANCED: Record<AgentName, string> = {
  planner: 'openai/gpt-5',
  architect: 'openai/gpt-5',
  generator: 'openai/gpt-5',
  evaluator: 'openai/gpt-5',
  merger: 'openai/gpt-5-nano',
  'code-reviewer': 'openai/gpt-5',
  'doc-gardener': 'openai/gpt-5-nano',
  discovery: 'openai/gpt-4o-mini',
};

export const OPENAI_MODEL_STACK_CAPABLE: Record<AgentName, string> = {
  planner: 'openai/gpt-5',
  architect: 'openai/gpt-5',
  generator: 'openai/gpt-5.4',
  evaluator: 'openai/gpt-5.4',
  merger: 'openai/gpt-5-nano',
  'code-reviewer': 'openai/gpt-5',
  'doc-gardener': 'openai/gpt-5-nano',
  discovery: 'openai/gpt-5',
};

export const OPENAI_MODEL_STACK_EFFICIENT: Record<AgentName, string> = {
  planner: 'openai/gpt-5-nano',
  architect: 'openai/gpt-5-nano',
  generator: 'openai/gpt-5',
  evaluator: 'openai/gpt-5',
  merger: 'openai/gpt-5-nano',
  'code-reviewer': 'openai/gpt-5-nano',
  'doc-gardener': 'openai/gpt-5-nano',
  discovery: 'openai/gpt-5-nano',
};

export const GOOGLE_MODEL_STACK_BALANCED: Record<AgentName, string> = {
  planner: 'google/gemini-3-flash',
  architect: 'google/gemini-3-flash',
  generator: 'google/gemini-3-pro',
  evaluator: 'google/gemini-3-pro',
  merger: 'google/gemini-3-flash',
  'code-reviewer': 'google/gemini-3-flash',
  'doc-gardener': 'google/gemini-3-flash',
  discovery: 'google/gemini-3-flash',
};

export const GOOGLE_MODEL_STACK_CAPABLE: Record<AgentName, string> = {
  planner: 'google/gemini-3-pro',
  architect: 'google/gemini-3-flash',
  generator: 'google/gemini-3-pro',
  evaluator: 'google/gemini-3-pro',
  merger: 'google/gemini-3-flash',
  'code-reviewer': 'google/gemini-3-flash',
  'doc-gardener': 'google/gemini-3-flash',
  discovery: 'google/gemini-3-flash',
};

export const GOOGLE_MODEL_STACK_EFFICIENT: Record<AgentName, string> = {
  planner: 'google/gemini-2.0-flash',
  architect: 'google/gemini-2.0-flash',
  generator: 'google/gemini-2.0-flash',
  evaluator: 'google/gemini-2.0-flash',
  merger: 'google/gemini-2.0-flash',
  'code-reviewer': 'google/gemini-2.0-flash',
  'doc-gardener': 'google/gemini-2.0-flash',
  discovery: 'google/gemini-2.0-flash',
};

export const OLLAMA_MODEL_STACK_BALANCED: Record<AgentName, string> = {
  planner: 'ollama/llama3.2',
  architect: 'ollama/llama3.2',
  generator: 'ollama/llama3.2',
  evaluator: 'ollama/llama3.2',
  merger: 'ollama/llama3.2',
  'code-reviewer': 'ollama/llama3.2',
  'doc-gardener': 'ollama/llama3.2',
  discovery: 'ollama/llama3.2',
};

export const BALANCED_MODEL_STACK_BY_PROVIDER: Record<
  ProviderName,
  Record<AgentName, string>
> = {
  anthropic: LEGACY_SCHEMA_ANTHROPIC_STACK,
  openai: OPENAI_MODEL_STACK_BALANCED,
  google: GOOGLE_MODEL_STACK_BALANCED,
  ollama: OLLAMA_MODEL_STACK_BALANCED,
};

export function applyModelStackToConfig(
  config: MaestroConfig,
  stack: Record<AgentName, string>,
): MaestroConfig {
  const nextDefaults = { ...config.defaults };
  for (const name of AGENT_NAMES) {
    const model = stack[name];
    if (model !== undefined) {
      nextDefaults[name] = { ...nextDefaults[name], model };
    }
  }
  return { ...config, defaults: nextDefaults };
}

export function modelStackForProviderTier(
  provider: ProviderName,
  tier: ModelPresetTier,
): Record<AgentName, string> {
  if (provider === 'anthropic') {
    if (tier === 'frontier') {
      return applyTierAnthropic('frontier');
    }
    if (tier === 'efficient') {
      return applyTierAnthropic('efficient');
    }
    return LEGACY_SCHEMA_ANTHROPIC_STACK;
  }
  if (provider === 'openai') {
    if (tier === 'frontier') {
      return OPENAI_MODEL_STACK_CAPABLE;
    }
    if (tier === 'efficient') {
      return OPENAI_MODEL_STACK_EFFICIENT;
    }
    return OPENAI_MODEL_STACK_BALANCED;
  }
  if (provider === 'google') {
    if (tier === 'frontier') {
      return GOOGLE_MODEL_STACK_CAPABLE;
    }
    if (tier === 'efficient') {
      return GOOGLE_MODEL_STACK_EFFICIENT;
    }
    return GOOGLE_MODEL_STACK_BALANCED;
  }
  return OLLAMA_MODEL_STACK_BALANCED;
}

function applyTierAnthropic(
  tier: 'frontier' | 'efficient',
): Record<AgentName, string> {
  const base = { ...LEGACY_SCHEMA_ANTHROPIC_STACK };
  if (tier === 'frontier') {
    for (const name of AGENT_NAMES) {
      base[name] = 'anthropic/claude-opus-4-7';
    }
    return base;
  }
  for (const name of AGENT_NAMES) {
    base[name] = 'anthropic/claude-haiku-4-5';
  }
  return base;
}
