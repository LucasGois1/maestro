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
            code: z.ZodIssueCode.custom,
            message: `Sprint "${sp.name}" references unknown user story id ${usId.toString()}`,
            path: ['sprints'],
          });
        }
      }
      const sprintIds = new Set(val.sprints.map((s) => s.idx));
      for (const dep of sp.dependsOn) {
        if (!sprintIds.has(dep)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Sprint idx ${sp.idx.toString()} depends on unknown sprint idx ${dep.toString()}`,
            path: ['sprints'],
          });
        }
      }
    }
  });

const plannerEscalationSchema = z.object({
  escalationReason: z.string().min(1),
});

/**
 * JSON object the Planner model must emit: either a full plan or an escalation.
 */
export const plannerModelOutputSchema = z.union([
  plannerEscalationSchema,
  plannerSuccessSchema,
]);

export type PlannerModelOutput = z.infer<typeof plannerModelOutputSchema>;

export function isPlannerEscalation(
  o: PlannerModelOutput,
): o is z.infer<typeof plannerEscalationSchema> {
  return 'escalationReason' in o;
}
