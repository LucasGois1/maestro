import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import type { AgentDefinition } from './definition.js';
import { createAgentRegistry, AgentRegistryError } from './registry.js';
import {
  BUILT_IN_AGENTS,
  plannerAgent,
  codeReviewerAgent,
} from './built-in.js';

function stub<I, O>(partial: Partial<AgentDefinition<I, O>> & { id: string }) {
  return {
    role: 'pipeline' as const,
    systemPrompt: 'stub',
    inputSchema: z.unknown() as unknown as z.ZodType<I>,
    outputSchema: z.unknown() as unknown as z.ZodType<O>,
    ...partial,
  } as AgentDefinition<I, O>;
}

describe('AgentRegistry', () => {
  it('registers and retrieves an agent by id', () => {
    const r = createAgentRegistry();
    r.register(plannerAgent);
    expect(r.get('planner')).toBe(plannerAgent);
    expect(r.has('planner')).toBe(true);
  });

  it('allows override by id (last registration wins)', () => {
    const r = createAgentRegistry();
    r.register(plannerAgent);
    const override = stub({ id: 'planner', role: 'pipeline', stage: 1 });
    r.register(override);
    expect(r.get('planner')).toBe(override);
  });

  it('registers all built-in agents without conflicts', () => {
    const r = createAgentRegistry();
    for (const def of BUILT_IN_AGENTS) r.register(def);
    expect(r.list()).toHaveLength(BUILT_IN_AGENTS.length);
    expect(r.pipeline().map((d) => d.id)).toEqual([
      'planner',
      'architect',
      'generator',
      'evaluator',
      'merger',
    ]);
    expect(r.sensors().map((d) => d.id)).toEqual(['code-reviewer']);
    expect(r.background().map((d) => d.id)).toEqual([
      'doc-gardener',
      'discovery',
      'sensor-setup',
    ]);
  });

  it('rejects a pipeline agent without stage', () => {
    const r = createAgentRegistry();
    expect(() => r.register(stub({ id: 'bad', role: 'pipeline' }))).toThrow(
      AgentRegistryError,
    );
  });

  it('rejects a sensor with a stage', () => {
    const r = createAgentRegistry();
    expect(() =>
      r.register(
        stub({
          id: 'bad',
          role: 'sensor',
          stage: 1,
        }) as unknown as AgentDefinition,
      ),
    ).toThrow(AgentRegistryError);
  });

  it('rejects duplicate pipeline stages', () => {
    const r = createAgentRegistry();
    r.register(plannerAgent);
    expect(() =>
      r.register(stub({ id: 'other-planner', role: 'pipeline', stage: 1 })),
    ).toThrow(/Duplicate pipeline stage/);
    expect(r.has('other-planner')).toBe(false);
  });

  it('require() throws for unknown id', () => {
    const r = createAgentRegistry();
    expect(() => r.require('missing')).toThrow(AgentRegistryError);
  });

  it('snapshot returns a detached copy', () => {
    const r = createAgentRegistry();
    r.register(codeReviewerAgent);
    const snap = r.snapshot();
    expect(snap.size).toBe(1);
  });
});
