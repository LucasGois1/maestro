import { isPlainObject } from './merge.js';

type PlainObject = Record<string, unknown>;

export function getByPath(value: unknown, path: string): unknown {
  if (path.length === 0) {
    return value;
  }
  const segments = path.split('.');
  let current: unknown = value;
  for (const segment of segments) {
    if (!isPlainObject(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

export function setByPath<T extends PlainObject>(
  source: T,
  path: string,
  value: unknown,
): T {
  if (path.length === 0) {
    throw new Error('setByPath: path cannot be empty');
  }
  const segments = path.split('.');
  const clone: PlainObject = { ...source };
  let parent: PlainObject = clone;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (segment === undefined) continue;
    const existing = parent[segment];
    const nextParent: PlainObject = isPlainObject(existing)
      ? { ...existing }
      : {};
    parent[segment] = nextParent;
    parent = nextParent;
  }

  const lastSegment = segments[segments.length - 1];
  if (lastSegment === undefined) {
    throw new Error('setByPath: path cannot be empty');
  }
  parent[lastSegment] = value;
  return clone as T;
}

export function coerceScalar(raw: string): string | number | boolean | null {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw !== '' && !Number.isNaN(Number(raw))) {
    return Number(raw);
  }
  return raw;
}
