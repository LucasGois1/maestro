import { z } from 'zod';

export const evaluatorDecisionSchema = z.enum([
  'passed',
  'failed',
  'escalated',
]);

export type EvaluatorDecision = z.infer<typeof evaluatorDecisionSchema>;

const sensorRunEntrySchema = z.object({
  id: z.string().min(1),
  ok: z.boolean(),
  detail: z.string().optional(),
});

export const evaluatorModelOutputSchema = z
  .object({
    decision: evaluatorDecisionSchema,
    structuredFeedback: z.string().min(1),
    coverage: z.number().min(0).max(1).optional(),
    sensorsRun: z.array(sensorRunEntrySchema).default([]),
    artifacts: z.array(z.string()).default([]),
    suggestedActions: z.array(z.string()).default([]),
  })
  .strict();

export type EvaluatorModelOutput = z.infer<typeof evaluatorModelOutputSchema>;

export function evaluatorPassFromDecision(
  decision: EvaluatorDecision,
): boolean {
  return decision === 'passed';
}

/**
 * Linhas curtas para o generator em retries; prioriza ações sugeridas.
 */
export function evaluatorFailuresForGenerator(
  output: EvaluatorModelOutput,
): string[] {
  const fromActions = output.suggestedActions.filter((s) => s.trim().length > 0);
  if (fromActions.length > 0) {
    return fromActions;
  }
  const fb = output.structuredFeedback.trim();
  if (fb.length === 0) {
    return ['Evaluator reported failure with no suggested actions.'];
  }
  const firstLine = fb.split('\n').find((l) => l.trim().length > 0) ?? fb;
  return [firstLine.slice(0, 500)];
}
