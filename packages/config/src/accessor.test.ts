import { describe, expect, it } from 'vitest';

import { coerceScalar, getByPath, setByPath } from './accessor.js';

describe('getByPath', () => {
  it('returns nested values by dot path', () => {
    const value = { a: { b: { c: 42 } } };
    expect(getByPath(value, 'a.b.c')).toBe(42);
  });

  it('returns undefined for missing paths', () => {
    expect(getByPath({ a: 1 }, 'a.b')).toBeUndefined();
    expect(getByPath({}, 'missing')).toBeUndefined();
  });

  it('returns the value itself for an empty path', () => {
    const value = { a: 1 };
    expect(getByPath(value, '')).toBe(value);
  });
});

describe('setByPath', () => {
  it('sets nested values without mutating the source', () => {
    const source = { a: { b: { c: 1 } } };
    const updated = setByPath(source, 'a.b.c', 2);
    expect(updated.a.b.c).toBe(2);
    expect(source.a.b.c).toBe(1);
  });

  it('creates intermediate objects as needed', () => {
    const updated = setByPath({}, 'permissions.mode', 'yolo');
    expect(updated).toEqual({ permissions: { mode: 'yolo' } });
  });

  it('throws on empty path', () => {
    expect(() => setByPath({}, '', 1)).toThrowError();
  });
});

describe('coerceScalar', () => {
  it('coerces booleans, null, numbers and leaves strings alone', () => {
    expect(coerceScalar('true')).toBe(true);
    expect(coerceScalar('false')).toBe(false);
    expect(coerceScalar('null')).toBeNull();
    expect(coerceScalar('42')).toBe(42);
    expect(coerceScalar('3.14')).toBe(3.14);
    expect(coerceScalar('hello')).toBe('hello');
    expect(coerceScalar('')).toBe('');
  });
});
