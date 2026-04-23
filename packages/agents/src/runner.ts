import type { MaestroConfig } from '@maestro/config';
import { DEFAULT_CONFIG } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import { getModel } from '@maestro/provider';
import type { LanguageModelV3 } from '@ai-sdk/provider';

import type { ZodIssue } from 'zod';

import type {
  AgentContext,
  AgentDefinition,
  AnyAgentDefinition,
} from './definition.js';
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  stepCountIs,
  TypeValidationError,
  type ToolSet,
} from 'ai';

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

/** Structured `agent.delta` payloads are synthetic (one chunk); keep TUI/logs bounded. */
const AGENT_DELTA_MAX_CHARS = 12_000;

function truncateAgentDeltaPayload(text: string): string {
  return text.length > AGENT_DELTA_MAX_CHARS
    ? `${text.slice(0, AGENT_DELTA_MAX_CHARS)}…`
    : text;
}

function rethrowStructuredGenerationError(
  error: unknown,
  opts: { readonly outputSchema: AnyAgentDefinition['outputSchema']; readonly agentId: string },
): never {
  if (NoObjectGeneratedError.isInstance(error)) {
    const raw = error.text ?? '';
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        const outputParse = opts.outputSchema.safeParse(parsed);
        if (!outputParse.success) {
          const issues = outputParse.error.issues;
          const body = formatZodIssues(issues);
          throw new AgentValidationError(
            `Invalid output from agent "${opts.agentId}" (${issues.length} schema issue(s)):\n${body}`,
            'output',
            issues,
            raw,
          );
        }
      } catch (nested) {
        if (nested instanceof AgentValidationError) {
          throw nested;
        }
      }
    }
    throw new AgentOutputParseError(
      `Structured output could not be generated: ${error.message}`,
      raw,
    );
  }
  if (TypeValidationError.isInstance(error)) {
    let raw: string;
    if (typeof error.value === 'string') {
      raw = error.value;
    } else {
      try {
        raw = JSON.stringify(error.value, null, 2);
      } catch {
        raw = String(error.value);
      }
    }
    throw new AgentValidationError(
      `Structured output failed type validation: ${error.message}`,
      'output',
      [error.cause ?? error.message],
      raw,
    );
  }
  throw error;
}

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
      summary: 'Structured output could not be parsed from the model',
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

/** When the tool loop hits maxSteps on tool-calls, the model may never emit structured output. */
const TOOL_LOOP_JSON_RECOVERY_USER =
  'The tool exploration phase finished without structured output. Using the conversation and tool results above, produce the final structured output required by the system message. Do not use tools.';

async function generateToolAugmentedAgentText(options: {
  readonly model: LanguageModelV3;
  readonly system: string;
  readonly prompt: string;
  readonly bus: EventBus;
  readonly agentId: string;
  readonly parseAuditContext: AgentContext;
  readonly tools: ToolSet;
  readonly maxSteps: number;
  readonly outputSchema: AnyAgentDefinition['outputSchema'];
}): Promise<{
  readonly structuredOutput: unknown;
  readonly generateResult: Awaited<ReturnType<typeof generateText>>;
  readonly toolLoopRecoveryAttempted: boolean;
}> {
  const structuredOutputSpec = Output.object({
    schema: options.outputSchema,
    name: options.agentId,
    description: 'Final Maestro agent output (JSON object matching the output schema).',
  });

  // `Output.object` consumes an extra step after tool calls; keep headroom so stopWhen does not cut early.
  let gen: Awaited<ReturnType<typeof generateText>>;
  try {
    gen = await generateText({
      model: options.model,
      system: options.system,
      prompt: options.prompt,
      tools: options.tools,
      output: structuredOutputSpec,
      stopWhen: stepCountIs(options.maxSteps + 2),
      experimental_onToolCallStart: ({ toolCall }) => {
        options.bus.emit({
          type: 'agent.tool_call',
          agentId: options.agentId,
          runId: options.parseAuditContext.runId,
          tool: toolCall.toolName,
          args: toolCall.input,
        });
      },
      experimental_onToolCallFinish: (event) => {
        options.bus.emit({
          type: 'agent.tool_result',
          agentId: options.agentId,
          runId: options.parseAuditContext.runId,
          tool: event.toolCall.toolName,
          result: event.success ? event.output : event.error,
        });
      },
    });
  } catch (error) {
    rethrowStructuredGenerationError(error, {
      outputSchema: options.outputSchema,
      agentId: options.agentId,
    });
  }

  let structured: unknown = gen.output;
  let toolLoopRecoveryAttempted = false;
  if (structured === undefined) {
    toolLoopRecoveryAttempted = true;
    let recovery: Awaited<ReturnType<typeof generateText>>;
    try {
      recovery = await generateText({
        model: options.model,
        system: `${options.system}\n\n---\nFollow-up: do not use tools. Produce only the structured output required by the output schema.`,
        messages: [
          ...gen.response.messages,
          { role: 'user', content: TOOL_LOOP_JSON_RECOVERY_USER },
        ],
        output: structuredOutputSpec,
        stopWhen: stepCountIs(5),
      });
    } catch (error) {
      rethrowStructuredGenerationError(error, {
        outputSchema: options.outputSchema,
        agentId: options.agentId,
      });
    }
    structured = recovery.output;
    if (structured === undefined) {
      const err = new AgentOutputParseError(
        'After tool execution the model produced no structured output.',
        recovery.text ?? '',
      );
      const auditPath = await writeAgentParseAuditLog({
        context: options.parseAuditContext,
        agentId: options.agentId,
        candidateText: recovery.text ?? '',
        parseMessage: err.message,
        generateTextAudit: serializeGenerateTextForAudit(gen),
        toolLoopRecoveryAttempted: true,
      });
      if (auditPath) {
        err.auditLogPath = auditPath;
        err.message = `${err.message}\nAudit: ${auditPath}`;
      }
      throw err;
    }
  }

  const delta = truncateAgentDeltaPayload(
    JSON.stringify(structured, null, 2),
  );
  if (delta.length > 0) {
    options.bus.emit({
      type: 'agent.delta',
      agentId: options.agentId,
      runId: options.parseAuditContext.runId,
      chunk: delta,
    });
  }
  return { structuredOutput: structured, generateResult: gen, toolLoopRecoveryAttempted };
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
    let outputCandidate: unknown;
    let toolLoopGen: Awaited<ReturnType<typeof generateText>> | undefined;
    let toolLoopRecoveryAttempted = false;

    const meta = context.metadata;
    const stateRepoRoot =
      typeof meta.stateRepoRoot === 'string' && meta.stateRepoRoot.length > 0
        ? meta.stateRepoRoot
        : context.workingDir;
    const worktreeRoot =
      typeof meta.worktreeRoot === 'string' && meta.worktreeRoot.length > 0
        ? meta.worktreeRoot
        : context.workingDir;
    const maestroDirMeta =
      typeof meta.maestroDir === 'string' ? meta.maestroDir : undefined;

    let toolAugmented: { tools: ToolSet; maxSteps: number } | null = null;
    if (definition.id === 'planner') {
      toolAugmented = {
        tools: createPlannerToolSet(context.workingDir, stateRepoRoot),
        maxSteps: 24,
      };
    } else if (definition.id === 'architect') {
      toolAugmented = {
        tools: createArchitectToolSet(context.workingDir, stateRepoRoot),
        maxSteps: 24,
      };
    } else if (definition.id === 'generator') {
      toolAugmented = {
        tools: createGeneratorToolSet({
          workspaceRoot: context.workingDir,
          stateRepoRoot,
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
          repoRoot: stateRepoRoot,
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
          repoRoot: stateRepoRoot,
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
          repoRoot: stateRepoRoot,
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
        parseAuditContext: context,
        tools: toolAugmented.tools,
        maxSteps: toolAugmented.maxSteps,
        outputSchema: definition.outputSchema,
      });
      outputCandidate = loop.structuredOutput;
      toolLoopGen = loop.generateResult;
      toolLoopRecoveryAttempted = loop.toolLoopRecoveryAttempted;
      text = JSON.stringify(outputCandidate, null, 2);
    } else {
      const structuredOutputSpec = Output.object({
        schema: definition.outputSchema,
        name: definition.id,
        description: 'Maestro agent output (JSON object matching the output schema).',
      });
      let gen: Awaited<ReturnType<typeof generateText>>;
      try {
        gen = await generateText({
          model,
          system,
          prompt,
          output: structuredOutputSpec,
        });
      } catch (error) {
        rethrowStructuredGenerationError(error, {
          outputSchema: definition.outputSchema,
          agentId: definition.id,
        });
      }
      outputCandidate = gen.output;
      if (outputCandidate === undefined) {
        throw new AgentOutputParseError(
          'Structured output missing from model response.',
          gen.text ?? '',
        );
      }
      text = JSON.stringify(outputCandidate, null, 2);
      bus.emit({
        type: 'agent.delta',
        agentId: definition.id,
        runId: context.runId,
        chunk: truncateAgentDeltaPayload(text),
      });
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
