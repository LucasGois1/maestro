import { z } from 'zod';

/**
 * Context when the Architect rejected a sprint and the Planner must emit a revised full plan.
 * Serialized as JSON in the user message to the Planner model.
 */
export const plannerReplanContextSchema = z.object({
  attempt: z.number().int().min(1),
  blockedSprintIdx: z.number().int().nonnegative(),
  blockedSprintName: z.string().min(1),
  blockedSprintObjective: z.string().min(1),
  boundaryCheck: z.enum(['ok', 'refactor_needed', 'violation']),
  previousPlanSummary: z.string().min(1),
  boundaryNotes: z.string().optional(),
  escalationReason: z.string().optional(),
});

export type PlannerReplanContext = z.infer<typeof plannerReplanContextSchema>;

export const plannerInputSchema = z.object({
  prompt: z.string().min(1),
  replan: plannerReplanContextSchema.optional(),
});

export type PlannerInput = z.infer<typeof plannerInputSchema>;
