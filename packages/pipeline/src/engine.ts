import {
  architectAgent,
  architectModelOutputSchema,
  architectNotesForPlanEmbed,
  evaluatorAgent,
  evaluatorFailuresForGenerator,
  finalizeArchitectOutput,
  generatorAgent,
  generatorModelOutputSchema,
  inferLabelsFromPaths,
  mergerAgent,
  mergerInputSchema,
  mergerModelOutputSchema,
  isPlannerEscalation,
  normalizePlannerModelOutput,
  plannerOutputSnapshotSchema,
  plannerAgent,
  renderArchitectNotesMarkdown,
  type AgentContext,
  type AgentDefinition,
  type AgentRegistry,
  type ArchitectPipelineResult,
  type EvaluatorModelOutput,
  type GeneratorInput,
  type MergerModelOutput,
  type PlannerOutput,
  type PlannerReplanContext,
} from '@maestro/agents';
import type { MaestroConfig } from '@maestro/config';
import { detectRemote, getWorkingTreeDiff, removeWorktree } from '@maestro/git';
import {
  sprintContractFrontmatterSchema,
  writeSprintContract,
  type SprintContractFrontmatter,
} from '@maestro/contract';
import type { EventBus, PipelineStageName } from '@maestro/core';
import {
  appendProjectLog,
  appendRunLog,
  completedExecPlanRelativePath,
  feedbackPath,
  handoffPath,
  maestroRoot,
  removePipelineProcessMarker,
  runPipelineProcessPath,
  runPlanPath,
  runPlanSnapshotPath,
  sprintOutcomeCheckpointPath,
  writeCompletedExecPlan,
  writeHandoff,
  writeSprintSelfEval,
  type EscalationSource,
  type PipelineFailureAt,
  type PipelineStage,
  type ResumeTarget,
  type RunState,
  type StateStore,
} from '@maestro/state';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { AgentExecutor } from './executor.js';
import { defaultAgentExecutor } from './executor.js';
import { defaultResumeTargetForEscalation } from './escalation-target.js';
import { PipelineEscalationError, PipelinePauseError } from './errors.js';
import {
  loadArchitectureDocument,
  patchPlanFileWithArchitectNotes,
  writeDesignNotesSprintFile,
} from './plan-architect-notes.js';
import { serializePlanMarkdown } from './plan-markdown.js';

export const DEFAULT_RETRIES = 3;

/** Max automatic Planner rewrites after Architect rejects a sprint (in-memory per run). */
export const DEFAULT_MAX_PLAN_REPLANS = 2;

export type {
  EvaluatorModelOutput,
  MergerModelOutput,
  PlannerOutput,
} from '@maestro/agents';

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
  /** Sobrepõe `config.merger.removeWorktreeOnSuccess`. */
  readonly removeWorktreeOnSuccess?: boolean;
  /** Sobrepõe `config.merger.requireDraftPr`. */
  readonly requireDraftPr?: boolean;
  /** Máximo de replans automáticos (Planner com feedback do Architect). */
  readonly maxPlanReplans?: number;
  /** Notas humanas (TUI) injectadas no generator/planner quando aplicável. */
  readonly humanFeedback?: string;
  /** Sobrepõe `RunState.escalation.resumeTarget` na retomada. */
  readonly resumeTargetOverride?: ResumeTarget;
};

export type PipelineRunResult = {
  readonly state: RunState;
  readonly plan: PlannerOutput;
  readonly sprintOutcomes: ReadonlyArray<{
    readonly sprintIdx: number;
    readonly attempts: number;
    readonly generator: unknown;
    readonly evaluator: EvaluatorModelOutput;
  }>;
  readonly merger: MergerModelOutput;
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
  workingDir: string,
  extra: Record<string, unknown> = {},
): AgentContext {
  return {
    agentId,
    runId,
    workingDir,
    metadata: extra,
  };
}

/** Raiz onde o código da run é editado (worktree ou igual a `repoRoot` sem worktree). */
function implementationRoot(
  options: Pick<PipelineRunOptions, 'worktreePath'>,
): string {
  return options.worktreePath;
}

function pipelineAgentMetadata(
  options: PipelineRunOptions,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    worktreeRoot: options.worktreePath,
    stateRepoRoot: options.repoRoot,
    ...extra,
  };
}

type SprintOutcomeAccum = {
  readonly sprintIdx: number;
  readonly attempts: number;
  readonly generator: unknown;
  readonly evaluator: EvaluatorModelOutput;
};

function slugifyForExecPlan(feature: string, runId: string): string {
  const raw = `${feature}-${runId}`.toLowerCase();
  const slug = raw.replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
  return (slug.length > 0 ? slug : 'exec-plan').slice(0, 120);
}

function canAutoResumeFromCheckpoint(state: RunState): boolean {
  if (state.status === 'failed') return true;
  if (state.status === 'paused') return true;
  return false;
}

function mapRunPhaseToFailureAt(phase: PipelineStage | undefined): PipelineFailureAt {
  switch (phase) {
    case 'discovering':
    case 'planning':
    case 'architecting':
    case 'contracting':
    case 'generating':
    case 'evaluating':
    case 'merging':
      return phase;
    default:
      return 'planning';
  }
}

function preservedPipelinePhaseAfterFailure(
  current: RunState | null,
  at: PipelineFailureAt,
): PipelineStage {
  if (!current) return at;
  const p = current.phase;
  if (
    p === 'idle' ||
    p === 'discovering' ||
    p === 'planning' ||
    p === 'architecting' ||
    p === 'contracting' ||
    p === 'generating' ||
    p === 'evaluating' ||
    p === 'merging'
  ) {
    return p;
  }
  return at;
}

function pipelineStageNameForFailureEvent(
  phase: PipelineStage | undefined,
  failure: RunState['failure'],
): PipelineStageName {
  if (failure && typeof failure === 'object' && 'at' in failure) {
    return failure.at;
  }
  return mapRunPhaseToFailureAt(phase);
}

async function readOptionalUtf8(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

async function writePlanSnapshotFile(
  repoRoot: string,
  runId: string,
  plan: PlannerOutput,
  maestroDir: string | undefined,
): Promise<void> {
  const path = runPlanSnapshotPath({
    repoRoot,
    runId,
    ...(maestroDir !== undefined ? { maestroDir } : {}),
  });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(plan)}\n`, 'utf8');
}

async function tryLoadPlanSnapshot(
  repoRoot: string,
  runId: string,
  maestroDir: string | undefined,
): Promise<PlannerOutput | null> {
  const path = runPlanSnapshotPath({
    repoRoot,
    runId,
    ...(maestroDir !== undefined ? { maestroDir } : {}),
  });
  const raw = await readOptionalUtf8(path);
  if (raw === undefined || raw.trim().length === 0) return null;
  try {
    const parsed = plannerOutputSnapshotSchema.parse(JSON.parse(raw) as unknown);
    return parsed as PlannerOutput;
  } catch {
    return null;
  }
}

async function handoffExistsForSprint(
  repoRoot: string,
  runId: string,
  sprintOneBased: number,
  maestroDir: string | undefined,
): Promise<boolean> {
  const path = handoffPath({
    repoRoot,
    runId,
    sprint: sprintOneBased,
    ...(maestroDir !== undefined ? { maestroDir } : {}),
  });
  const text = await readOptionalUtf8(path);
  return text !== undefined && text.trim().length > 0;
}

async function firstIncompleteSprintIndex(
  repoRoot: string,
  runId: string,
  plan: PlannerOutput,
  maestroDir: string | undefined,
): Promise<number> {
  for (let sprintIdx = 0; sprintIdx < plan.sprints.length; sprintIdx += 1) {
    const exists = await handoffExistsForSprint(
      repoRoot,
      runId,
      sprintIdx + 1,
      maestroDir,
    );
    if (!exists) return sprintIdx;
  }
  return plan.sprints.length;
}

async function sprintContractAndDesignNotesExist(
  repoRoot: string,
  runId: string,
  sprintIdx: number,
  maestroDir: string | undefined,
): Promise<boolean> {
  const root = maestroRoot(repoRoot, maestroDir);
  const contractPath = join(
    root,
    'runs',
    runId,
    'contracts',
    `sprint-${(sprintIdx + 1).toString()}.md`,
  );
  const designNotesPath = join(
    root,
    'runs',
    runId,
    'design-notes',
    `design-notes-sprint-${(sprintIdx + 1).toString()}.md`,
  );
  const c = await readOptionalUtf8(contractPath);
  const d = await readOptionalUtf8(designNotesPath);
  return (
    c !== undefined &&
    c.trim().length > 0 &&
    d !== undefined &&
    d.trim().length > 0
  );
}

async function writeSprintOutcomeCheckpoint(
  options: PipelineRunOptions,
  sprintOneBased: number,
  outcome: SprintOutcomeAccum,
  maestroDir: string | undefined,
): Promise<void> {
  const path = sprintOutcomeCheckpointPath({
    repoRoot: options.repoRoot,
    runId: options.runId,
    sprintOneBased,
    ...(maestroDir !== undefined ? { maestroDir } : {}),
  });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(outcome)}\n`, 'utf8');
}

async function loadCompletedSprintOutcomes(
  options: PipelineRunOptions,
  firstIncompleteSprintIdx: number,
  maestroDir: string | undefined,
): Promise<SprintOutcomeAccum[]> {
  const out: SprintOutcomeAccum[] = [];
  for (let i = 0; i < firstIncompleteSprintIdx; i += 1) {
    const path = sprintOutcomeCheckpointPath({
      repoRoot: options.repoRoot,
      runId: options.runId,
      sprintOneBased: i + 1,
      ...(maestroDir !== undefined ? { maestroDir } : {}),
    });
    const raw = await readOptionalUtf8(path);
    if (raw === undefined || raw.trim().length === 0) {
      return [];
    }
    try {
      out.push(JSON.parse(raw) as SprintOutcomeAccum);
    } catch {
      return [];
    }
  }
  return out;
}

function renderCompletedExecPlanMarkdown(options: {
  readonly runId: string;
  readonly branch: string;
  readonly plan: PlannerOutput;
  readonly sprintOutcomes: readonly SprintOutcomeAccum[];
  readonly mergerSummary?: string;
}): string {
  const lines: string[] = [];
  lines.push(`# Exec plan — ${options.plan.feature}`);
  lines.push('');
  lines.push(`- **Run ID:** \`${options.runId}\``);
  lines.push(`- **Branch:** \`${options.branch}\``);
  lines.push('');
  if (options.mergerSummary?.trim()) {
    lines.push('## Merger');
    lines.push('');
    lines.push(options.mergerSummary.trim());
    lines.push('');
  }
  lines.push('## Plan summary');
  lines.push('');
  lines.push(options.plan.summary);
  lines.push('');
  lines.push('## Sprints');
  lines.push('');
  for (const o of options.sprintOutcomes) {
    const sprint = options.plan.sprints[o.sprintIdx];
    const title = sprint?.name ?? `Sprint ${(o.sprintIdx + 1).toString()}`;
    lines.push(`### ${title}`);
    lines.push('');
    lines.push(`- **Evaluator:** ${o.evaluator.decision}`);
    lines.push(`- **Attempts:** ${o.attempts.toString()}`);
    if (sprint?.acceptance.length) {
      lines.push('- **Acceptance:**');
      for (const c of sprint.acceptance) {
        lines.push(`  - ${c}`);
      }
    }
    lines.push('');
  }
  lines.push('## Aggregated acceptance');
  lines.push('');
  for (const c of options.plan.sprints.flatMap((s) => s.acceptance)) {
    lines.push(`- ${c}`);
  }
  lines.push('');
  return lines.join('\n');
}

async function writeEvaluatorFeedbackMarkdown(
  options: PipelineRunOptions,
  sprintNumber: number,
  iteration: number,
  output: EvaluatorModelOutput,
  maestroDir: string | undefined,
): Promise<void> {
  const path = feedbackPath({
    repoRoot: options.repoRoot,
    runId: options.runId,
    ...(maestroDir !== undefined ? { maestroDir } : {}),
    sprint: sprintNumber,
    iteration,
  });
  await mkdir(dirname(path), { recursive: true });
  const fm = [
    '---',
    `decision: ${output.decision}`,
    `runId: ${options.runId}`,
    `sprint: ${sprintNumber.toString()}`,
    `iteration: ${iteration.toString()}`,
    '---',
    '',
  ].join('\n');
  await writeFile(path, `${fm}${output.structuredFeedback}`, 'utf8');
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
  await writePlanSnapshotFile(repoRoot, runId, plan, maestroDir);
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

const PLAN_REASON_SUMMARY_MAX = 400;

function summarizePlanForReplan(plan: PlannerOutput): string {
  return plan.sprints
    .map(
      (sp) =>
        `Sprint ${sp.idx.toString()} — ${sp.name}: ${sp.objective}`,
    )
    .join('\n');
}

function summarizeArchitectBlockReason(
  architectResult: ArchitectPipelineResult,
): string {
  const reason =
    architectResult.escalation?.reason ??
    architectResult.boundaryNotes ??
    architectResult.boundaryCheck;
  const full = `Architect: ${reason}`;
  return full.length > PLAN_REASON_SUMMARY_MAX
    ? `${full.slice(0, PLAN_REASON_SUMMARY_MAX)}…`
    : full;
}

function buildPlannerReplanContext(
  plan: PlannerOutput,
  sprintIdx: number,
  architectResult: ArchitectPipelineResult,
  attempt: number,
): PlannerReplanContext {
  const sprint = plan.sprints[sprintIdx];
  if (sprint === undefined) {
    throw new Error(`Invalid sprintIdx ${sprintIdx.toString()} for replan`);
  }
  return {
    attempt,
    blockedSprintIdx: sprintIdx,
    blockedSprintName: sprint.name,
    blockedSprintObjective: sprint.objective,
    boundaryCheck: architectResult.boundaryCheck,
    previousPlanSummary: summarizePlanForReplan(plan),
    ...(architectResult.boundaryNotes != null &&
    architectResult.boundaryNotes.trim().length > 0
      ? { boundaryNotes: architectResult.boundaryNotes }
      : {}),
    ...(architectResult.escalation != null &&
    architectResult.escalation.reason.trim().length > 0
      ? { escalationReason: architectResult.escalation.reason }
      : {}),
  };
}

type EscalateAndThrowArgs = {
  readonly sprintIdx: number;
  readonly reason: string;
  readonly source: EscalationSource;
  readonly phaseAtEscalation: PipelineFailureAt;
  readonly message: string;
  readonly resumeTarget?: ResumeTarget;
  readonly artifactHints?: readonly string[];
  readonly evaluatorRetryExhausted?: boolean;
};

async function escalateAndThrow(
  options: PipelineRunOptions,
  maestroDir: string | undefined,
  args: EscalateAndThrowArgs,
): Promise<never> {
  const resumeTarget =
    args.resumeTarget ??
    defaultResumeTargetForEscalation({
      source: args.source,
      phaseAtEscalation: args.phaseAtEscalation,
      reason: args.reason,
      ...(args.evaluatorRetryExhausted === true
        ? { evaluatorRetryExhausted: true }
        : {}),
    });
  await options.store.update(options.runId, {
    phase: 'escalated',
    status: 'paused',
    escalation: {
      reason: args.reason,
      sprintIdx: args.sprintIdx,
      source: args.source,
      phaseAtEscalation: args.phaseAtEscalation,
      resumeTarget,
      ...(args.artifactHints !== undefined
        ? { artifactHints: [...args.artifactHints] }
        : {}),
    },
    pausedAt: new Date().toISOString(),
  });
  options.bus.emit({
    type: 'pipeline.sprint_escalated',
    runId: options.runId,
    sprintIdx: args.sprintIdx,
    reason: args.reason,
    source: args.source,
    phaseAtEscalation: args.phaseAtEscalation,
    resumeTarget,
    ...(args.artifactHints !== undefined
      ? { artifactHints: args.artifactHints }
      : {}),
  });
  options.bus.emit({
    type: 'pipeline.escalation_pending',
    runId: options.runId,
    sprintIdx: args.sprintIdx,
    reason: args.reason,
    source: args.source,
    phaseAtEscalation: args.phaseAtEscalation,
    resumeTarget,
    ...(args.artifactHints !== undefined
      ? { artifactHints: args.artifactHints }
      : {}),
  });
  await appendRunLog({
    repoRoot: options.repoRoot,
    runId: options.runId,
    ...(maestroDir !== undefined ? { maestroDir } : {}),
    entry: {
      event: 'sprint_escalated',
      detail: `${args.source} @${args.phaseAtEscalation} → ${resumeTarget}`,
    },
  });
  throw new PipelineEscalationError(
    args.message,
    args.sprintIdx,
    args.reason,
    args.source,
    args.phaseAtEscalation,
    resumeTarget,
    args.artifactHints,
  );
}

function buildPlannerReplanContextFromEscalation(
  plan: PlannerOutput,
  sprintIdx: number,
  architectSummary: string,
  humanNotes: string | undefined,
  attempt: number,
): PlannerReplanContext {
  const sprint = plan.sprints[sprintIdx];
  if (sprint === undefined) {
    throw new Error(`Invalid sprintIdx ${sprintIdx.toString()} for replan`);
  }
  const notes = [architectSummary, humanNotes]
    .filter((s) => s !== undefined && s.trim().length > 0)
    .join('\n\n');
  return {
    attempt,
    blockedSprintIdx: sprintIdx,
    blockedSprintName: sprint.name,
    blockedSprintObjective: sprint.objective,
    boundaryCheck: 'violation',
    previousPlanSummary: summarizePlanForReplan(plan),
    boundaryNotes: notes.length > 0 ? notes : architectSummary,
    ...(humanNotes !== undefined && humanNotes.trim().length > 0
      ? { humanGuidance: humanNotes.trim() }
      : {}),
  };
}

async function runPlannerPhase(
  options: PipelineRunOptions,
  executor: AgentExecutor,
  replan: PlannerReplanContext | undefined,
  maestroDir: string | undefined,
): Promise<PlannerOutput> {
  assertNotAborted(options.abortSignal, 'planning');
  await updatePhase(options, 'planning');
  const planner = resolveAgent(options.registry, plannerAgent);
  const rawPlan = await executor({
    definition: planner,
    input:
      replan === undefined
        ? {
            prompt: options.prompt,
            ...(options.humanFeedback !== undefined &&
            options.humanFeedback.trim().length > 0
              ? { humanGuidance: options.humanFeedback.trim() }
              : {}),
          }
        : {
            prompt: options.prompt,
            replan: {
              ...replan,
              ...((options.humanFeedback?.trim().length ?? 0) > 0
                ? {
                    humanGuidance: [
                      'humanGuidance' in replan &&
                      typeof replan.humanGuidance === 'string'
                        ? replan.humanGuidance
                        : undefined,
                      options.humanFeedback!.trim(),
                    ]
                      .filter(
                        (s): s is string =>
                          typeof s === 'string' && s.trim().length > 0,
                      )
                      .join('\n\n'),
                  }
                : {}),
            },
          },
    context: contextFor(
      'planner',
      options.runId,
      implementationRoot(options),
      pipelineAgentMetadata(options),
    ),
    bus: options.bus,
    config: options.config,
  });
  if (isPlannerEscalation(rawPlan)) {
    const r =
      typeof rawPlan.escalationReason === 'string'
        ? rawPlan.escalationReason.trim()
        : '';
    const reason = r.length > 0 ? r : 'Planner escalated';
    await escalateAndThrow(options, maestroDir, {
      sprintIdx: 0,
      reason,
      source: 'planner',
      phaseAtEscalation: 'planning',
      message: `Planner escalation: ${reason}`,
    });
  }
  return normalizePlannerModelOutput(rawPlan, {
    runId: options.runId,
    prompt: options.prompt,
  });
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
    const from: PipelineStageName | 'escalated' =
      existing.phase === 'escalated'
        ? 'escalated'
        : (existing.phase as PipelineStageName);
    const phaseBeforeEscalation =
      existing.phase === 'escalated' && existing.escalation
        ? existing.escalation.phaseAtEscalation
        : undefined;
    options.bus.emit({
      type: 'pipeline.resumed',
      runId: options.runId,
      from,
      ...(phaseBeforeEscalation !== undefined
        ? { phaseBeforeEscalation }
        : {}),
    });
  }

  const sprintOutcomes: Array<{
    sprintIdx: number;
    attempts: number;
    generator: unknown;
    evaluator: EvaluatorModelOutput;
  }> = [];

  const pipelineProcessPath = runPipelineProcessPath({
    repoRoot: options.repoRoot,
    runId: options.runId,
    ...(maestroDir !== undefined ? { maestroDir } : {}),
  });
  await mkdir(dirname(pipelineProcessPath), { recursive: true });
  await writeFile(
    pipelineProcessPath,
    `${JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
    })}\n`,
    'utf8',
  );

  try {
    if (!existing) {
      await appendRunLog({
        repoRoot: options.repoRoot,
        runId: options.runId,
        ...(maestroDir !== undefined ? { maestroDir } : {}),
        entry: { event: 'pipeline.started' },
      });
    }
    const maxPlanReplans = options.maxPlanReplans ?? DEFAULT_MAX_PLAN_REPLANS;
    let planReplansUsed = 0;
    const didAutoResume =
      options.resume === true &&
      existing !== null &&
      canAutoResumeFromCheckpoint(existing);

    let escalatedResume: {
      sprintIdx: number;
      resumeTarget: ResumeTarget;
      humanGuidance: string | undefined;
      reason: string;
    } | null = null;
    if (
      options.resume === true &&
      existing !== null &&
      existing.phase === 'escalated' &&
      existing.escalation
    ) {
      const e = existing.escalation;
      escalatedResume = {
        sprintIdx: e.sprintIdx,
        resumeTarget:
          options.resumeTargetOverride ?? e.resumeTarget,
        humanGuidance:
          options.humanFeedback !== undefined
            ? options.humanFeedback
            : e.humanFeedback?.text,
        reason: e.reason,
      };
      await options.store.update(options.runId, {
        status: 'running',
        escalation: undefined,
        failure: null,
        phase: 'idle',
      });
      await appendRunLog({
        repoRoot: options.repoRoot,
        runId: options.runId,
        ...(maestroDir !== undefined ? { maestroDir } : {}),
        entry: { event: 'pipeline.resumed', detail: 'from_escalated' },
      });
    }

    let plan: PlannerOutput;
    let startSprintIdx = 0;

    if (didAutoResume) {
      const snapped = await tryLoadPlanSnapshot(
        options.repoRoot,
        options.runId,
        maestroDir,
      );
      if (snapped) {
        plan = snapped;
        await options.store.update(options.runId, {
          status: 'running',
          failure: null,
        });
        startSprintIdx = await firstIncompleteSprintIndex(
          options.repoRoot,
          options.runId,
          plan,
          maestroDir,
        );
        const loaded = await loadCompletedSprintOutcomes(
          options,
          startSprintIdx,
          maestroDir,
        );
        if (loaded.length === startSprintIdx) {
          for (const row of loaded) {
            sprintOutcomes.push(row);
          }
        } else {
          plan = await runPlannerPhase(options, executor, undefined, maestroDir);
          await writePlanFile(options.repoRoot, options.runId, plan, maestroDir);
          startSprintIdx = 0;
        }
      } else {
        plan = await runPlannerPhase(options, executor, undefined, maestroDir);
        await writePlanFile(options.repoRoot, options.runId, plan, maestroDir);
      }
    } else {
      plan = await runPlannerPhase(options, executor, undefined, maestroDir);
      await writePlanFile(options.repoRoot, options.runId, plan, maestroDir);
    }

    const architectureDoc = await loadArchitectureDocument(
      options.repoRoot,
      options.architecture,
      maestroDir,
    );

    let replanLoopPass = 0;
    replanLoop: for (;;) {
      const sprintLoopStart = replanLoopPass === 0 ? startSprintIdx : 0;
      replanLoopPass += 1;
      for (
        let sprintIdx = sprintLoopStart;
        sprintIdx < plan.sprints.length;
        sprintIdx += 1
      ) {
      assertNotAborted(options.abortSignal, 'architecting');
      const sprint = plan.sprints[sprintIdx];
      if (!sprint) continue;
      options.bus.emit({
        type: 'pipeline.sprint_started',
        runId: options.runId,
        sprintIdx,
        totalSprints: plan.sprints.length,
      });

      if (
        escalatedResume !== null &&
        sprintIdx === escalatedResume.sprintIdx &&
        replanLoopPass === 1 &&
        escalatedResume.resumeTarget === 'ReplanOnly'
      ) {
        plan = await runPlannerPhase(
          options,
          executor,
          buildPlannerReplanContextFromEscalation(
            plan,
            sprintIdx,
            escalatedResume.reason,
            escalatedResume.humanGuidance,
            1,
          ),
          maestroDir,
        );
        await writePlanFile(
          options.repoRoot,
          options.runId,
          plan,
          maestroDir,
        );
        escalatedResume = null;
        startSprintIdx = 0;
        continue replanLoop;
      }

      const resumeFirstIncomplete =
        didAutoResume &&
        sprintIdx === startSprintIdx &&
        replanLoopPass === 1;

      const hasArtifacts = await sprintContractAndDesignNotesExist(
        options.repoRoot,
        options.runId,
        sprintIdx,
        maestroDir,
      );

      const effectiveResume =
        escalatedResume !== null &&
        sprintIdx === escalatedResume.sprintIdx &&
        replanLoopPass === 1
          ? escalatedResume.resumeTarget
          : null;

      let skipArchitect = false;
      let skipContract = false;
      if (resumeFirstIncomplete) {
        if (effectiveResume === 'ReArchitectAndContract') {
          skipArchitect = false;
          skipContract = false;
        } else if (effectiveResume === 'ReSeedContract') {
          skipArchitect = true;
          skipContract = false;
        } else if (
          effectiveResume === 'ContinueGenerate' ||
          effectiveResume === null
        ) {
          if (hasArtifacts) {
            skipArchitect = true;
            skipContract = true;
          }
        }
      }

      const skipArchitectAndContract = skipArchitect && skipContract;

      // architecting + contracting (skipped when resuming a sprint with artifacts on disk)
      if (skipArchitect && !skipContract) {
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
      } else if (!skipArchitectAndContract) {
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
        context: contextFor(
          'architect',
          options.runId,
          implementationRoot(options),
          pipelineAgentMetadata(options),
        ),
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
      if (!architectResult.approved) {
        const reason =
          architectResult.escalation?.reason ??
          architectResult.boundaryNotes ??
          architectResult.boundaryCheck;

        if (planReplansUsed < maxPlanReplans) {
          planReplansUsed += 1;
          options.bus.emit({
            type: 'pipeline.plan_revised',
            runId: options.runId,
            attempt: planReplansUsed,
            reasonSummary: summarizeArchitectBlockReason(architectResult),
          });
          plan = await runPlannerPhase(
            options,
            executor,
            buildPlannerReplanContext(
              plan,
              sprintIdx,
              architectResult,
              planReplansUsed,
            ),
            maestroDir,
          );
          await writePlanFile(
            options.repoRoot,
            options.runId,
            plan,
            maestroDir,
          );
          continue replanLoop;
        }

        const archReason = `Architect: ${String(reason)}`;
        const hints = [
          `.maestro/runs/${options.runId}/design-notes/design-notes-sprint-${(sprintIdx + 1).toString()}.md`,
        ];
        await escalateAndThrow(options, maestroDir, {
          sprintIdx,
          reason: archReason,
          source: 'architect',
          phaseAtEscalation: 'architecting',
          message: `Sprint ${sprintIdx + 1} blocked by Architect: ${String(reason)}`,
          artifactHints: hints,
        });
      }

      const designDoc = renderArchitectNotesMarkdown(
        architectResult,
        sprint.name,
      );
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
      }

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
      const architectNotesText =
        (await readOptionalUtf8(designNotesPath)) ?? '';

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

      const humanGuidanceForGen =
        (() => {
          const fromOpts = options.humanFeedback?.trim();
          if (fromOpts && fromOpts.length > 0) return fromOpts;
          if (
            escalatedResume !== null &&
            sprintIdx === escalatedResume.sprintIdx &&
            replanLoopPass === 1
          ) {
            const g = escalatedResume.humanGuidance?.trim();
            return g && g.length > 0 ? g : undefined;
          }
          return undefined;
        })();

      let attempts = 0;
      let generatorOutput: unknown;
      let evaluatorOutput: EvaluatorModelOutput | undefined;
      let pendingEvaluatorFeedback:
        | GeneratorInput['evaluatorFeedback']
        | undefined;
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
            implementationRoot: implementationRoot(options),
            stateRepoRoot: options.repoRoot,
            sprint,
            sprintContract: contractText,
            planFull: plan,
            architectNotes: architectNotesText,
            previousHandoff,
            ...(pendingEvaluatorFeedback !== undefined
              ? { evaluatorFeedback: pendingEvaluatorFeedback }
              : {}),
            ...(humanGuidanceForGen !== undefined
              ? { humanGuidance: humanGuidanceForGen }
              : {}),
          },
          context: contextFor(
            'generator',
            options.runId,
            implementationRoot(options),
            pipelineAgentMetadata(options, {
              ...(maestroDir !== undefined ? { maestroDir } : {}),
            }),
          ),
          bus: options.bus,
          config: options.config,
        });

        assertNotAborted(options.abortSignal, 'evaluating');
        await updatePhase(options, 'evaluating', {
          currentSprintIdx: sprintIdx,
          retriesRemaining: retries - attempts,
        });
        const codeDiffText = await getWorkingTreeDiff(options.worktreePath);
        const evaluator = resolveAgent(options.registry, evaluatorAgent);
        evaluatorOutput = (await executor({
          definition: evaluator,
          input: {
            runId: options.runId,
            sprintIdx: sprint.idx,
            repoRoot: options.repoRoot,
            worktreeRoot: options.worktreePath,
            iteration: attempts,
            sprintContract: contractText,
            generatorOutput,
            codeDiff: codeDiffText,
            sprint,
            acceptance: [...sprint.acceptance],
          },
          context: contextFor(
            'evaluator',
            options.runId,
            implementationRoot(options),
            pipelineAgentMetadata(options, {
              ...(maestroDir !== undefined ? { maestroDir } : {}),
            }),
          ),
          bus: options.bus,
          config: options.config,
        })) as EvaluatorModelOutput;

        await writeEvaluatorFeedbackMarkdown(
          options,
          sprint.idx,
          attempts,
          evaluatorOutput,
          maestroDir,
        );

        if (evaluatorOutput.decision === 'passed') {
          pendingEvaluatorFeedback = undefined;
          if (
            escalatedResume !== null &&
            escalatedResume.sprintIdx === sprintIdx
          ) {
            escalatedResume = null;
          }
          break;
        }

        if (evaluatorOutput.decision === 'escalated') {
          const reason =
            evaluatorOutput.suggestedActions[0] ??
            evaluatorOutput.structuredFeedback
              .split('\n')
              .find((l) => l.trim().length > 0) ??
            'Evaluator escalated';
          const hints = [
            `.maestro/runs/${options.runId}/contracts/sprint-${(sprintIdx + 1).toString()}.md`,
            `.maestro/runs/${options.runId}/feedback/sprint-${sprint.idx.toString()}-eval-${attempts.toString()}.md`,
          ];
          await escalateAndThrow(options, maestroDir, {
            sprintIdx,
            reason,
            source: 'evaluator',
            phaseAtEscalation: 'evaluating',
            message: `Sprint ${sprintIdx + 1} escalated by evaluator: ${reason}`,
            artifactHints: hints,
          });
        }

        pendingEvaluatorFeedback = {
          failures: [...evaluatorFailuresForGenerator(evaluatorOutput)],
          structuredFeedback: evaluatorOutput.structuredFeedback,
          suggestedActions: [...evaluatorOutput.suggestedActions],
          decision: 'failed',
        };
      }

      if (!evaluatorOutput || evaluatorOutput.decision !== 'passed') {
        const reason =
          evaluatorOutput?.suggestedActions?.[0] ??
          evaluatorOutput?.structuredFeedback
            ?.split('\n')
            .find((l) => l.trim().length > 0) ??
          'Retry budget exhausted';
        const hints = [
          `.maestro/runs/${options.runId}/contracts/sprint-${(sprintIdx + 1).toString()}.md`,
        ];
        await escalateAndThrow(options, maestroDir, {
          sprintIdx,
          reason,
          source: 'pipeline',
          phaseAtEscalation: 'evaluating',
          message: `Sprint ${sprintIdx + 1} escalated after ${attempts.toString()} attempt(s): ${reason}`,
          artifactHints: hints,
          evaluatorRetryExhausted: true,
        });
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
        evaluator: evaluatorOutput!,
      });

      await writeSprintOutcomeCheckpoint(
        options,
        sprintIdx + 1,
        {
          sprintIdx,
          attempts,
          generator: parsedGenerator,
          evaluator: evaluatorOutput!,
        },
        maestroDir,
      );

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

      break replanLoop;
    }

    // merging
    assertNotAborted(options.abortSignal, 'merging');
    await updatePhase(options, 'merging');
    const merger = resolveAgent(options.registry, mergerAgent);

    const planMarkdown =
      (await readOptionalUtf8(
        runPlanPath({
          repoRoot: options.repoRoot,
          runId: options.runId,
          ...(maestroDir !== undefined ? { maestroDir } : {}),
        }),
      )) ?? '';
    if (planMarkdown.length === 0) {
      throw new Error(
        `Missing plan markdown for run ${options.runId} (expected plan.md under the maestro run directory).`,
      );
    }

    const remoteInfo = await detectRemote({ cwd: options.worktreePath });
    const remote = remoteInfo
      ? {
          platform: remoteInfo.platform,
          url: remoteInfo.url,
          name: remoteInfo.name,
        }
      : null;

    const allPaths: string[] = [];
    for (const o of sprintOutcomes) {
      allPaths.push(...extractChangedFiles(o.generator));
    }
    const inferred = inferLabelsFromPaths(allPaths);
    const suggestedLabels = [
      ...new Set([...inferred, 'maestro', 'ai-generated']),
    ].sort();

    const execPlanFileName = `${slugifyForExecPlan(plan.feature, options.runId)}.md`;
    const execPlanRelativePath =
      completedExecPlanRelativePath(execPlanFileName);

    const mergerCfg = options.config.merger;
    const requireDraftPr = options.requireDraftPr ?? mergerCfg.requireDraftPr;

    const mergerInput = mergerInputSchema.parse({
      runId: options.runId,
      repoRoot: options.repoRoot,
      worktreeRoot: options.worktreePath,
      branch: options.branch,
      planMarkdown,
      planSummary: plan.summary,
      featureName: plan.feature,
      sprintOutcomes: sprintOutcomes.map((o) => {
        const sprint = plan.sprints[o.sprintIdx];
        return {
          sprintIdx: o.sprintIdx,
          name: sprint?.name ?? `Sprint ${(o.sprintIdx + 1).toString()}`,
          objective: sprint?.objective,
          filesChanged: [...extractChangedFiles(o.generator)],
          evaluatorDecision: o.evaluator.decision,
          attempts: o.attempts,
        };
      }),
      aggregatedAcceptance: plan.sprints.flatMap((s) => s.acceptance),
      remote,
      requireDraftPr,
      pipelineStartedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      suggestedLabels,
      execPlanRelativePath,
      ...(mergerCfg.coAuthoredByLine !== undefined
        ? { coAuthoredByLine: mergerCfg.coAuthoredByLine }
        : {}),
    });

    const rawMerger = await executor({
      definition: merger,
      input: mergerInput,
      context: contextFor(
        'merger',
        options.runId,
        implementationRoot(options),
        pipelineAgentMetadata(options, {
          ...(maestroDir !== undefined ? { maestroDir } : {}),
        }),
      ),
      bus: options.bus,
      config: options.config,
    });

    const parsedMerger = mergerModelOutputSchema.parse(rawMerger);

    const execPlanMarkdown = renderCompletedExecPlanMarkdown({
      runId: options.runId,
      branch: options.branch,
      plan,
      sprintOutcomes,
      ...(parsedMerger.summary != null &&
      parsedMerger.summary.trim().length > 0
        ? { mergerSummary: parsedMerger.summary }
        : {}),
    });

    const { relativePathPosix } = await writeCompletedExecPlan({
      repoRoot: options.repoRoot,
      ...(maestroDir !== undefined ? { maestroDir } : {}),
      fileName: execPlanFileName,
      markdown: execPlanMarkdown,
    });

    let cleanupDone = parsedMerger.cleanupDone;
    const removeWt =
      options.removeWorktreeOnSuccess ?? mergerCfg.removeWorktreeOnSuccess;
    if (
      removeWt &&
      parsedMerger.runStatus === 'completed' &&
      options.worktreePath !== options.repoRoot
    ) {
      await removeWorktree({
        repoRoot: options.repoRoot,
        worktreePath: options.worktreePath,
        force: true,
      });
      cleanupDone = true;
    }

    const mergerOutput: MergerModelOutput = {
      ...parsedMerger,
      execPlanPath: relativePathPosix,
      cleanupDone,
    };

    await appendRunLog({
      repoRoot: options.repoRoot,
      runId: options.runId,
      ...(maestroDir !== undefined ? { maestroDir } : {}),
      entry: {
        event: 'pipeline.completed',
        detail: mergerOutput.prUrl
          ? `PR ${mergerOutput.prUrl}`
          : remote
            ? 'Merge phase finished (no PR URL in model output).'
            : 'Merge phase finished (no git remote detected).',
      },
    });
    await appendProjectLog({
      repoRoot: options.repoRoot,
      ...(maestroDir !== undefined ? { maestroDir } : {}),
      entry: {
        runId: options.runId,
        event: 'pipeline.completed',
        detail: mergerOutput.prUrl
          ? `PR ${mergerOutput.prUrl}`
          : remote
            ? 'Merge phase finished (no PR URL in model output).'
            : 'Merge phase finished (no git remote detected).',
      },
    });

    const completedAt = new Date().toISOString();
    const finalState = await options.store.update(options.runId, {
      status: 'completed',
      phase: 'completed',
      completedAt,
      failure: null,
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
    const failureAt = mapRunPhaseToFailureAt(current?.phase);
    const eventAt = pipelineStageNameForFailureEvent(
      current?.phase,
      current?.failure,
    );
    const preservedPhase = preservedPipelinePhaseAfterFailure(
      current,
      failureAt,
    );
    const failedAt = new Date().toISOString();
    await options.store.update(options.runId, {
      status: 'failed',
      phase: preservedPhase,
      failure: {
        message,
        at: failureAt,
        failedAt,
      },
    });
    options.bus.emit({
      type: 'pipeline.failed',
      runId: options.runId,
      error: message,
      at: eventAt,
    });
    throw error;
  } finally {
    await removePipelineProcessMarker(pipelineProcessPath);
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
