import { z } from 'zod';

/** Input montado pelo pipeline para o Evaluator (DSFT-93). */
export const evaluatorInputSchema = z.object({
  runId: z.string().min(1),
  /** Índice do sprint no plano (1-based, alinhado a `PlannerSprint.idx`). */
  sprintIdx: z.number().int().min(1),
  repoRoot: z.string().min(1),
  /** Árvore onde o código foi gerado (worktree); pode coincidir com repoRoot. */
  worktreeRoot: z.string().min(1),
  /** Tentativa atual do loop generator↔evaluator (1-based). */
  iteration: z.number().int().min(1),
  sprintContract: z.string(),
  generatorOutput: z.unknown(),
  codeDiff: z.string(),
  sprint: z.unknown(),
  /** Critérios de aceitação (ex.: do plano) para referência rápida. */
  acceptance: z.array(z.string()).default([]),
});

export type EvaluatorInput = z.infer<typeof evaluatorInputSchema>;
