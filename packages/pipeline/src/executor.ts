import {
  runAgent,
  type AgentContext,
  type AgentDefinition,
} from '@maestro/agents';
import type { MaestroConfig } from '@maestro/config';
import type { EventBus } from '@maestro/core';

export type AgentExecutor = <TInput, TOutput>(opts: {
  readonly definition: AgentDefinition<TInput, TOutput>;
  readonly input: TInput;
  readonly context: AgentContext;
  readonly bus: EventBus;
  readonly config?: MaestroConfig;
}) => Promise<TOutput>;

export const defaultAgentExecutor: AgentExecutor = async ({
  definition,
  input,
  context,
  bus,
  config,
}) => {
  const result = await runAgent({
    definition,
    input,
    context,
    bus,
    ...(config !== undefined ? { config } : {}),
  });
  return result.output;
};
