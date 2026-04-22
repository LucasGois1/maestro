import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG, type MaestroConfig } from '@maestro/config';

import {
  applyModelStackToConfig,
  LEGACY_SCHEMA_ANTHROPIC_STACK,
  modelStackForProviderTier,
  OPENAI_MODEL_STACK_BALANCED,
} from './curated-model-presets.js';

function cfg(base: MaestroConfig): MaestroConfig {
  return structuredClone(base);
}

describe('curated-model-presets', () => {
  it('applyModelStackToConfig updates every agent default model', () => {
    const next = applyModelStackToConfig(
      cfg(DEFAULT_CONFIG),
      OPENAI_MODEL_STACK_BALANCED,
    );
    expect(next.defaults.planner.model).toBe('openai/gpt-5');
    expect(next.defaults.discovery.model).toBe('openai/gpt-4o-mini');
  });

  it('modelStackForProviderTier returns full stacks', () => {
    const s = modelStackForProviderTier('anthropic', 'balanced');
    expect(s.planner).toBe(LEGACY_SCHEMA_ANTHROPIC_STACK.planner);
    const frontier = modelStackForProviderTier('anthropic', 'frontier');
    expect(frontier.discovery).toBe('anthropic/claude-opus-4-7');
  });
});
