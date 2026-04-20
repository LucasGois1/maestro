import { describe, expect, it } from 'vitest';

import { sensorAppliesToFiles } from './selection.js';

describe('sensorAppliesToFiles', () => {
  it('matches sensors with no appliesTo against any change set', () => {
    expect(
      sensorAppliesToFiles(
        {
          id: 'pytest',
          kind: 'computational',
          command: 'pnpm test',
          args: [],
          appliesTo: [],
          onFail: 'block',
          parseOutput: 'generic',
          expectExitCode: 0,
          timeoutSec: 60,
        },
        ['src/index.ts'],
      ),
    ).toBe(true);
  });

  it('matches glob patterns against changed files', () => {
    expect(
      sensorAppliesToFiles(
        {
          id: 'frontend-tests',
          kind: 'computational',
          command: 'pnpm test',
          args: [],
          appliesTo: ['packages/tui/**'],
          onFail: 'block',
          parseOutput: 'generic',
          expectExitCode: 0,
          timeoutSec: 60,
        },
        ['packages/tui/src/index.ts'],
      ),
    ).toBe(true);
  });

  it('skips unrelated sensors', () => {
    expect(
      sensorAppliesToFiles(
        {
          id: 'frontend-tests',
          kind: 'computational',
          command: 'pnpm test',
          args: [],
          appliesTo: ['packages/tui/**'],
          onFail: 'block',
          parseOutput: 'generic',
          expectExitCode: 0,
          timeoutSec: 60,
        },
        ['packages/git/src/index.ts'],
      ),
    ).toBe(false);
  });
});
