import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ContractParseError,
  ContractValidationError,
  parseSprintContract,
  writeSprintContract,
} from './parser.js';

const fixturesDir = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'examples',
  'contracts',
);

async function fixture(name: string): Promise<string> {
  return readFile(join(fixturesDir, name), 'utf8');
}

describe('parseSprintContract', () => {
  it('parses the simple fixture', async () => {
    const source = await fixture('sprint-1-simple.md');
    const parsed = parseSprintContract(source);
    expect(parsed.frontmatter.sprint).toBe(1);
    expect(parsed.frontmatter.feature).toBe('Session bootstrap');
    expect(parsed.frontmatter.acceptance_criteria).toHaveLength(1);
    expect(parsed.body).toMatch(/# Sprint 1 — Session bootstrap/);
  });

  it('parses the fixture with dependencies', async () => {
    const source = await fixture('sprint-2-with-deps.md');
    const parsed = parseSprintContract(source);
    expect(parsed.frontmatter.depends_on).toEqual([1]);
    expect(parsed.frontmatter.scope.files_expected).toContain(
      'app/auth/jwt.py',
    );
    expect(parsed.frontmatter.scope.files_may_touch).toContain('app/config.py');
  });

  it('strips legacy sensors_required and thresholds from frontmatter', () => {
    const legacy = [
      '---',
      'sprint: 1',
      'feature: Legacy',
      'status: agreed',
      'sensors_required: [ruff]',
      'thresholds:',
      '  coverage_delta: ">= 0"',
      'acceptance_criteria:',
      '  - id: a1',
      '    description: x',
      '    verifier: manual',
      '---',
      '',
      'body',
    ].join('\n');
    const parsed = parseSprintContract(legacy);
    const keys = Object.keys(parsed.frontmatter as object);
    expect(keys).not.toContain('sensors_required');
    expect(keys).not.toContain('thresholds');
    expect(parsed.frontmatter.feature).toBe('Legacy');
  });

  it('parses the multi-round fixture and preserves human role', async () => {
    const source = await fixture('sprint-3-multi-round.md');
    const parsed = parseSprintContract(source);
    expect(parsed.frontmatter.iterations).toBe(3);
    expect(parsed.frontmatter.negotiated_by).toContain('human');
    expect(parsed.body).toMatch(/Round log/);
  });

  it('throws ContractParseError when frontmatter fence is missing', () => {
    expect(() => parseSprintContract('no fence here')).toThrow(
      ContractParseError,
    );
  });

  it('throws ContractValidationError on schema mismatch', () => {
    const bad = [
      '---',
      'sprint: "not-a-number"',
      'feature: x',
      'status: agreed',
      'acceptance_criteria: []',
      '---',
      '',
      'body',
    ].join('\n');
    expect(() => parseSprintContract(bad)).toThrow(ContractValidationError);
  });
});

describe('writeSprintContract + parseSprintContract', () => {
  it('round-trips the simple fixture', async () => {
    const source = await fixture('sprint-1-simple.md');
    const parsed = parseSprintContract(source);
    const serialized = writeSprintContract({
      frontmatter: parsed.frontmatter,
      body: parsed.body,
    });
    const reparsed = parseSprintContract(serialized);
    expect(reparsed.frontmatter).toEqual(parsed.frontmatter);
    expect(reparsed.body.trimEnd()).toBe(parsed.body.trimEnd());
  });

  it('refuses to write an invalid contract', () => {
    expect(() =>
      writeSprintContract({
        frontmatter: {
          sprint: 0,
          feature: '',
          status: 'agreed',
          acceptance_criteria: [],
        },
        body: '',
      }),
    ).toThrow(ContractValidationError);
  });
});
