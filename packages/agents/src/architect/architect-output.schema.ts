import { z } from 'zod';

const scopeTecnicoSchema = z.object({
  newFiles: z.array(
    z.object({
      path: z.string().min(1),
      layer: z.string().min(1),
    }),
  ),
  filesToTouch: z.array(z.string()),
  testFiles: z.array(z.string()),
});

/**
 * JSON a emitir pelo Architect por sprint (DSFT-91).
 * `sprintIdx` é 1-based, alinhado a `### Sprint N` no plan.md.
 */
export const architectModelOutputSchema = z.object({
  sprintIdx: z.number().int().min(1),
  scopeTecnico: scopeTecnicoSchema,
  patternsToFollow: z.array(z.string()),
  libraries: z.array(
    z.object({
      name: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
  boundaryCheck: z.enum(['ok', 'refactor_needed', 'violation']),
  boundaryNotes: z.string().optional(),
  escalation: z
    .object({
      reason: z.string().min(1),
    })
    .optional(),
});

export type ArchitectModelOutput = z.infer<typeof architectModelOutputSchema>;

/** Resultado após regra de aprovação determinística (pipeline). */
export type ArchitectPipelineResult = ArchitectModelOutput & {
  readonly approved: boolean;
};

/**
 * Aprovação: só `ok` sem escalação. `refactor_needed` e `violation` bloqueiam o sprint.
 */
export function finalizeArchitectOutput(
  raw: ArchitectModelOutput,
): ArchitectPipelineResult {
  const approved =
    raw.escalation === undefined &&
    raw.boundaryCheck === 'ok';
  return { ...raw, approved };
}
