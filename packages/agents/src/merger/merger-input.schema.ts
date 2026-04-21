import { z } from 'zod';

const remoteSchema = z
  .object({
    platform: z.enum(['github', 'gitlab', 'unknown']),
    url: z.string().min(1),
    name: z.string().min(1).optional(),
  })
  .strict();

const sprintOutcomeSummarySchema = z.object({
  sprintIdx: z.number().int().nonnegative(),
  name: z.string().min(1),
  objective: z.string().optional(),
  filesChanged: z.array(z.string()).default([]),
  evaluatorDecision: z.enum(['passed', 'failed', 'escalated']),
  attempts: z.number().int().positive(),
});

/** Input montado pelo pipeline para o Merger (DSFT-94). */
export const mergerInputSchema = z.object({
  runId: z.string().min(1),
  repoRoot: z.string().min(1),
  worktreeRoot: z.string().min(1),
  branch: z.string().min(1),
  baseBranch: z.string().optional(),
  planMarkdown: z.string(),
  planSummary: z.string().min(1),
  featureName: z.string().min(1),
  sprintOutcomes: z.array(sprintOutcomeSummarySchema),
  aggregatedAcceptance: z.array(z.string()),
  remote: remoteSchema.nullable(),
  requireDraftPr: z.boolean().optional(),
  /** ISO timestamps / duração da run até ao merge */
  pipelineStartedAt: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  /** Labels sugeridas (ex.: inferidas de paths) */
  suggestedLabels: z.array(z.string()).default([]),
  /** Caminho relativo onde o pipeline gravará o exec-plan completed (ecoar no JSON de saída). */
  execPlanRelativePath: z.string().min(1),
  /** Linha opcional para footer do PR (ex.: Co-authored-by). */
  coAuthoredByLine: z.string().optional(),
});

export type MergerInput = z.infer<typeof mergerInputSchema>;
export type MergerSprintOutcomeSummary = z.infer<
  typeof sprintOutcomeSummarySchema
>;
