import type { MergerInput } from './merger-input.schema.js';
import type { MergerModelOutput } from './merger-output.schema.js';

const baseSprintOutcome: MergerInput['sprintOutcomes'][number] = {
  sprintIdx: 0,
  name: 'API',
  filesChanged: ['packages/api/src/x.ts'],
  evaluatorDecision: 'passed',
  attempts: 1,
};

const baseInput: MergerInput = {
  runId: 'run-1',
  repoRoot: '/tmp/repo',
  worktreeRoot: '/tmp/repo',
  branch: 'maestro/feature',
  planMarkdown: '# Plan\n',
  planSummary: 'Ship feature',
  featureName: 'Auth',
  sprintOutcomes: [baseSprintOutcome],
  aggregatedAcceptance: ['JWT works'],
  remote: { platform: 'github', url: 'https://github.com/o/r.git' },
  suggestedLabels: ['backend'],
  execPlanRelativePath: '.maestro/docs/exec-plans/completed/auth.md',
};

export const FIXTURE_COMPLETED_GH: {
  readonly input: MergerInput;
  readonly output: MergerModelOutput;
} = {
  input: baseInput,
  output: {
    runStatus: 'completed',
    branch: 'maestro/feature',
    commitCount: 3,
    execPlanPath: '.maestro/docs/exec-plans/completed/auth.md',
    cleanupDone: false,
    prUrl: 'https://github.com/o/r/pull/42',
    prNumber: 42,
    summary: 'PR opened',
    prTitle: 'feat(api): auth',
  },
};

export const FIXTURE_NO_REMOTE: {
  readonly input: MergerInput;
  readonly output: MergerModelOutput;
} = {
  input: {
    ...baseInput,
    remote: null,
  },
  output: {
    runStatus: 'completed',
    branch: 'maestro/feature',
    commitCount: 1,
    execPlanPath: '.maestro/docs/exec-plans/completed/auth.md',
    cleanupDone: false,
    prUrl: null,
    prNumber: null,
    summary: 'No origin remote; branch kept local.',
    prTitle: 'feat(auth): local branch',
  },
};

export const FIXTURE_DRAFT: {
  readonly input: MergerInput;
  readonly output: MergerModelOutput;
} = {
  input: {
    ...baseInput,
    requireDraftPr: true,
  },
  output: {
    runStatus: 'partial',
    branch: 'maestro/feature',
    commitCount: 2,
    execPlanPath: '.maestro/docs/exec-plans/completed/auth.md',
    cleanupDone: false,
    prUrl: 'https://github.com/o/r/pull/99',
    prNumber: 99,
    summary: 'Draft PR for review',
    prTitle: 'feat(api): auth (draft)',
  },
};

export const FIXTURE_GITLAB: {
  readonly input: MergerInput;
  readonly output: MergerModelOutput;
} = {
  input: {
    ...baseInput,
    remote: {
      platform: 'gitlab',
      url: 'https://gitlab.com/g/p.git',
    },
  },
  output: {
    runStatus: 'completed',
    branch: 'maestro/feature',
    commitCount: 4,
    execPlanPath: '.maestro/docs/exec-plans/completed/auth.md',
    cleanupDone: false,
    prUrl: 'https://gitlab.com/g/p/-/merge_requests/7',
    prNumber: 7,
    summary: null,
    prTitle: 'feat(api): auth',
  },
};

export const FIXTURE_PARTIAL: {
  readonly input: MergerInput;
  readonly output: MergerModelOutput;
} = {
  input: {
    ...baseInput,
    sprintOutcomes: [
      {
        ...baseSprintOutcome,
        evaluatorDecision: 'passed',
      },
      {
        sprintIdx: 1,
        name: 'UI',
        filesChanged: ['apps/web/a.tsx'],
        evaluatorDecision: 'passed',
        attempts: 2,
      },
    ],
  },
  output: {
    runStatus: 'partial',
    branch: 'maestro/feature',
    commitCount: 6,
    execPlanPath: '.maestro/docs/exec-plans/completed/auth.md',
    cleanupDone: true,
    prUrl: null,
    prNumber: null,
    summary: 'Packaged with note on retry sprint',
    prTitle: 'feat(app): auth and ui',
  },
};
