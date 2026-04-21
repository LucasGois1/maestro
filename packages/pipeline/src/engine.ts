import {
  architectAgent,
  architectModelOutputSchema,
  architectNotesForPlanEmbed,
  evaluatorAgent,
  finalizeArchitectOutput,
  generatorAgent,
  generatorModelOutputSchema,
  mergerAgent,
  normalizePlannerModelOutput,
  plannerAgent,
  renderArchitectNotesMarkdown,
  type AgentContext,
  type AgentDefinition,
  type AgentRegistry,
  type PlannerOutput,
} from '@maestro/agents';
import type { MaestroConfig } from '@maestro/config';
import {
  sprintContractFrontmatterSchema,
  writeSprintContract,
  type SprintContractFrontmatter,
} from '@maestro/contract';
import type { EventBus, PipelineStageName } from '@maestro/core';
import {
  handoffPath,
  maestroRoot,
  writeHandoff,
  writeSprintSelfEval,
  type RunState,
  type StateStore,
} from '@maestro/state';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { AgentExecutor } from './executor.js';
import { defaultAgentExecutor } from './executor.js';
import { PipelineEscalationError, PipelinePauseError } from './errors.js';
import {
  loadArchitectureDocument,
  patchPlanFileWithArchitectNotes,
  writeDesignNotesSprintFile,
} from './plan-architect-notes.js';
import { serializePlanMarkdown } from './plan-markdown.js';

export const DEFAULT_RETRIES = 3;

export type { PlannerOutput } from '@maestro/agents';

type EvaluatorOutput = {
  readonly pass: boolean;
  readonly failures: readonly string[];
  readonly coverage?: number;
};

export type PipelineRunOptions = {
  readonly runId: string;
  readonly prompt: string;
  readonly branch: string;
  readonly worktreePath: string;
  readonly repoRoot: string;
  readonly store: StateStore;
  readonly bus: EventBus;
  readonly registry?: AgentRegistry;
  readonly config: MaestroConfig;
  readonly executor?: AgentExecutor;
  readonly retries?: number;
  readonly abortSignal?: AbortSignal;
  readonly architecture?: string;
  readonly maestroDir?: string;
  readonly userAgent?: string;
  readonly resume?: boolean;
};

export type PipelineRunResult = {
  readonly state: RunState;
  readonly plan: PlannerOutput;
  readonly sprintOutcomes: ReadonlyArray<{
    readonly sprintIdx: number;
    readonly attempts: number;
    readonly generator: unknown;
    readonly evaluator: EvaluatorOutput;
  }>;
  readonly merger: unknown;
};

type AgentRef<I, O> = AgentDefinition<I, O>;

function resolveAgent<I, O>(
  registry: AgentRegistry | undefined,
  fallback: AgentRef<I, O>,
): AgentRef<I, O> {
  if (!registry) return fallback;
  const loaded = registry.get(fallback.id);
  if (!loaded) return fallback;
  return loaded as AgentRef<I, O>;
}

function assertNotAborted(
  signal: AbortSignal | undefined,
  at: PipelineStageName,
): void {
  if (signal?.aborted) {
    throw new PipelinePauseError(`Pause requested at ${at}`, at);
  }
}

function contextFor(
  agentId: string,
  runId: string,
  repoRoot: string,
  extra: Record<string, unknown> = {},
): AgentContext {
  return {
    agentId,
    runId,
    workingDir: repoRoot,
    metadata: extra,
  };
}

async function writePlanFile(
  repoRoot: string,
  runId: string,
  plan: PlannerOutput,
  maestroDir = '.maestro',
): Promise<void> {
  const path = join(repoRoot, maestroDir, 'runs', runId, 'plan.md');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializePlanMarkdown(plan), 'utf8');
}

async function writeInitialContract(
  repoRoot: string,
  runId: string,
  sprintIdx: number,
  sprint: PlannerOutput['sprints'][number],
  maestroDir = '.maestro',
): Promise<SprintContractFrontmatter> {
  const frontmatter = sprintContractFrontmatterSchema.parse({
    sprint: sprintIdx + 1,
    feature: sprint.name,
    status: 'agreed',
    acceptance_criteria: sprint.acceptance.length
      ? sprint.acceptance.map((description, idx) => ({
          id: `${sprint.id}-${idx + 1}`,
          description,
          verifier: 'manual',
        }))
      : [
          {
            id: `${sprint.id}-1`,
            description: sprint.description,
            verifier: 'manual',
          },
        ],
    negotiated_by: ['architect'],
    iterations: 0,
  });
  const body = `# Sprint ${sprintIdx + 1} — ${sprint.name}\n\n${sprint.objective}\n`;
  const serialized = writeSprintContract({ frontmatter, body });
  const path = join(
    repoRoot,
    maestroDir,
    'runs',
    runId,
    'contracts',
    `sprint-${sprintIdx + 1}.md`,
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serialized, 'utf8');
  return frontmatter;
}

async function updatePhase(
  options: PipelineRunOptions,
  phase: PipelineStageName,
  extras: Partial<RunState> = {},
): Promise<RunState> {
  options.bus.emit({
    type: 'pipeline.stage_entered',
    runId: options.runId,
    stage: phase,
    ...(extras.currentSprintIdx !== undefined
      ? { sprintIdx: extras.currentSprintIdx }
      : {}),
  });
  return options.store.update(options.runId, { phase, ...extras });
}

export async function runPipeline(
  options: PipelineRunOptions,
): Promise<PipelineRunResult> {
  const executor = options.executor ?? defaultAgentExecutor;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const userAgent = options.userAgent ?? 'maestro/0.1.0';
  const maestroDir = options.maestroDir;
  const startedAt = Date.now();

  const existing = await options.store.load(options.runId);
  const state =
    existing ??
    (await options.store.create({
      runId: options.runId,
      branch: options.branch,
      worktreePath: options.worktreePath,
      prompt: options.prompt,
      userAgent,
      providerDefaults: extractDefaults(options.config),
    }));

  if (!existing) {
    options.bus.emit({ type: 'pipeline.started', runId: options.runId });
  } else {
    options.bus.emit({
      type: 'pipeline.resumed',
      runId: options.runId,
      from: state.phase as PipelineStageName,
    });
  }

  const sprintOutcomes: Array<{
    sprintIdx: number;
    attempts: number;
    generator: unknown;
    evaluator: EvaluatorOutput;
  }> = [];

  try {
    // planning
    assertNotAborted(options.abortSignal, 'planning');
    await updatePhase(options, 'planning');
    const planner = resolveAgent(options.registry, plannerAgent);
    const rawPlan = await executor({
      definition: planner,
      input: { prompt: options.prompt },
      context: contextFor('planner', options.runId, options.repoRoot),
      bus: options.bus,
      config: options.config,
    });
    const plan = normalizePlannerModelOutput(rawPlan, {
      runId: options.runId,
      prompt: options.prompt,
    });
    await writePlanFile(options.repoRoot, options.runId, plan, maestroDir);

    const architectureDoc = await loadArchitectureDocument(
      options.repoRoot,
      options.architecture,
      maestroDir,
    );

    // per-sprint loop
    for (let sprintIdx = 0; sprintIdx < plan.sprints.length; sprintIdx += 1) {
      assertNotAborted(options.abortSignal, 'architecting');
      const sprint = plan.sprints[sprintIdx];
      if (!sprint) continue;
      options.bus.emit({
        type: 'pipeline.sprint_started',
        runId: options.runId,
        sprintIdx,
        totalSprints: plan.sprints.length,
      });

      // architecting
      await updatePhase(options, 'architecting', {
        currentSprintIdx: sprintIdx,
      });
      const architect = resolveAgent(options.registry, architectAgent);
      const rawArchitect = await executor({
        definition: architect,
        input: {
          plan,
          architecture: architectureDoc,
          sprint,
          sprintIdx,
        },
        context: contextFor('architect', options.runId, options.repoRoot),
        bus: options.bus,
        config: options.config,
      });
      const parsedArchitect = architectModelOutputSchema.parse(rawArchitect);
      const architectResult = finalizeArchitectOutput(parsedArchitect);
      if (architectResult.sprintIdx !== sprint.idx) {
        options.bus.emit({
          type: 'agent.decision',
          agentId: 'architect',
          runId: options.runId,
          message: `Architect sprintIdx ${architectResult.sprintIdx.toString()} != plan sprint.idx ${sprint.idx.toString()}; using plan idx for artifacts.`,
        });
      }
      const designDoc = renderArchitectNotesMarkdown(architectResult, sprint.name);
      await writeDesignNotesSprintFile(
        options.repoRoot,
        options.runId,
        sprint.idx,
        designDoc,
        maestroDir,
      );
      const embed = architectNotesForPlanEmbed(architectResult, sprint.name);
      await patchPlanFileWithArchitectNotes(
        options.repoRoot,
        options.runId,
        sprint.idx,
        embed,
        maestroDir,
      );
      if (!architectResult.approved) {
        const reason =
          architectResult.escalation?.reason ??
          architectResult.boundaryNotes ??
          architectResult.boundaryCheck;
        options.bus.emit({
          type: 'pipeline.sprint_escalated',
          runId: options.runId,
          sprintIdx,
          reason: `Architect: ${reason}`,
        });
        await options.store.update(options.runId, {
          phase: 'escalated',
          status: 'paused',
          escalation: { sprintIdx, reason: `Architect: ${reason}` },
          pausedAt: new Date().toISOString(),
        });
        throw new PipelineEscalationError(
          `Sprint ${sprintIdx + 1} blocked by Architect: ${reason}`,
          sprintIdx,
          reason,
        );
      }

      // contracting (minimal: seed a contract file; negotiation comes when we wire contract pkg in v0.2)
      assertNotAborted(options.abortSignal, 'contracting');
      await updatePhase(options, 'contracting', {
        currentSprintIdx: sprintIdx,
      });
      await writeInitialContract(
        options.repoRoot,
        options.runId,
        sprintIdx,
        sprint,
        maestroDir,
      );

      // generating + evaluating with retry budget
      const root = maestroRoot(options.repoRoot, maestroDir);
      const contractPath = join(
        root,
        'runs',
        options.runId,
        'contracts',
        `sprint-${(sprintIdx + 1).toString()}.md`,
      );
      const contractText = (await readOptionalUtf8(contractPath)) ?? '';

      const designNotesPath = join(
        root,
        'runs',
        options.runId,
        'design-notes',
        `design-notes-sprint-${(sprintIdx + 1).toString()}.md`,
      );
      const architectNotesText = (await readOptionalUtf8(designNotesPath)) ?? '';

      let previousHandoff: string | undefined;
      if (sprintIdx > 0) {
        previousHandoff = await readOptionalUtf8(
          handoffPath({
            repoRoot: options.repoRoot,
            runId: options.runId,
            ...(maestroDir !== undefined ? { maestroDir } : {}),
            sprint: sprintIdx,
          }),
        );
      }

      let attempts = 0;
      let generatorOutput: unknown;
      let evaluatorOutput: EvaluatorOutput | undefined;
      let lastEvaluatorFailures: readonly string[] = [];
      while (attempts < retries) {
        assertNotAborted(options.abortSignal, 'generating');
        attempts += 1;
        if (attempts > 1) {
          options.bus.emit({
            type: 'pipeline.sprint_retried',
            runId: options.runId,
            sprintIdx,
            retry: attempts - 1,
          });
        }
        await updatePhase(options, 'generating', {
          currentSprintIdx: sprintIdx,
          retriesRemaining: retries - attempts,
        });
        const generator = resolveAgent(options.registry, generatorAgent);
        generatorOutput = await executor({
          definition: generator,
          input: {
            runId: options.runId,
            sprintIdx,
            repoRoot: options.repoRoot,
            sprint,
            sprintContract: contractText,
            planFull: plan,
            architectNotes: architectNotesText,
            previousHandoff,
            ...(lastEvaluatorFailures.length > 0
              ? {
                  evaluatorFeedback: {
                    failures: [...lastEvaluatorFailures],
                  },
                }
              : {}),
          },
          context: contextFor('generator', options.runId, options.repoRoot),
          bus: options.bus,
          config: options.config,
        });

        assertNotAborted(options.abortSignal, 'evaluating');
        await updatePhase(options, 'evaluating', {
          currentSprintIdx: sprintIdx,
          retriesRemaining: retries - attempts,
        });
        const evaluator = resolveAgent(options.registry, evaluatorAgent);
        evaluatorOutput = (await executor({
          definition: evaluator,
          input: { sprint, acceptance: sprint.acceptance as string[] },
          context: contextFor('evaluator', options.runId, options.repoRoot),
          bus: options.bus,
          config: options.config,
        })) as EvaluatorOutput;

        if (evaluatorOutput.pass) break;
        lastEvaluatorFailures = evaluatorOutput.failures;
      }

      if (!evaluatorOutput || !evaluatorOutput.pass) {
        const reason =
          evaluatorOutput?.failures?.[0] ?? 'Retry budget exhausted';
        options.bus.emit({
          type: 'pipeline.sprint_escalated',
          runId: options.runId,
          sprintIdx,
          reason,
        });
        await options.store.update(options.runId, {
          phase: 'escalated',
          status: 'paused',
          escalation: { sprintIdx, reason },
          pausedAt: new Date().toISOString(),
        });
        throw new PipelineEscalationError(
          `Sprint ${sprintIdx + 1} escalated after ${attempts} attempt(s): ${reason}`,
          sprintIdx,
          reason,
        );
      }

      const parsedGenerator = generatorModelOutputSchema.parse(generatorOutput);

      await writeSprintSelfEval({
        repoRoot: options.repoRoot,
        runId: options.runId,
        ...(maestroDir !== undefined ? { maestroDir } : {}),
        sprint: sprint.idx,
        selfEval: parsedGenerator.selfEval,
      });

      sprintOutcomes.push({
        sprintIdx,
        attempts,
        generator: parsedGenerator,
        evaluator: evaluatorOutput,
      });

      await writeHandoff({
        repoRoot: options.repoRoot,
        runId: options.runId,
        ...(maestroDir !== undefined ? { maestroDir } : {}),
        handoff: {
          sprint: sprintIdx + 1,
          summary: parsedGenerator.handoffNotes.trim() || sprint.objective,
          changedFiles: extractChangedFiles(parsedGenerator),
          decisions: [],
          nextSteps: sprint.acceptance.slice(),
        },
      });
    }

    // merging
    assertNotAborted(options.abortSignal, 'merging');
    await updatePhase(options, 'merging');
    const merger = resolveAgent(options.registry, mergerAgent);
    const mergerOutput = await executor({
      definition: merger,
      input: { branch: options.branch, summary: plan.summary },
      context: contextFor('merger', options.runId, options.repoRoot),
      bus: options.bus,
      config: options.config,
    });

    const completedAt = new Date().toISOString();
    const finalState = await options.store.update(options.runId, {
      status: 'completed',
      phase: 'completed',
      completedAt,
    });

    options.bus.emit({
      type: 'pipeline.completed',
      runId: options.runId,
      durationMs: Date.now() - startedAt,
    });

    return {
      state: finalState,
      plan,
      sprintOutcomes,
      merger: mergerOutput,
    };
  } catch (error) {
    if (error instanceof PipelinePauseError) {
      await options.store.update(options.runId, {
        status: 'paused',
        pausedAt: new Date().toISOString(),
      });
      options.bus.emit({
        type: 'pipeline.paused',
        runId: options.runId,
        at: error.at,
      });
      throw error;
    }
    if (error instanceof PipelineEscalationError) throw error;

    const message = error instanceof Error ? error.message : String(error);
    const current = await options.store.load(options.runId);
    const at = (current?.phase ?? 'planning') as PipelineStageName;
    await options.store.update(options.runId, {
      status: 'failed',
      phase: 'failed',
    });
    options.bus.emit({
      type: 'pipeline.failed',
      runId: options.runId,
      error: message,
      at,
    });
    throw error;
  }
}

function extractChangedFiles(generatorOutput: unknown): readonly string[] {
  if (
    typeof generatorOutput === 'object' &&
    generatorOutput !== null &&
    'filesChanged' in generatorOutput &&
    Array.isArray((generatorOutput as { filesChanged: unknown }).filesChanged)
  ) {
    const list = (generatorOutput as { filesChanged: { path: string }[] })
      .filesChanged;
    return list.map((f) => f.path);
  }
  if (
    typeof generatorOutput === 'object' &&
    generatorOutput !== null &&
    'changedFiles' in generatorOutput &&
    Array.isArray((generatorOutput as { changedFiles: unknown }).changedFiles)
  ) {
    const list = (generatorOutput as { changedFiles: unknown[] }).changedFiles;
    return list.filter((f): f is string => typeof f === 'string');
  }
  return [];
}

async function readOptionalUtf8(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

function extractDefaults(
  config: MaestroConfig,
): Readonly<Record<string, string>> {
  const defaults: Record<string, string> = {};
  for (const [agentId, entry] of Object.entries(config.defaults)) {
    if (entry && typeof entry === 'object' && 'model' in entry) {
      const model = (entry as { model: unknown }).model;
      if (typeof model === 'string') defaults[agentId] = model;
    }
  }
  return defaults;
}
