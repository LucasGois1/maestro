import type { MaestroConfig } from '@maestro/config';
import { DEFAULT_CONFIG } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import { getModel, streamText } from '@maestro/provider';
import type { LanguageModelV3 } from '@ai-sdk/provider';

import type {
  AgentContext,
  AgentDefinition,
  AnyAgentDefinition,
  FewShotExample,
} from './definition.js';

export class AgentValidationError extends Error {
  constructor(
    message: string,
    public readonly phase: 'input' | 'output',
    public readonly issues: readonly unknown[],
  ) {
    super(message);
    this.name = 'AgentValidationError';
  }
}

export type RunAgentOptions<TInput, TOutput> = {
  readonly definition: AgentDefinition<TInput, TOutput>;
  readonly input: TInput;
  readonly context: AgentContext;
  readonly bus: EventBus;
  readonly config?: MaestroConfig;
  readonly model?: LanguageModelV3;
};

export type RunAgentResult<TOutput> = {
  readonly output: TOutput;
  readonly text: string;
  readonly durationMs: number;
};

function resolveModel(
  def: AnyAgentDefinition,
  config: MaestroConfig,
  overrideModel?: LanguageModelV3,
): LanguageModelV3 {
  if (overrideModel) return overrideModel;
  const ref = def.model ?? defaultModelRef(def.id, config);
  return getModel(ref, { config });
}

function defaultModelRef(agentId: string, config: MaestroConfig): string {
  const defaults = config.defaults as Record<
    string,
    { model: string } | undefined
  >;
  const entry = defaults[agentId];
  if (!entry) {
    throw new Error(
      `No default model configured for agent "${agentId}". Set defaults.${agentId}.model in config.`,
    );
  }
  return entry.model;
}

function formatFewShots(examples: readonly FewShotExample[]): string {
  return examples
    .map((ex, i) => {
      const note = ex.note ? ` // ${ex.note}` : '';
      return [
        `### Example ${i + 1}${note}`,
        `INPUT: ${JSON.stringify(ex.input)}`,
        `OUTPUT: ${JSON.stringify(ex.output)}`,
      ].join('\n');
    })
    .join('\n\n');
}

async function resolveSystemPrompt(
  def: AnyAgentDefinition,
  ctx: AgentContext,
): Promise<string> {
  const base =
    typeof def.systemPrompt === 'string'
      ? def.systemPrompt
      : await def.systemPrompt(ctx);
  if (!def.calibration?.fewShotExamples?.length) return base;
  return `${base}\n\n## Calibration examples\n\n${formatFewShots(def.calibration.fewShotExamples)}`;
}

function stringifyInput(input: unknown): string {
  if (typeof input === 'string') return input;
  return JSON.stringify(input, null, 2);
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/u.exec(trimmed);
  const candidate = fenceMatch?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error(
      `Agent output was not valid JSON. Raw text: ${candidate.slice(0, 200)}`,
    );
  }
}

export async function runAgent<TInput, TOutput>(
  options: RunAgentOptions<TInput, TOutput>,
): Promise<RunAgentResult<TOutput>> {
  const { definition, input, context, bus } = options;
  const config = options.config ?? DEFAULT_CONFIG;

  const inputParse = definition.inputSchema.safeParse(input);
  if (!inputParse.success) {
    throw new AgentValidationError(
      `Invalid input for agent "${definition.id}"`,
      'input',
      inputParse.error.issues,
    );
  }

  bus.emit({
    type: 'agent.started',
    agentId: definition.id,
    runId: context.runId,
  });

  const startedAt = Date.now();
  try {
    await definition.onStart?.(context);

    const model = resolveModel(definition, config, options.model);
    const system = await resolveSystemPrompt(definition, context);

    const result = streamText({
      model,
      system,
      prompt: stringifyInput(inputParse.data),
    });

    let text = '';
    for await (const chunk of result.textStream) {
      text += chunk;
      bus.emit({
        type: 'agent.delta',
        agentId: definition.id,
        runId: context.runId,
        chunk,
      });
    }

    const outputCandidate = extractJsonObject(text);
    const outputParse = definition.outputSchema.safeParse(outputCandidate);
    if (!outputParse.success) {
      throw new AgentValidationError(
        `Invalid output from agent "${definition.id}"`,
        'output',
        outputParse.error.issues,
      );
    }

    const output = outputParse.data as TOutput;
    await definition.onComplete?.(context, output);

    const durationMs = Date.now() - startedAt;
    bus.emit({
      type: 'agent.completed',
      agentId: definition.id,
      runId: context.runId,
      output,
      durationMs,
    });

    return { output, text, durationMs };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    bus.emit({
      type: 'agent.failed',
      agentId: definition.id,
      runId: context.runId,
      error: err.message,
    });
    try {
      await definition.onError?.(context, err);
    } catch {
      // onError must not mask original failure
    }
    throw err;
  }
}
