import { z } from 'zod';

/** Input do Generator (DSFT-92) montado pelo pipeline. */
export const generatorInputSchema = z.object({
  runId: z.string().min(1),
  /** Índice 0-based do sprint no array do plano. */
  sprintIdx: z.number().int().nonnegative(),
  /** Raiz onde editar código (worktree ou checkout único). */
  implementationRoot: z.string().min(1),
  /** Checkout principal: `.maestro/runs`, sensors, audit de shell. */
  stateRepoRoot: z.string().min(1),
  sprint: z.unknown(),
  sprintContract: z.unknown(),
  planFull: z.unknown(),
  architectNotes: z.unknown(),
  previousHandoff: z.string().optional(),
  evaluatorFeedback: z
    .object({
      failures: z.array(z.string()),
      structuredFeedback: z.string().optional(),
      suggestedActions: z.array(z.string()).optional(),
      decision: z.enum(['failed', 'escalated']).optional(),
    })
    .optional(),
  /** Notas humanas (TUI) injectadas na retomada após escalação. */
  humanGuidance: z.string().optional(),
});

export type GeneratorInput = z.infer<typeof generatorInputSchema>;
