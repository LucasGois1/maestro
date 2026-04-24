import { describe, expect, it } from 'vitest';

import {
  isPlannerPlan,
  isPlannerQuestions,
  plannerModelOutputSchema,
} from './plan-output.schema.js';

describe('plannerModelOutputSchema', () => {
  it('accepts a questions round with up to 10 questions', () => {
    const parsed = plannerModelOutputSchema.parse({
      kind: 'questions',
      escalationReason: null,
      questions: [
        { id: 'q1', prompt: 'Qual o objetivo principal?', topic: 'goal' },
        {
          id: 'q2',
          prompt: 'Quais restricoes sao obrigatorias?',
          topic: 'constraints',
        },
      ],
      continuePrompt: null,
      summaryMarkdown: null,
      interviewState: {
        stage: 'start',
        roundInBlock: 1,
        blockIndex: 1,
        totalRounds: 1,
        transcript: [],
        latestAnswers: [],
        context: {
          goals: [],
          personas: [],
          requirements: [],
          flows: [],
          businessRules: [],
          constraints: [],
          outOfScope: [],
          assumptions: [],
          openQuestions: [],
        },
      },
      feature: null,
      overview: null,
      userStories: null,
      aiFeatures: null,
      sprints: null,
    });

    expect(isPlannerQuestions(parsed)).toBe(true);
  });

  it('rejects a questions round with more than 10 questions', () => {
    const result = plannerModelOutputSchema.safeParse({
      kind: 'questions',
      escalationReason: null,
      questions: Array.from({ length: 11 }, (_, index) => ({
        id: `q${(index + 1).toString()}`,
        prompt: `Pergunta ${(index + 1).toString()}`,
        topic: 'requirements',
      })),
      continuePrompt: null,
      summaryMarkdown: null,
      interviewState: {
        stage: 'after_answers',
        roundInBlock: 2,
        blockIndex: 1,
        totalRounds: 2,
        transcript: [],
        latestAnswers: [],
        context: {
          goals: [],
          personas: [],
          requirements: [],
          flows: [],
          businessRules: [],
          constraints: [],
          outOfScope: [],
          assumptions: [],
          openQuestions: [],
        },
      },
      feature: null,
      overview: null,
      userStories: null,
      aiFeatures: null,
      sprints: null,
    });

    expect(result.success).toBe(false);
  });

  it('accepts a final plan payload under kind=plan', () => {
    const parsed = plannerModelOutputSchema.parse({
      kind: 'plan',
      escalationReason: null,
      questions: null,
      continuePrompt: null,
      summaryMarkdown: null,
      interviewState: null,
      feature: 'Auth',
      overview: 'Ship auth end to end.',
      userStories: [
        {
          id: 1,
          role: 'user',
          action: 'sign in',
          value: 'access my account',
        },
      ],
      aiFeatures: [],
      sprints: [
        {
          idx: 1,
          name: 'Sign-in flow',
          objective: 'Deliver a working sign-in flow.',
          userStoryIds: [1],
          dependsOn: [],
          complexity: 'medium',
          keyFeatures: ['Login UI', 'Session creation'],
        },
      ],
    });

    expect(isPlannerPlan(parsed)).toBe(true);
  });
});
