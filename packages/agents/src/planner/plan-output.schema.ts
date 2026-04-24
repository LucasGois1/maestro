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

export const plannerInterviewStageSchema = z.enum([
  'start',
  'after_answers',
  'continue_gate',
  'summary_review',
  'finalize_plan',
]);

export type PlannerInterviewStage = z.infer<
  typeof plannerInterviewStageSchema
>;

export const plannerInterviewContextSchema = z.object({
  goals: z.array(z.string()),
  personas: z.array(z.string()),
  requirements: z.array(z.string()),
  flows: z.array(z.string()),
  businessRules: z.array(z.string()),
  constraints: z.array(z.string()),
  outOfScope: z.array(z.string()),
  assumptions: z.array(z.string()),
  openQuestions: z.array(z.string()),
});

export type PlannerInterviewContext = z.infer<
  typeof plannerInterviewContextSchema
>;

export const plannerInterviewQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  topic: z.string().min(1),
});

export type PlannerInterviewQuestion = z.infer<
  typeof plannerInterviewQuestionSchema
>;

export const plannerInterviewAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1),
});

export type PlannerInterviewAnswer = z.infer<
  typeof plannerInterviewAnswerSchema
>;

export const plannerTranscriptEntrySchema = z.object({
  role: z.enum(['planner', 'user']),
  kind: z.enum([
    'question',
    'answer',
    'summary',
    'decision',
    'note',
  ]),
  text: z.string().min(1),
  topic: z.string().nullable(),
  questionId: z.string().nullable(),
  round: z.number().int().positive().nullable(),
});

export type PlannerTranscriptEntry = z.infer<
  typeof plannerTranscriptEntrySchema
>;

export const plannerInterviewStateSchema = z.object({
  stage: plannerInterviewStageSchema,
  roundInBlock: z.number().int().min(1),
  blockIndex: z.number().int().min(1),
  totalRounds: z.number().int().min(1),
  transcript: z.array(plannerTranscriptEntrySchema),
  latestAnswers: z.array(plannerInterviewAnswerSchema),
  context: plannerInterviewContextSchema,
});

export type PlannerInterviewState = z.infer<
  typeof plannerInterviewStateSchema
>;

const plannerSuccessSchema = z
  .object({
    feature: z.string().min(1),
    overview: z.string().min(1),
    userStories: z.array(userStorySchema).min(1),
    aiFeatures: z.array(z.string()),
    sprints: z.array(plannerSprintRawSchema).min(1),
  })
  .superRefine((val, ctx) => {
    const storyIds = new Set(val.userStories.map((s) => s.id));
    const sprintIds = new Set(val.sprints.map((s) => s.idx));

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

export const plannerOutputKindSchema = z.enum([
  'questions',
  'continue_gate',
  'summary',
  'plan',
  'escalation',
]);

export type PlannerOutputKind = z.infer<typeof plannerOutputKindSchema>;

/**
 * Single-root object for strict response_format compatibility. All keys are
 * always present; inactive branches use JSON null.
 */
export const plannerModelOutputSchema = z
  .object({
    kind: plannerOutputKindSchema,
    escalationReason: z.string().nullable(),
    questions: z.array(plannerInterviewQuestionSchema).nullable(),
    continuePrompt: z.string().nullable(),
    summaryMarkdown: z.string().nullable(),
    interviewState: plannerInterviewStateSchema.nullable(),
    feature: z.string().nullable(),
    overview: z.string().nullable(),
    userStories: z.array(userStorySchema).nullable(),
    aiFeatures: z.array(z.string()).nullable(),
    sprints: z.array(plannerSprintRawSchema).nullable(),
  })
  .superRefine((val, ctx) => {
    const hasPlanPayload =
      val.feature !== null &&
      val.feature.trim().length > 0 &&
      val.overview !== null &&
      val.overview.trim().length > 0 &&
      val.userStories !== null &&
      val.userStories.length > 0 &&
      val.aiFeatures !== null &&
      val.sprints !== null &&
      val.sprints.length > 0;

    const hasQuestions =
      val.questions !== null && val.questions !== undefined && val.questions.length > 0;
    const hasInterviewState = val.interviewState !== null;
    const hasSummary =
      val.summaryMarkdown !== null && val.summaryMarkdown.trim().length > 0;
    const hasContinuePrompt =
      val.continuePrompt !== null && val.continuePrompt.trim().length > 0;
    const hasEscalation =
      val.escalationReason !== null &&
      val.escalationReason.trim().length > 0;

    switch (val.kind) {
      case 'questions': {
        if (!hasQuestions) {
          ctx.addIssue({
            code: 'custom',
            message:
              'kind=questions requires a non-empty questions array.',
            path: ['questions'],
          });
        }
        if ((val.questions?.length ?? 0) > 10) {
          ctx.addIssue({
            code: 'custom',
            message: 'kind=questions allows at most 10 questions per round.',
            path: ['questions'],
          });
        }
        if (!hasInterviewState) {
          ctx.addIssue({
            code: 'custom',
            message: 'kind=questions requires interviewState.',
            path: ['interviewState'],
          });
        }
        if (
          hasEscalation ||
          hasContinuePrompt ||
          hasSummary ||
          hasPlanPayload
        ) {
          ctx.addIssue({
            code: 'custom',
            message:
              'kind=questions must null out escalation, continuePrompt, summary, and plan fields.',
            path: [],
          });
        }
        return;
      }
      case 'continue_gate': {
        if (!hasContinuePrompt) {
          ctx.addIssue({
            code: 'custom',
            message:
              'kind=continue_gate requires continuePrompt.',
            path: ['continuePrompt'],
          });
        }
        if (!hasInterviewState) {
          ctx.addIssue({
            code: 'custom',
            message: 'kind=continue_gate requires interviewState.',
            path: ['interviewState'],
          });
        }
        if (hasQuestions || hasSummary || hasEscalation || hasPlanPayload) {
          ctx.addIssue({
            code: 'custom',
            message:
              'kind=continue_gate must null out questions, summary, escalation, and plan fields.',
            path: [],
          });
        }
        return;
      }
      case 'summary': {
        if (!hasSummary) {
          ctx.addIssue({
            code: 'custom',
            message: 'kind=summary requires summaryMarkdown.',
            path: ['summaryMarkdown'],
          });
        }
        if (!hasInterviewState) {
          ctx.addIssue({
            code: 'custom',
            message: 'kind=summary requires interviewState.',
            path: ['interviewState'],
          });
        }
        if (hasQuestions || hasContinuePrompt || hasEscalation || hasPlanPayload) {
          ctx.addIssue({
            code: 'custom',
            message:
              'kind=summary must null out questions, continuePrompt, escalation, and plan fields.',
            path: [],
          });
        }
        return;
      }
      case 'plan': {
        if (!hasPlanPayload) {
          ctx.addIssue({
            code: 'custom',
            message:
              'kind=plan requires feature, overview, userStories, aiFeatures, and sprints.',
            path: [],
          });
          return;
        }
        if (hasQuestions || hasContinuePrompt || hasSummary || hasEscalation) {
          ctx.addIssue({
            code: 'custom',
            message:
              'kind=plan must null out questions, continuePrompt, summary, and escalation fields.',
            path: [],
          });
          return;
        }
        const parsedPlan = plannerSuccessSchema.safeParse({
          feature: val.feature,
          overview: val.overview,
          userStories: val.userStories,
          aiFeatures: val.aiFeatures,
          sprints: val.sprints,
        });
        if (!parsedPlan.success) {
          for (const issue of parsedPlan.error.issues) {
            ctx.addIssue({
              code: 'custom',
              message: issue.message,
              path: issue.path,
            });
          }
        }
        return;
      }
      case 'escalation': {
        if (!hasEscalation) {
          ctx.addIssue({
            code: 'custom',
            message:
              'kind=escalation requires a non-empty escalationReason.',
            path: ['escalationReason'],
          });
        }
        if (
          hasQuestions ||
          hasContinuePrompt ||
          hasSummary ||
          hasInterviewState ||
          hasPlanPayload
        ) {
          ctx.addIssue({
            code: 'custom',
            message:
              'kind=escalation must null out interview and plan fields.',
            path: [],
          });
        }
        return;
      }
      default:
        return;
    }
  });

export type PlannerModelOutput = z.infer<typeof plannerModelOutputSchema>;

export type PlannerQuestionsOutput = PlannerModelOutput & {
  kind: 'questions';
  questions: PlannerInterviewQuestion[];
  interviewState: PlannerInterviewState;
};

export type PlannerContinueGateOutput = PlannerModelOutput & {
  kind: 'continue_gate';
  continuePrompt: string;
  interviewState: PlannerInterviewState;
};

export type PlannerSummaryOutput = PlannerModelOutput & {
  kind: 'summary';
  summaryMarkdown: string;
  interviewState: PlannerInterviewState;
};

export type PlannerPlanOutput = PlannerModelOutput & {
  kind: 'plan';
  feature: string;
  overview: string;
  userStories: UserStory[];
  aiFeatures: string[];
  sprints: PlannerSprintRaw[];
};

export type PlannerEscalationModelOutput = PlannerModelOutput & {
  kind: 'escalation';
  escalationReason: string;
};

export function isPlannerEscalation(
  output: PlannerModelOutput,
): output is PlannerEscalationModelOutput {
  return output.kind === 'escalation';
}

export function isPlannerQuestions(
  output: PlannerModelOutput,
): output is PlannerQuestionsOutput {
  return output.kind === 'questions';
}

export function isPlannerContinueGate(
  output: PlannerModelOutput,
): output is PlannerContinueGateOutput {
  return output.kind === 'continue_gate';
}

export function isPlannerSummary(
  output: PlannerModelOutput,
): output is PlannerSummaryOutput {
  return output.kind === 'summary';
}

export function isPlannerPlan(
  output: PlannerModelOutput,
): output is PlannerPlanOutput {
  return output.kind === 'plan';
}
