const SECRET_KEYS = new Set(['apiKey', 'apikey', 'api_key', 'token', 'secret']);
const MASK_PLACEHOLDER = '***masked***';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function maskSecrets<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => maskSecrets(item)) as T;
  }
  if (!isObject(value)) {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (
      SECRET_KEYS.has(key) &&
      typeof nested === 'string' &&
      nested.length > 0
    ) {
      result[key] = MASK_PLACEHOLDER;
      continue;
    }
    result[key] = maskSecrets(nested);
  }
  return result as T;
}

export function isSecretPath(path: string): boolean {
  const leaf = path.split('.').pop() ?? '';
  return SECRET_KEYS.has(leaf);
}

export { MASK_PLACEHOLDER };
