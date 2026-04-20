type PlainObject = Record<string, unknown>;

export function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

export function deepMerge<T>(base: T, override: unknown): T {
  if (override === undefined || override === null) {
    return base;
  }

  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override as T;
  }

  const result: PlainObject = { ...base };
  for (const key of Object.keys(override)) {
    const nextValue = override[key];
    if (nextValue === undefined) {
      continue;
    }
    result[key] = deepMerge(result[key], nextValue);
  }
  return result as T;
}

export function deepMergeAll<T>(base: T, ...overrides: unknown[]): T {
  return overrides.reduce<T>((acc, override) => deepMerge(acc, override), base);
}
