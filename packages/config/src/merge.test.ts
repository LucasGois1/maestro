import { describe, expect, it } from 'vitest';

import { deepMerge, deepMergeAll, isPlainObject } from './merge.js';

describe('deepMerge', () => {
  it('returns base when override is undefined', () => {
    expect(deepMerge({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it('replaces primitives', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it('merges nested objects', () => {
    const result = deepMerge(
      { providers: { anthropic: { apiKey: 'a' }, openai: { apiKey: 'b' } } },
      { providers: { anthropic: { apiKey: 'override' } } },
    );
    expect(result).toEqual({
      providers: {
        anthropic: { apiKey: 'override' },
        openai: { apiKey: 'b' },
      },
    });
  });

  it('replaces arrays instead of merging them', () => {
    expect(deepMerge({ list: [1, 2, 3] }, { list: [4] })).toEqual({ list: [4] });
  });

  it('ignores undefined values in override keys', () => {
    expect(deepMerge({ a: 1, b: 2 }, { a: undefined, b: 9 })).toEqual({ a: 1, b: 9 });
  });

  it('treats null overrides as absent (no change)', () => {
    expect(deepMerge({ a: 1 }, null)).toEqual({ a: 1 });
  });

  it('handles non-object base with object override', () => {
    expect(deepMerge<unknown>(5, { a: 1 })).toEqual({ a: 1 });
  });
});

describe('deepMergeAll', () => {
  it('applies overrides left to right', () => {
    const result = deepMergeAll<{ permissions: { mode: string } }>(
      { permissions: { mode: 'strict' } },
      { permissions: { mode: 'allowlist' } },
      { permissions: { mode: 'yolo' } },
    );
    expect(result.permissions.mode).toBe('yolo');
  });
});

describe('isPlainObject', () => {
  it('detects plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });

  it('rejects arrays, null, class instances', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    class Foo {
      kind = 'foo';
    }
    expect(isPlainObject(new Foo())).toBe(false);
  });
});
