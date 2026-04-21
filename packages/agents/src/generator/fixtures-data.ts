import type { GeneratorModelOutput } from './generator-output.schema.js';

export const SIMPLE_ONE_FILE: {
  readonly input: Record<string, unknown>;
  readonly output: GeneratorModelOutput;
} = {
  input: { sprintIdx: 1, sprintName: 'Health check' },
  output: {
    sprintIdx: 1,
    filesChanged: [{ path: 'packages/api/src/routes/health.ts', changeType: 'added' }],
    commits: [
      {
        sha: 'abc1234',
        message: 'feat(api): add health route',
      },
    ],
    selfEval: {
      coversAllCriteria: true,
      missingCriteria: [],
      concerns: [],
    },
    handoffNotes: 'Health endpoint added; ready for wiring in app.',
  },
};

export const MULTI_LAYER: {
  readonly input: Record<string, unknown>;
  readonly output: GeneratorModelOutput;
} = {
  input: { sprintIdx: 2, sprintName: 'Cross-package feature' },
  output: {
    sprintIdx: 2,
    filesChanged: [
      { path: 'packages/lib/src/foo.ts', changeType: 'modified' },
      { path: 'packages/api/src/handlers/foo.ts', changeType: 'added' },
      { path: 'packages/lib/test/foo.test.ts', changeType: 'added' },
    ],
    commits: [
      {
        sha: 'def5678',
        message: 'feat(lib): extend foo for api consumer',
      },
    ],
    selfEval: {
      coversAllCriteria: true,
      missingCriteria: [],
      concerns: [],
    },
    handoffNotes: 'Domain change in lib; handler consumes new API.',
  },
};

export const SELF_EVAL_GAPS: {
  readonly input: Record<string, unknown>;
  readonly output: GeneratorModelOutput;
} = {
  input: { sprintIdx: 1, sprintName: 'Partial delivery' },
  output: {
    sprintIdx: 1,
    filesChanged: [{ path: 'src/a.ts', changeType: 'modified' }],
    commits: [
      {
        sha: '1111111',
        message: 'fix(core): patch edge case',
      },
    ],
    selfEval: {
      coversAllCriteria: false,
      missingCriteria: ['Add regression test for empty input'],
      concerns: ['Tests not green locally until follow-up commit'],
    },
    handoffNotes: 'Core fix landed; tests still need tightening.',
  },
};

export const WITH_EVALUATOR_FEEDBACK: {
  readonly input: Record<string, unknown>;
  readonly output: GeneratorModelOutput;
} = {
  input: {
    sprintIdx: 2,
    sprintName: 'Retry after QA',
    evaluatorFeedback: { failures: ['Acceptance: error message not user-friendly'] },
  },
  output: {
    sprintIdx: 2,
    filesChanged: [{ path: 'src/errors.ts', changeType: 'modified' }],
    commits: [
      {
        sha: '2222222',
        message: 'fix(errors): clarify user-facing message',
      },
    ],
    selfEval: {
      coversAllCriteria: true,
      missingCriteria: [],
      concerns: [],
    },
    handoffNotes: 'Addressed evaluator feedback on error copy.',
  },
};

export const AMBIGUOUS_CONTRACT: {
  readonly input: Record<string, unknown>;
  readonly output: GeneratorModelOutput;
} = {
  input: { sprintIdx: 3, sprintName: 'Unclear scope' },
  output: {
    sprintIdx: 3,
    filesChanged: [],
    commits: [],
    selfEval: {
      coversAllCriteria: false,
      missingCriteria: ['Contract does not list allowed API surface'],
      concerns: [
        'Need negotiation: cannot tell files_may_touch vs new modules — stopped before edits',
      ],
    },
    handoffNotes:
      'Blocked: request contract clarification before implementation.',
  },
};
