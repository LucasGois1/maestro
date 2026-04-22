import { describe, expect, it } from 'vitest';

import { activeAgentWorkingHint } from './activeAgentWorkingHint.js';

describe('activeAgentWorkingHint', () => {
  it('returns planner + planning copy', () => {
    expect(activeAgentWorkingHint('planner', 'planning')).toBe(
      'A gerar o plano do produto…',
    );
  });

  it('falls back to stage-only for discovering', () => {
    expect(activeAgentWorkingHint('unknown', 'discovering')).toBe(
      'Descoberta em curso…',
    );
  });

  it('falls back to generic agent message', () => {
    expect(activeAgentWorkingHint('custom-bot', 'merging')).toBe(
      'Agente a trabalhar…',
    );
  });
});
