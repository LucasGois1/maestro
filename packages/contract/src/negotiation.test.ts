import { describe, expect, it, vi } from 'vitest';

import { negotiateSprintContract, type Negotiator } from './negotiation.js';
import {
  sprintContractFrontmatterSchema,
  type SprintContract,
  type SprintContractFrontmatterInput,
} from './schema.js';

const initialFrontmatter: SprintContractFrontmatterInput = {
  sprint: 1,
  feature: 'Demo feature',
  status: 'proposed',
  acceptance_criteria: [{ id: 'a1', description: 'first', verifier: 'pytest' }],
};

const initialContract: SprintContract = {
  frontmatter: sprintContractFrontmatterSchema.parse({
    ...initialFrontmatter,
    depends_on: [],
    scope: { files_expected: [], files_may_touch: [] },
    negotiated_by: [],
    iterations: 0,
  }),
  body: '# body',
};

const noopNegotiator =
  (role: string, converged = true): Negotiator =>
  async (current) => ({
    frontmatter: current.frontmatter,
    body: current.body,
    converged,
    note: `${role} reviewed`,
  });

describe('negotiateSprintContract', () => {
  it('converges on the first round when every negotiator agrees', async () => {
    const result = await negotiateSprintContract({
      initial: initialContract,
      negotiators: [
        { role: 'architect', negotiate: noopNegotiator('architect') },
        { role: 'generator', negotiate: noopNegotiator('generator') },
        { role: 'evaluator', negotiate: noopNegotiator('evaluator') },
      ],
    });
    expect(result.converged).toBe(true);
    expect(result.rounds).toBe(1);
    expect(result.contract.frontmatter.status).toBe('agreed');
    expect(result.contract.frontmatter.negotiated_by).toEqual(
      expect.arrayContaining(['architect', 'generator', 'evaluator']),
    );
  });

  it('stops at maxRounds when one negotiator never converges', async () => {
    const result = await negotiateSprintContract({
      initial: initialContract,
      negotiators: [
        { role: 'architect', negotiate: noopNegotiator('architect') },
        { role: 'generator', negotiate: noopNegotiator('generator', false) },
        { role: 'evaluator', negotiate: noopNegotiator('evaluator') },
      ],
    });
    expect(result.converged).toBe(false);
    expect(result.rounds).toBe(3);
  });

  it('honours a custom maxRounds', async () => {
    const result = await negotiateSprintContract({
      initial: initialContract,
      maxRounds: 1,
      negotiators: [
        { role: 'architect', negotiate: noopNegotiator('architect', false) },
      ],
    });
    expect(result.rounds).toBe(1);
    expect(result.converged).toBe(false);
  });

  it('tracks every round in the log', async () => {
    const result = await negotiateSprintContract({
      initial: initialContract,
      negotiators: [
        { role: 'architect', negotiate: noopNegotiator('architect', false) },
      ],
    });
    expect(result.log).toHaveLength(3);
    expect(result.log.map((e) => e.round)).toEqual([1, 2, 3]);
  });

  it('emits agent.decision events on the bus when provided', async () => {
    const listener = vi.fn();
    const bus = {
      emit: listener,
      on: () => () => false,
    };
    await negotiateSprintContract({
      initial: initialContract,
      bus,
      runId: 'r1',
      agentId: 'negotiator',
      negotiators: [
        { role: 'architect', negotiate: noopNegotiator('architect') },
      ],
    });
    expect(listener).toHaveBeenCalled();
    const decision = listener.mock.calls[0]?.[0];
    expect(decision.type).toBe('agent.decision');
  });
});
