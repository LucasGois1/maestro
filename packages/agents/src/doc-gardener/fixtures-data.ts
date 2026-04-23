import type { GardenerInput } from './gardener-input.schema.js';
import type { GardenerOutput } from './gardener-output.schema.js';

const baseInput: GardenerInput = {
  repoRoot: '/tmp/fixture',
  runType: 'all',
  reportPath: '/tmp/fixture/.maestro/docs/background-reports/run.md',
  agentsMdPreview: '',
  goldenPrinciplesPreview: '',
  scanRootsHint: '.maestro/, docs/',
};

export const FIXTURE_DOC_LINKS: {
  readonly input: GardenerInput;
  readonly output: GardenerOutput;
} = {
  input: {
    ...baseInput,
    runType: 'doc',
  },
  output: {
    runType: 'doc',
    issuesFound: 2,
    prsOpened: [
      {
        url: 'https://github.com/o/r/pull/1',
        title: 'docs: fix broken links in README',
        category: 'doc-fix',
        filesChanged: 1,
      },
    ],
    reportPath: baseInput.reportPath,
    breakdown: null,
  },
};

export const FIXTURE_CODE_DRIFT: {
  readonly input: GardenerInput;
  readonly output: GardenerOutput;
} = {
  input: {
    ...baseInput,
    runType: 'code',
  },
  output: {
    runType: 'code',
    issuesFound: 1,
    prsOpened: [
      {
        url: 'https://github.com/o/r/pull/2',
        title: 'refactor: dedupe date formatting helper',
        category: 'code-cleanup',
        filesChanged: 3,
      },
    ],
    reportPath: baseInput.reportPath,
    breakdown: null,
  },
};
