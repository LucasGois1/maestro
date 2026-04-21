import { z } from 'zod';

export const mergerRunStatusSchema = z.enum(['completed', 'partial', 'failed']);

export type MergerRunStatus = z.infer<typeof mergerRunStatusSchema>;

export const mergerModelOutputSchema = z
  .object({
    runStatus: mergerRunStatusSchema,
    branch: z.string().min(1),
    commitCount: z.number().int().nonnegative(),
    execPlanPath: z.string().min(1),
    cleanupDone: z.boolean(),
    prUrl: z.string().url().optional(),
    prNumber: z.number().int().positive().optional(),
    /** Resumo curto para log / UI */
    summary: z.string().optional(),
    /** Título do PR (estilo Conventional, ≤70 chars recomendado) */
    prTitle: z.string().optional(),
  })
  .strict();

export type MergerModelOutput = z.infer<typeof mergerModelOutputSchema>;
