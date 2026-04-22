import { describe, expect, it } from 'vitest';

import { serializePlanMarkdown } from './plan-markdown.js';
import type { PlannerOutput } from './engine.js';

function plan(
  complexity: PlannerOutput['sprints'][number]['complexity'],
  overrides: Partial<PlannerOutput> = {},
): PlannerOutput {
  return {
    runId: 'run-1',
    prompt: 'ship tests',
    feature: 'Testing',
    overview: 'Add tests.',
    summary: 'Testing summary',
    userStories: [
      { id: 1, role: 'dev', action: 'run tests', value: 'confidence' },
    ],
    aiFeatures: [],
    sprints: [
      {
        id: 'coverage',
        description: 'Coverage',
        acceptance: ['tests pass'],
        idx: 1,
        name: 'Coverage',
        objective: 'Raise coverage',
        userStoryIds: [1],
        dependsOn: [],
        complexity,
        keyFeatures: [],
      },
    ],
    ...overrides,
  };
}

describe('serializePlanMarkdown', () => {
  it('renders low, medium, and high complexity labels', () => {
    expect(serializePlanMarkdown(plan('low'))).toContain(
      '**Complexidade estimada:** baixa',
    );
    expect(serializePlanMarkdown(plan('medium'))).toContain(
      '**Complexidade estimada:** média',
    );
    expect(serializePlanMarkdown(plan('high'))).toContain(
      '**Complexidade estimada:** alta',
    );
  });

  it('renders ai features, dependencies, and key features when present', () => {
    const markdown = serializePlanMarkdown(
      plan('medium', {
        aiFeatures: ['mock LLM integration'],
        sprints: [
          {
            id: 'replay',
            description: 'Replay',
            acceptance: ['replay pass'],
            idx: 2,
            name: 'Replay',
            objective: 'Replay cassettes',
            userStoryIds: [1],
            dependsOn: [1],
            complexity: 'medium',
            keyFeatures: ['VCR'],
          },
        ],
      }),
    );

    expect(markdown).toContain('## AI features embutidas');
    expect(markdown).toContain('- mock LLM integration');
    expect(markdown).toContain('**Depends on:** [1]');
    expect(markdown).toContain('  - VCR');
  });
});
