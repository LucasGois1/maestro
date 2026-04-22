import { runAgent } from '@maestro/agents';
import type { AgentDefinition } from '@maestro/agents';
import type * as AgentsModule from '@maestro/agents';
import { configSchema } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import { describe, expect, it, vi } from 'vitest';

import { defaultAgentExecutor } from './executor.js';

vi.mock('@maestro/agents', async (importOriginal) => {
  const actual = await importOriginal<typeof AgentsModule>();
  return {
    ...actual,
    runAgent: vi.fn(async () => ({ output: 'agent-output' })),
  };
});

describe('defaultAgentExecutor', () => {
  it('delegates to runAgent and returns the validated output', async () => {
    const definition = { id: 'planner' } as AgentDefinition<unknown, string>;
    const config = configSchema.parse({});
    const bus = createEventBus();

    await expect(
      defaultAgentExecutor({
        definition,
        input: { prompt: 'ship tests' },
        context: {
          agentId: 'planner',
          runId: 'run-1',
          workingDir: '/repo',
          metadata: {},
        },
        bus,
        config,
      }),
    ).resolves.toBe('agent-output');
    expect(runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        definition,
        input: { prompt: 'ship tests' },
        bus,
        config,
      }),
    );
  });

  it('omits config when none is provided', async () => {
    await defaultAgentExecutor({
      definition: { id: 'planner' } as AgentDefinition<unknown, string>,
      input: 'x',
      context: {
        agentId: 'planner',
        runId: 'run-1',
        workingDir: '/repo',
        metadata: {},
      },
      bus: createEventBus(),
    });

    expect(runAgent).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ config: expect.anything() }),
    );
  });
});
