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
    prUrl: z.union([z.string().url(), z.null()]),
    prNumber: z.union([z.number().int().positive(), z.null()]),
    /** Resumo curto para log / UI */
    summary: z.string().nullable(),
    /** Título do PR (estilo Conventional, ≤70 chars recomendado) */
    prTitle: z.string().nullable(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const urlMissing = val.prUrl === null;
    const numMissing = val.prNumber === null;
    if (urlMissing !== numMissing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'prUrl and prNumber must both be a value or both null',
        path: ['prUrl'],
      });
    }
  });

export type MergerModelOutput = z.infer<typeof mergerModelOutputSchema>;
