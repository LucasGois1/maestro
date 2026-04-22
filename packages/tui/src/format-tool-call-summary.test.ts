import { describe, expect, it } from 'vitest';

import { ellipsis, formatToolCallSummary } from './format-tool-call-summary.js';

describe('formatToolCallSummary', () => {
  it('returns tool only for empty object args', () => {
    expect(formatToolCallSummary('getDependencies', {})).toBe('getDependencies');
  });

  it('shows path for readFile and writeFile', () => {
    expect(
      formatToolCallSummary('readFile', {
        path: 'packages/tui/src/App.tsx',
      }),
    ).toBe('readFile — packages/tui/src/App.tsx');
    expect(
      formatToolCallSummary('writeFile', {
        path: 'foo/bar.ts',
        content: 'x'.repeat(10_000),
      }),
    ).toBe('writeFile — foo/bar.ts');
  });

  it('shows path and old string preview for editFile', () => {
    const line = formatToolCallSummary('editFile', {
      path: 'src/a.ts',
      oldStr: 'const OLD = true',
      newStr: 'const NEW = false',
    });
    expect(line).toContain('editFile');
    expect(line).toContain('src/a.ts');
    expect(line).toContain('OLD');
  });

  it('shows query for searchCode', () => {
    expect(
      formatToolCallSummary('searchCode', {
        query: 'formatToolCallSummary',
        maxLines: 40,
      }),
    ).toBe('searchCode — formatToolCallSummary');
  });

  it('shows shell command line', () => {
    expect(
      formatToolCallSummary('runShell', {
        cmd: 'pnpm',
        args: ['test', '--', 'foo'],
      }),
    ).toBe('runShell — pnpm test -- foo');
  });

  it('formats git commit conventional line', () => {
    expect(
      formatToolCallSummary('gitCommit', {
        type: 'feat',
        scope: 'tui',
        subject: 'better tool labels',
      }),
    ).toBe('gitCommit — feat(tui): better tool labels');
  });
});

describe('ellipsis', () => {
  it('truncates long strings', () => {
    expect(ellipsis('abcdef', 4)).toBe('abc…');
  });
});
