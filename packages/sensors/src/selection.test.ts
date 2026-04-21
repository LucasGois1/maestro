import { describe, expect, it } from 'vitest';

import { sensorAppliesToFiles } from './selection.js';

describe('sensorAppliesToFiles', () => {
  it('matches sensors with no appliesTo against any change set', () => {
    expect(
      sensorAppliesToFiles(
        {
          appliesTo: [],
        },
        ['src/index.ts'],
      ),
    ).toBe(true);
  });

  it('matches glob patterns against changed files', () => {
    expect(
      sensorAppliesToFiles(
        {
          appliesTo: ['packages/tui/**'],
        },
        ['packages/tui/src/index.ts'],
      ),
    ).toBe(true);
  });

  it('skips unrelated sensors', () => {
    expect(
      sensorAppliesToFiles(
        {
          appliesTo: ['packages/tui/**'],
        },
        ['packages/git/src/index.ts'],
      ),
    ).toBe(false);
  });

  it('returns false when patterns are set but no files changed', () => {
    expect(
      sensorAppliesToFiles(
        {
          appliesTo: ['src/**'],
        },
        [],
      ),
    ).toBe(false);
  });

  it('matches single-segment globs and question-mark wildcards', () => {
    expect(
      sensorAppliesToFiles(
        {
          appliesTo: ['src/*.ts'],
        },
        ['src/app.ts'],
      ),
    ).toBe(true);

    expect(
      sensorAppliesToFiles(
        {
          appliesTo: ['src/file?.ts'],
        },
        ['src/fileX.ts'],
      ),
    ).toBe(true);
  });

  it('matches ** across path segments', () => {
    expect(
      sensorAppliesToFiles(
        {
          appliesTo: ['packages/**/index.ts'],
        },
        ['packages/foo/bar/index.ts'],
      ),
    ).toBe(true);
  });
});
