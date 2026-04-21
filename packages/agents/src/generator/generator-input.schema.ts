import { z } from 'zod';

/** Input do Generator (DSFT-92) montado pelo pipeline. */
export const generatorInputSchema = z.object({
  runId: z.string().min(1),
  /** Índice 0-based do sprint no array do plano. */
  sprintIdx: z.number().int().nonnegative(),
  repoRoot: z.string().min(1),
  sprint: z.unknown(),
  sprintContract: z.unknown(),
  planFull: z.unknown(),
  architectNotes: z.unknown(),
  previousHandoff: z.string().optional(),
  evaluatorFeedback: z
    .object({
      failures: z.array(z.string()),
    })
    .optional(),
});

export type GeneratorInput = z.infer<typeof generatorInputSchema>;
