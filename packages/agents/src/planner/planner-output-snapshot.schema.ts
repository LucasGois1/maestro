import { z } from 'zod';

import { userStorySchema } from './plan-output.schema.js';

/** Sprint normalizado tal como em `PlannerOutput.sprints`. */
export const plannerPipelineSprintSnapshotSchema = z
  .object({
    id: z.string().min(1),
    description: z.string(),
    acceptance: z.array(z.string()),
    idx: z.number().int().min(1),
    name: z.string().min(1),
    objective: z.string(),
    dependsOn: z.array(z.number().int().min(1)),
    complexity: z.enum(['low', 'medium', 'high']),
    keyFeatures: z.array(z.string()),
    userStoryIds: z.array(z.number().int().positive()),
  })
  .strict();

/**
 * Snapshot JSON de `PlannerOutput` gravado em disco para retomada (`plan.snapshot.json`).
 */
export const plannerOutputSnapshotSchema = z
  .object({
    runId: z.string().min(1),
    prompt: z.string(),
    feature: z.string().min(1),
    overview: z.string(),
    summary: z.string(),
    userStories: z.array(userStorySchema),
    aiFeatures: z.array(z.string()),
    sprints: z.array(plannerPipelineSprintSnapshotSchema).min(1),
  })
  .strict();

export type PlannerOutputSnapshot = z.infer<typeof plannerOutputSnapshotSchema>;
