import type { z } from 'zod';

export const AGENT_ROLES = ['pipeline', 'sensor', 'background'] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const PIPELINE_STAGES = [1, 2, 3, 4, 5] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type ToolRef = string;

export type FewShotExample = {
  readonly input: unknown;
  readonly output: unknown;
  readonly note?: string;
};

export type Criterion = {
  readonly id: string;
  readonly description: string;
};

export type AgentCalibration = {
  readonly fewShotExamples: readonly FewShotExample[];
  readonly criteria?: readonly Criterion[];
};

export type AgentContext = {
  readonly agentId: string;
  readonly runId: string;
  readonly workingDir: string;
  readonly metadata: Readonly<Record<string, unknown>>;
};

export type SystemPromptResolver = (ctx: AgentContext) => Promise<string>;

export type AgentDefinition<TInput = unknown, TOutput = unknown> = {
  readonly id: string;
  readonly role: AgentRole;
  readonly stage?: PipelineStage;
  readonly systemPrompt: string | SystemPromptResolver;
  readonly inputSchema: z.ZodType<TInput>;
  readonly outputSchema: z.ZodType<TOutput>;
  readonly model?: string;
  readonly tools?: readonly ToolRef[];
  readonly calibration?: AgentCalibration;
  readonly onStart?: (ctx: AgentContext) => Promise<void> | void;
  readonly onComplete?: (
    ctx: AgentContext,
    output: TOutput,
  ) => Promise<void> | void;
  readonly onError?: (ctx: AgentContext, error: Error) => Promise<void> | void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- variance-safe erased type for registry/runner APIs
export type AnyAgentDefinition = AgentDefinition<any, any>;
