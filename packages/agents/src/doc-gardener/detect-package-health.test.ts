import { describe, expect, it } from 'vitest';

import {
  parseKnipReporterJson,
  parsePnpmOutdatedText,
} from './detect-package-health.js';

describe('parsePnpmOutdatedText', () => {
  it('parses condensed pnpm outdated lines', () => {
    const text = `
7 outdated packages (of 7)
vitest: 3.2.4 → 4.1.5
eslint: 9.39.4 → 10.2.1
`;
    const rows = parsePnpmOutdatedText(text, 10);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.path).toBe('vitest');
    expect(rows[0]?.kind).toBe('outdated_dep');
    expect(rows[1]?.path).toBe('eslint');
  });
});

describe('parseKnipReporterJson', () => {
  it('maps Knip issues array to findings', () => {
    const json = JSON.stringify({
      files: [],
      issues: [
        {
          file: 'packages/foo/src/a.ts',
          exports: [{ name: 'x', line: 1, col: 1, pos: 1 }],
          dependencies: [],
        },
      ],
    });
    const rows = parseKnipReporterJson(json, 5);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.path).toBe('packages/foo/src/a.ts');
    expect(rows[0]?.kind).toBe('knip_issue');
    expect(rows[0]?.message).toContain('exports');
  });
});
