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

const isoString = z.iso.datetime();

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
    escalation: z
      .object({
        reason: z.string().min(1),
        sprintIdx: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
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
