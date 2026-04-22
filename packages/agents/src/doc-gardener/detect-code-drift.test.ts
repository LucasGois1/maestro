import { describe, expect, it } from 'vitest';

import { analyzeDuplicateSourceFiles } from './detect-code-drift.js';

const dupBlock = `
export function alpha() {
  const a = 1;
  const b = 2;
  const c = 3;
  return a + b + c;
}
`;

describe('analyzeDuplicateSourceFiles', () => {
  it('detects a repeated multi-line snippet between two files', () => {
    const findings = analyzeDuplicateSourceFiles(
      new Map([
        ['src/a.ts', dupBlock],
        ['src/b.ts', dupBlock],
      ]),
    );
    expect(findings.length).toBe(1);
    expect(findings[0]?.kind).toBe('duplicate_snippet');
    expect(findings[0]?.path).toBe('src/a.ts ↔ src/b.ts');
  });
});
