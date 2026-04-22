import type { MaestroConfig } from '@maestro/config';
import { DEFAULT_CONFIG } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import { getModel, streamText } from '@maestro/provider';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { jsonrepair } from 'jsonrepair';

import type { ZodIssue } from 'zod';

import type {
  AgentContext,
  AgentDefinition,
  AnyAgentDefinition,
} from './definition.js';
import { generateText, stepCountIs, type ToolSet } from 'ai';

import {
  serializeGenerateTextForAudit,
  writeAgentParseAuditLog,
} from './agent-output-audit.js';
import { appendCalibrationSection } from './calibration-format.js';
import type { EvaluatorInput } from './evaluator/evaluator-input.schema.js';
import { createEvaluatorToolSet } from './evaluator-tools.js';
import { createGeneratorToolSet } from './generator-tools.js';
import { createMergerToolSet } from './merger-tools.js';
import { createGardenerToolSet } from './gardener-tools.js';
import { createArchitectToolSet, createPlannerToolSet } from './repo-tools.js';
import { collectAssistantTextFromToolLoopResult } from './tool-loop-text.js';

function formatZodIssues(issues: readonly ZodIssue[]): string {
  return issues
    .map((i) => {
      const path = i.path.length ? i.path.map(String).join('.') : '(root)';
      return `  · ${path}: ${i.message}`;
    })
    .join('\n');
}

export class AgentOutputParseError extends Error {
  /** Populated when a tool-loop audit file was written under the run's `logs/` dir. */
  public auditLogPath?: string;

  constructor(
    message: string,
    public readonly rawText: string,
  ) {
    super(message);
    this.name = 'AgentOutputParseError';
  }
}

export class AgentValidationError extends Error {
  constructor(
    message: string,
    public readonly phase: 'input' | 'output',
    public readonly issues: readonly unknown[],
    /** Full model text; use for file logs only, not terminal. */
    public readonly rawModelOutput?: string,
  ) {
    super(message);
    this.name = 'AgentValidationError';
  }
}

/** Human-readable blocks for TUI (summary line + wrapped detail). */
export function formatAgentErrorForDisplay(error: unknown): {
  readonly summary: string;
  readonly detail: string;
} {
  if (error instanceof AgentOutputParseError) {
    const head =
      error.rawText.length > 3500
        ? `${error.rawText.slice(0, 3500)}…`
        : error.rawText;
    const auditPath = error.auditLogPath;
    const audit =
      typeof auditPath === 'string' &&
      auditPath.length > 0 &&
      !error.message.includes(auditPath)
        ? `\n\nAudit log: ${auditPath}`
        : '';
    return {
      summary: 'Model output was not valid JSON',
      detail: `${error.message}${audit}\n\n--- Raw output (truncated for screen) ---\n${head}`,
    };
  }
  if (error instanceof AgentValidationError) {
    if (error.phase === 'output') {
      const raw = error.rawModelOutput;
      const rawBlock =
        raw && raw.length > 0
          ? `\n\n--- Model output (truncated for screen) ---\n${
              raw.length > 3500 ? `${raw.slice(0, 3500)}…` : raw
            }`
          : '';
      return {
        summary: 'Discovery output did not match the expected schema',
        detail: `${error.message}${rawBlock}`,
      };
    }
    return {
      summary: 'Invalid input for discovery agent',
      detail: error.message,
    };
  }
  if (error instanceof Error) {
    const stack =
      error.stack && error.stack.length > 2000
        ? `${error.stack.slice(0, 2000)}…`
        : error.stack;
    return {
      summary: error.name === 'Error' ? 'Discovery failed' : error.name,
      detail: error.message + (stack ? `\n\n${stack}` : ''),
    };
  }
  return {
    summary: 'Discovery failed',
    detail: String(error),
  };
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

async function resolveSystemPrompt(
  def: AnyAgentDefinition,
  ctx: AgentContext,
): Promise<string> {
  const base =
    typeof def.systemPrompt === 'string'
      ? def.systemPrompt
      : await def.systemPrompt(ctx);
  return appendCalibrationSection(base, def.calibration?.fewShotExamples);
}

function stringifyInput(input: unknown): string {
  if (typeof input === 'string') return input;
  return JSON.stringify(input, null, 2);
}

/** When the tool loop hits maxSteps on tool-calls, the model may never emit a text turn. */
const TOOL_LOOP_JSON_RECOVERY_USER =
  'The tool exploration phase finished without a final assistant text. Using the conversation and tool results above, output exactly one JSON object only: no markdown code fences, no commentary before or after. It must satisfy the output contract from the system message.';

async function generateToolAugmentedAgentText(options: {
  readonly model: LanguageModelV3;
  readonly system: string;
  readonly prompt: string;
  readonly bus: EventBus;
  readonly agentId: string;
  readonly runId: string;
  readonly workingDir: string;
  readonly tools: ToolSet;
  readonly maxSteps: number;
}): Promise<{
  readonly outputText: string;
  readonly generateResult: Awaited<ReturnType<typeof generateText>>;
  readonly toolLoopRecoveryAttempted: boolean;
}> {
  const gen = await generateText({
    model: options.model,
    system: options.system,
    prompt: options.prompt,
    tools: options.tools,
    stopWhen: stepCountIs(options.maxSteps),
    experimental_onToolCallStart: ({ toolCall }) => {
      options.bus.emit({
        type: 'agent.tool_call',
        agentId: options.agentId,
        runId: options.runId,
        tool: toolCall.toolName,
        args: toolCall.input,
      });
    },
    experimental_onToolCallFinish: (event) => {
      options.bus.emit({
        type: 'agent.tool_result',
        agentId: options.agentId,
        runId: options.runId,
        tool: event.toolCall.toolName,
        result: event.success ? event.output : event.error,
      });
    },
  });
  let outputText = collectAssistantTextFromToolLoopResult(gen);
  let toolLoopRecoveryAttempted = false;
  if (outputText.trim().length === 0) {
    toolLoopRecoveryAttempted = true;
    const recovery = await generateText({
      model: options.model,
      system: `${options.system}\n\n---\nFollow-up: do not use tools. Respond with the final JSON object only.`,
      messages: [
        ...gen.response.messages,
        { role: 'user', content: TOOL_LOOP_JSON_RECOVERY_USER },
      ],
      stopWhen: stepCountIs(3),
    });
    outputText = collectAssistantTextFromToolLoopResult(recovery);
  }
  if (outputText.length > 0) {
    options.bus.emit({
      type: 'agent.delta',
      agentId: options.agentId,
      runId: options.runId,
      chunk: outputText,
    });
  }
  return { outputText, generateResult: gen, toolLoopRecoveryAttempted };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/u.exec(trimmed);
  const candidate = fenceMatch?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(candidate);
  } catch (first) {
    /** LLMs often emit almost-JSON: newlines inside strings, stray commas, etc. */
    try {
      return JSON.parse(jsonrepair(candidate));
    } catch (second) {
      const a = first instanceof Error ? first.message : String(first);
      const b = second instanceof Error ? second.message : String(second);
      throw new AgentOutputParseError(
        `Agent output was not valid JSON (parse: ${a}; after repair: ${b}).`,
        text,
      );
    }
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
    const prompt = stringifyInput(inputParse.data);

    let text = '';
    let toolLoopGen: Awaited<ReturnType<typeof generateText>> | undefined;
    let toolLoopRecoveryAttempted = false;

    const meta = context.metadata;
    const worktreeRoot =
      typeof meta.worktreeRoot === 'string' && meta.worktreeRoot.length > 0
        ? meta.worktreeRoot
        : context.workingDir;
    const maestroDirMeta =
      typeof meta.maestroDir === 'string' ? meta.maestroDir : undefined;

    let toolAugmented: { tools: ToolSet; maxSteps: number } | null = null;
    if (definition.id === 'planner') {
      toolAugmented = {
        tools: createPlannerToolSet(context.workingDir),
        maxSteps: 24,
      };
    } else if (definition.id === 'architect') {
      toolAugmented = {
        tools: createArchitectToolSet(context.workingDir),
        maxSteps: 24,
      };
    } else if (definition.id === 'generator') {
      toolAugmented = {
        tools: createGeneratorToolSet({
          repoRoot: context.workingDir,
          config,
          runId: context.runId,
          bus,
          ...(maestroDirMeta !== undefined
            ? { maestroDir: maestroDirMeta }
            : {}),
        }),
        maxSteps: 72,
      };
    } else if (definition.id === 'evaluator') {
      const evInput = inputParse.data as EvaluatorInput;
      toolAugmented = {
        tools: createEvaluatorToolSet({
          repoRoot: context.workingDir,
          worktreeRoot,
          config,
          runId: context.runId,
          bus,
          ...(maestroDirMeta !== undefined
            ? { maestroDir: maestroDirMeta }
            : {}),
          codeDiff: evInput.codeDiff,
          sprintContract: evInput.sprintContract,
        }),
        maxSteps: 36,
      };
    } else if (definition.id === 'merger') {
      toolAugmented = {
        tools: createMergerToolSet({
          repoRoot: context.workingDir,
          worktreeRoot,
          config,
          runId: context.runId,
          bus,
          ...(maestroDirMeta !== undefined
            ? { maestroDir: maestroDirMeta }
            : {}),
        }),
        maxSteps: 32,
      };
    } else if (definition.id === 'doc-gardener') {
      toolAugmented = {
        tools: createGardenerToolSet({
          repoRoot: context.workingDir,
          worktreeRoot,
          config,
          runId: context.runId,
          bus,
          ...(maestroDirMeta !== undefined
            ? { maestroDir: maestroDirMeta }
            : {}),
          ...(typeof meta.codeDiff === 'string'
            ? { codeDiff: meta.codeDiff }
            : {}),
        }),
        maxSteps: 40,
      };
    }

    if (toolAugmented) {
      const loop = await generateToolAugmentedAgentText({
        model,
        system,
        prompt,
        bus,
        agentId: definition.id,
        runId: context.runId,
        workingDir: context.workingDir,
        tools: toolAugmented.tools,
        maxSteps: toolAugmented.maxSteps,
      });
      text = loop.outputText;
      toolLoopGen = loop.generateResult;
      toolLoopRecoveryAttempted = loop.toolLoopRecoveryAttempted;
    } else {
      const result = streamText({
        model,
        system,
        prompt,
      });

      for await (const chunk of result.textStream) {
        text += chunk;
        bus.emit({
          type: 'agent.delta',
          agentId: definition.id,
          runId: context.runId,
          chunk,
        });
      }
    }

    let outputCandidate: unknown;
    try {
      outputCandidate = extractJsonObject(text);
    } catch (err) {
      if (err instanceof AgentOutputParseError && toolLoopGen !== undefined) {
        const auditPath = await writeAgentParseAuditLog({
          context,
          agentId: definition.id,
          candidateText: text,
          parseMessage: err.message,
          generateTextAudit: serializeGenerateTextForAudit(toolLoopGen),
          toolLoopRecoveryAttempted,
        });
        if (auditPath) {
          err.auditLogPath = auditPath;
          err.message = `${err.message}\nAudit: ${auditPath}`;
        }
      }
      throw err;
    }
    const outputParse = definition.outputSchema.safeParse(outputCandidate);
    if (!outputParse.success) {
      const issues = outputParse.error.issues;
      const body = formatZodIssues(issues);
      throw new AgentValidationError(
        `Invalid output from agent "${definition.id}" (${issues.length} schema issue(s)):\n${body}`,
        'output',
        issues,
        text,
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
