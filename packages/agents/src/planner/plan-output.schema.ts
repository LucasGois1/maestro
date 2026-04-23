import { z } from 'zod';

/** Single user story (DSFT-90). */
export const userStorySchema = z.object({
  id: z.number().int().positive(),
  role: z.string().min(1),
  action: z.string().min(1),
  value: z.string().min(1),
});

export type UserStory = z.infer<typeof userStorySchema>;

/** Sprint row as emitted by the model (before normalization to pipeline shape). */
export const plannerSprintRawSchema = z.object({
  idx: z.number().int().min(1),
  name: z.string().min(1),
  objective: z.string().min(1),
  userStoryIds: z.array(z.number().int().positive()),
  dependsOn: z.array(z.number().int().min(1)),
  complexity: z.enum(['low', 'medium', 'high']),
  keyFeatures: z.array(z.string()),
});

export type PlannerSprintRaw = z.infer<typeof plannerSprintRawSchema>;

const plannerSuccessSchema = z
  .object({
    feature: z.string().min(1),
    overview: z.string().min(1),
    userStories: z.array(userStorySchema).min(1),
    aiFeatures: z.array(z.string()).optional(),
    sprints: z.array(plannerSprintRawSchema).min(1),
  })
  .superRefine((val, ctx) => {
    const storyIds = new Set(val.userStories.map((s) => s.id));
    for (const sp of val.sprints) {
      for (const usId of sp.userStoryIds) {
        if (!storyIds.has(usId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Sprint "${sp.name}" references unknown user story id ${usId.toString()}`,
            path: ['sprints'],
          });
        }
      }
      const sprintIds = new Set(val.sprints.map((s) => s.idx));
      for (const dep of sp.dependsOn) {
        if (!sprintIds.has(dep)) {
          ctx.addIssue({
            code: 'custom',
            message: `Sprint idx ${sp.idx.toString()} depends on unknown sprint idx ${dep.toString()}`,
            path: ['sprints'],
          });
        }
      }
    }
  });

export type PlannerSuccessModelOutput = z.infer<typeof plannerSuccessSchema>;

/**
 * Ramo de escalação após validação: mesmas chaves que {@link PlannerModelOutput},
 * com motivo preenchido e campos de plano anulados.
 */
export type PlannerEscalationModelOutput = {
  escalationReason: string;
  feature: null;
  overview: null;
  userStories: null;
  aiFeatures: null;
  sprints: null;
};

/**
 * JSON object the Planner model must emit: either a full plan or an escalation.
 *
 * Single root `type: "object"` (no `z.union` at root — OpenAI rejected that JSON Schema).
 *
 * All keys use **`.nullable()`** (not `.optional()`): strict `response_format` requires
 * `required` to list every property key; optional keys omit `escalationReason` from
 * `required` and the API errors with "Missing 'escalationReason'".
 */
export const plannerModelOutputSchema = z
  .object({
    escalationReason: z.string().nullable(),
    feature: z.string().nullable(),
    overview: z.string().nullable(),
    userStories: z.array(userStorySchema).nullable(),
    aiFeatures: z.array(z.string()).nullable(),
    sprints: z.array(plannerSprintRawSchema).nullable(),
  })
  .superRefine((val, ctx) => {
    const esc =
      val.escalationReason === null || val.escalationReason === undefined
        ? ''
        : val.escalationReason.trim();
    const hasEscalation = esc.length > 0;
    const hasPlan =
      val.feature !== null &&
      val.feature !== undefined &&
      val.feature.trim().length > 0 &&
      val.overview !== null &&
      val.overview !== undefined &&
      val.overview.trim().length > 0 &&
      val.userStories !== null &&
      val.userStories !== undefined &&
      val.userStories.length >= 1 &&
      val.sprints !== null &&
      val.sprints !== undefined &&
      val.sprints.length >= 1;

    if (hasEscalation && hasPlan) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Provide either escalationReason (escalation) or a full plan, not both.',
        path: [],
      });
      return;
    }
    if (!hasEscalation && !hasPlan) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Provide escalationReason, or a full plan (feature, overview, userStories, sprints).',
        path: [],
      });
      return;
    }

    if (hasEscalation) {
      const planFieldsPresent =
        (val.feature !== null &&
          val.feature !== undefined &&
          val.feature.trim().length > 0) ||
        (val.overview !== null &&
          val.overview !== undefined &&
          val.overview.trim().length > 0) ||
        (val.userStories !== null && val.userStories !== undefined) ||
        (val.sprints !== null && val.sprints !== undefined) ||
        (val.aiFeatures !== null && val.aiFeatures !== undefined);
      if (planFieldsPresent) {
        ctx.addIssue({
          code: 'custom',
          message:
            'Escalation must set feature, overview, userStories, and sprints to null.',
          path: [],
        });
      }
      return;
    }

    if (val.escalationReason !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'A full plan must set escalationReason to null.',
        path: ['escalationReason'],
      });
      return;
    }

    const planParse = plannerSuccessSchema.safeParse({
      feature: val.feature,
      overview: val.overview,
      userStories: val.userStories,
      aiFeatures: val.aiFeatures ?? undefined,
      sprints: val.sprints,
    });
    if (!planParse.success) {
      for (const issue of planParse.error.issues) {
        ctx.addIssue({
          code: 'custom',
          message: issue.message,
          path: issue.path,
        });
      }
    }
  });

export type PlannerModelOutput = z.infer<typeof plannerModelOutputSchema>;

export function isPlannerEscalation(
  o: PlannerModelOutput,
): o is PlannerEscalationModelOutput {
  return (
    o.escalationReason !== null &&
    typeof o.escalationReason === 'string' &&
    o.escalationReason.trim().length > 0
  );
}
