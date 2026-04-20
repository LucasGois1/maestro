import type { EventBus } from '@maestro/core';

import {
  sprintContractFrontmatterSchema,
  MAX_NEGOTIATION_ROUNDS,
  type NegotiationRole,
  type SprintContract,
  type SprintContractFrontmatter,
  type SprintContractFrontmatterInput,
} from './schema.js';
import { ContractValidationError } from './parser.js';

export class NegotiationError extends Error {
  constructor(
    message: string,
    public readonly lastContract: SprintContract,
  ) {
    super(message);
    this.name = 'NegotiationError';
  }
}

export type NegotiatorProposal = {
  readonly frontmatter: SprintContractFrontmatterInput;
  readonly body: string;
  readonly converged: boolean;
  readonly note?: string;
};

export type Negotiator = (
  current: SprintContract,
) => Promise<NegotiatorProposal> | NegotiatorProposal;

export type NegotiateSprintContractOptions = {
  readonly initial: SprintContract;
  readonly negotiators: ReadonlyArray<{
    readonly role: NegotiationRole;
    readonly negotiate: Negotiator;
  }>;
  readonly maxRounds?: number;
  readonly bus?: EventBus;
  readonly runId?: string;
  readonly agentId?: string;
};

export type NegotiationResult = {
  readonly contract: SprintContract;
  readonly converged: boolean;
  readonly rounds: number;
  readonly log: ReadonlyArray<{
    readonly round: number;
    readonly role: NegotiationRole;
    readonly converged: boolean;
    readonly note?: string;
  }>;
};

function assertValid(
  frontmatter: SprintContractFrontmatterInput,
): SprintContractFrontmatter {
  const result = sprintContractFrontmatterSchema.safeParse(frontmatter);
  if (!result.success) {
    throw new ContractValidationError(
      'Negotiator produced an invalid contract',
      result.error.issues,
    );
  }
  return result.data;
}

function recordRole(
  current: readonly NegotiationRole[],
  role: NegotiationRole,
): NegotiationRole[] {
  if (current.includes(role)) return [...current];
  return [...current, role];
}

export async function negotiateSprintContract(
  options: NegotiateSprintContractOptions,
): Promise<NegotiationResult> {
  const maxRounds = options.maxRounds ?? MAX_NEGOTIATION_ROUNDS;
  let contract: SprintContract = {
    frontmatter: assertValid(options.initial.frontmatter),
    body: options.initial.body,
  };
  const log: Array<{
    round: number;
    role: NegotiationRole;
    converged: boolean;
    note?: string;
  }> = [];

  for (let round = 1; round <= maxRounds; round += 1) {
    let allConverged = true;

    for (const { role, negotiate } of options.negotiators) {
      const proposal = await negotiate(contract);
      const nextFrontmatter = assertValid({
        ...proposal.frontmatter,
        status:
          round === maxRounds && proposal.converged ? 'agreed' : 'negotiating',
        iterations: round,
        negotiated_by: recordRole(contract.frontmatter.negotiated_by, role),
      });
      contract = { frontmatter: nextFrontmatter, body: proposal.body };
      const entry = proposal.note
        ? { round, role, converged: proposal.converged, note: proposal.note }
        : { round, role, converged: proposal.converged };
      log.push(entry);

      if (options.bus && options.runId && options.agentId) {
        options.bus.emit({
          type: 'agent.decision',
          runId: options.runId,
          agentId: options.agentId,
          message: `[round ${round}] ${role}: ${
            proposal.converged ? 'converged' : 'diverged'
          }${proposal.note ? ` — ${proposal.note}` : ''}`,
        });
      }

      if (!proposal.converged) allConverged = false;
    }

    if (allConverged) {
      const frontmatter = assertValid({
        ...contract.frontmatter,
        status: 'agreed',
        iterations: round,
      });
      return {
        contract: { frontmatter, body: contract.body },
        converged: true,
        rounds: round,
        log,
      };
    }
  }

  return { contract, converged: false, rounds: maxRounds, log };
}
