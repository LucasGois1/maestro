import { describe, expect, it } from 'vitest';

import { BranchNameError, computeBranchName, slugify } from './branching.js';

const now = new Date('2026-04-20T00:00:00.000Z');

describe('slugify', () => {
  it('converts arbitrary prompts into a safe slug', () => {
    expect(slugify('Ship a JWT service!')).toBe('ship-a-jwt-service');
    expect(slugify('   spaces   and   stuff   ')).toBe('spaces-and-stuff');
    expect(slugify('çaféÑ déjà-vu')).toBe('cafen-deja-vu');
  });

  it('returns "run" for empty/whitespace prompts', () => {
    expect(slugify('   ')).toBe('run');
    expect(slugify('')).toBe('run');
  });

  it('truncates long slugs', () => {
    const slug = slugify('a'.repeat(100));
    expect(slug.length).toBeLessThanOrEqual(40);
  });
});

describe('computeBranchName', () => {
  it('builds conventional names with prefix and inferred type', () => {
    expect(
      computeBranchName({
        strategy: 'conventional',
        prefix: 'maestro/',
        context: { runId: 'r1', prompt: 'add JWT signing', now },
      }),
    ).toBe('maestro/feat-add-jwt-signing');
    expect(
      computeBranchName({
        strategy: 'conventional',
        prefix: 'maestro/',
        context: { runId: 'r1', prompt: 'fix broken token check', now },
      }),
    ).toBe('maestro/fix-fix-broken-token-check');
  });

  it('uses an explicit type when provided', () => {
    expect(
      computeBranchName({
        strategy: 'conventional',
        prefix: 'bots/',
        context: {
          runId: 'r1',
          prompt: 'update dependencies',
          type: 'chore',
          now,
        },
      }),
    ).toBe('bots/chore-update-dependencies');
  });

  it('expands custom templates', () => {
    expect(
      computeBranchName({
        strategy: 'custom',
        prefix: '',
        template: 'agents/{date}-{run_id}-{slug}',
        context: {
          runId: 'abc',
          prompt: 'ship onboarding',
          now,
          user: 'lucas',
        },
      }),
    ).toBe('agents/20260420-abc-ship-onboarding');
  });

  it('requires a template for custom strategy', () => {
    expect(() =>
      computeBranchName({
        strategy: 'custom',
        prefix: '',
        context: { runId: 'r1', prompt: 'x', now },
      }),
    ).toThrow(BranchNameError);
  });

  it('returns askedName for the ask strategy', () => {
    expect(
      computeBranchName({
        strategy: 'ask',
        prefix: 'maestro/',
        context: {
          runId: 'r1',
          prompt: 'ignored',
          askedName: 'maestro/custom',
        },
      }),
    ).toBe('maestro/custom');
  });

  it('rejects branch names with forbidden characters', () => {
    expect(() =>
      computeBranchName({
        strategy: 'ask',
        prefix: '',
        context: {
          runId: 'r1',
          prompt: 'x',
          askedName: 'bad name with spaces',
        },
      }),
    ).toThrow(BranchNameError);
  });
});
