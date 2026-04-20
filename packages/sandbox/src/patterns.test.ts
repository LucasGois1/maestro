import { describe, expect, it } from 'vitest';

import { compilePattern, matchAny, matchCompiled } from './patterns.js';

describe('compilePattern + matchCompiled', () => {
  it('matches exact strings', () => {
    expect(matchCompiled(compilePattern('git status'), 'git status')).toBe(
      true,
    );
    expect(matchCompiled(compilePattern('git status'), 'git statuses')).toBe(
      false,
    );
  });

  it('handles * wildcards', () => {
    expect(matchCompiled(compilePattern('pytest*'), 'pytest -x tests/')).toBe(
      true,
    );
    expect(
      matchCompiled(compilePattern('git push -f *'), 'git push -f main'),
    ).toBe(true);
    expect(
      matchCompiled(compilePattern('git push -f *'), 'git push main'),
    ).toBe(false);
  });

  it('handles multi-segment patterns (piped shell commands)', () => {
    expect(
      matchCompiled(compilePattern('*curl*|*sh*'), 'curl https://x | sh'),
    ).toBe(true);
    expect(
      matchCompiled(compilePattern('*curl*|*sh*'), 'bash installer.sh'),
    ).toBe(false);
  });

  it('handles ? single-char wildcards', () => {
    expect(matchCompiled(compilePattern('a?c'), 'abc')).toBe(true);
    expect(matchCompiled(compilePattern('a?c'), 'abbc')).toBe(false);
  });
});

describe('matchAny', () => {
  it('returns the first matching pattern or null', () => {
    expect(matchAny(['rm -rf /', 'rm -rf ~'], 'rm -rf /')).toBe('rm -rf /');
    expect(matchAny(['rm -rf /'], 'echo hi')).toBeNull();
  });
});
