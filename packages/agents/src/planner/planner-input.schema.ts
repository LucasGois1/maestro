import { z } from 'zod';

import {
  plannerInterviewAnswerSchema,
  plannerInterviewContextSchema,
  plannerInterviewQuestionSchema,
  plannerInterviewStageSchema,
  plannerTranscriptEntrySchema,
} from './plan-output.schema.js';

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
  /** Notas do operador na TUI antes de retomar (resume com replan). */
  humanGuidance: z.string().optional(),
});

export type PlannerReplanContext = z.infer<typeof plannerReplanContextSchema>;

export const plannerInterviewInputSchema = z.object({
  stage: plannerInterviewStageSchema,
  roundInBlock: z.number().int().min(1),
  blockIndex: z.number().int().min(1),
  totalRounds: z.number().int().min(1),
  transcript: z.array(plannerTranscriptEntrySchema),
  pendingQuestions: z.array(plannerInterviewQuestionSchema),
  latestAnswers: z.array(plannerInterviewAnswerSchema),
  context: plannerInterviewContextSchema,
  continueDecision: z.enum(['continue', 'proceed']).optional(),
  summaryFeedback: z.string().optional(),
});

export type PlannerInterviewInput = z.infer<
  typeof plannerInterviewInputSchema
>;

export const plannerInputSchema = z.object({
  prompt: z.string().min(1),
  replan: plannerReplanContextSchema.optional(),
  /** Orientação humana na primeira planificação (opcional). */
  humanGuidance: z.string().optional(),
  interview: plannerInterviewInputSchema.optional(),
});

export type PlannerInput = z.infer<typeof plannerInputSchema>;
