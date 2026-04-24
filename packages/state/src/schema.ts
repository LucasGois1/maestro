import { z } from 'zod';

export const RUN_STATUSES = [
  'running',
  'paused',
  'completed',
  'failed',
  'canceled',
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export const PIPELINE_STAGES = [
  'idle',
  'discovering',
  'planning',
  'architecting',
  'contracting',
  'generating',
  'evaluating',
  'merging',
  'escalated',
  'completed',
  'failed',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Estágio operacional onde ocorreu um erro (alinha com `PipelineStageName` em `@maestro/core`). */
export const PIPELINE_FAILURE_AT = [
  'discovering',
  'planning',
  'architecting',
  'contracting',
  'generating',
  'evaluating',
  'merging',
] as const;

export type PipelineFailureAt = (typeof PIPELINE_FAILURE_AT)[number];

export const pipelineFailureAtSchema = z.enum(PIPELINE_FAILURE_AT);

/** Origem da escalação persistida em `RunState.escalation`. */
export const ESCALATION_SOURCES = [
  'architect',
  'evaluator',
  'planner',
  'pipeline',
] as const;

export type EscalationSource = (typeof ESCALATION_SOURCES)[number];

export const escalationSourceSchema = z.enum(ESCALATION_SOURCES);

/** Alvo semântico para retomada após escalação humana. */
export const RESUME_TARGETS = [
  'ContinueGenerate',
  'ReSeedContract',
  'ReArchitectAndContract',
  'ReplanOnly',
] as const;

export type ResumeTarget = (typeof RESUME_TARGETS)[number];

export const resumeTargetSchema = z.enum(RESUME_TARGETS);

const isoString = z.iso.datetime();

export const escalationHumanFeedbackSchema = z
  .object({
    text: z.string().min(1),
    submittedAt: isoString,
  })
  .strict();

export type EscalationHumanFeedback = z.output<
  typeof escalationHumanFeedbackSchema
>;

export const planningInterviewModeSchema = z.enum([
  'round',
  'continue_gate',
  'summary_review',
]);

export const planningInterviewQuestionSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    topic: z.string().min(1),
  })
  .strict();

export const planningInterviewAnswerSchema = z
  .object({
    questionId: z.string().min(1),
    answer: z.string().min(1),
  })
  .strict();

export const planningInterviewStateSchema = z
  .object({
    mode: planningInterviewModeSchema,
    roundInBlock: z.number().int().min(1),
    blockIndex: z.number().int().min(1),
    totalRounds: z.number().int().min(1),
    questions: z.array(planningInterviewQuestionSchema),
    answers: z.array(planningInterviewAnswerSchema),
    summaryMarkdown: z.union([z.string(), z.null()]),
    contextTrail: z.array(z.string().min(1)),
  })
  .strict();

export type PlanningInterviewMode = z.output<
  typeof planningInterviewModeSchema
>;
export type PlanningInterviewQuestion = z.output<
  typeof planningInterviewQuestionSchema
>;
export type PlanningInterviewAnswer = z.output<
  typeof planningInterviewAnswerSchema
>;
export type RunStatePlanningInterview = z.output<
  typeof planningInterviewStateSchema
>;

const escalationRawSchema = z
  .object({
    reason: z.string().min(1),
    sprintIdx: z.number().int().nonnegative(),
    source: escalationSourceSchema.optional(),
    phaseAtEscalation: pipelineFailureAtSchema.optional(),
    resumeTarget: resumeTargetSchema.optional(),
    artifactHints: z.array(z.string().min(1)).optional(),
    humanFeedback: escalationHumanFeedbackSchema.optional(),
  })
  .strict();

/** Escalação normalizada (runs antigas recebem defaults tolerantes). */
export const escalationSchema = escalationRawSchema.transform((v) => ({
  ...v,
  source: v.source ?? ('pipeline' as const),
  phaseAtEscalation: v.phaseAtEscalation ?? ('evaluating' as const),
  resumeTarget: v.resumeTarget ?? ('ContinueGenerate' as const),
}));

export type RunStateEscalation = z.output<typeof escalationSchema>;

export const runFailureSchema = z
  .object({
    message: z.string().min(1),
    at: pipelineFailureAtSchema,
    failedAt: isoString,
  })
  .strict();

export type RunFailure = z.output<typeof runFailureSchema>;

export const runStateSchema = z
  .object({
    runId: z.string().min(1),
    version: z.literal(1),
    status: z.enum(RUN_STATUSES),
    phase: z.enum(PIPELINE_STAGES),
    currentSprintIdx: z.number().int().nonnegative().optional(),
    retriesRemaining: z.number().int().nonnegative().optional(),
    branch: z.string().min(1),
    worktreePath: z.string().min(1),
    startedAt: isoString,
    lastUpdatedAt: isoString,
    pausedAt: isoString.optional(),
    completedAt: isoString.optional(),
    /** Presente quando `status === 'failed'`; `null` limpa após retomada ou conclusão. */
    failure: z.union([runFailureSchema, z.null()]).optional(),
    escalation: escalationSchema.optional(),
    planningInterview: planningInterviewStateSchema.optional(),
    metadata: z
      .object({
        prompt: z.string().min(1),
        userAgent: z.string().min(1),
        providerDefaults: z.record(z.string(), z.string()),
      })
      .strict(),
  })
  .strict();

export type RunState = z.output<typeof runStateSchema>;
export type RunStateInput = z.input<typeof runStateSchema>;

export const runMetaSchema = z
  .object({
    runId: z.string().min(1),
    startedAt: isoString,
    completedAt: isoString.optional(),
    prompt: z.string().min(1),
    branch: z.string().min(1),
    userAgent: z.string().min(1),
  })
  .strict();

export type RunMeta = z.output<typeof runMetaSchema>;
