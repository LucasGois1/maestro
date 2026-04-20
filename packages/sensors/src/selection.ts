import type { SensorDefinition } from './schema.js';

function normalizePath(input: string): string {
  return input.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function escapeRegex(input: string): string {
  return input.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&');
}

function globToRegExp(glob: string): RegExp {
  const normalized = normalizePath(glob);
  let source = '';

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === undefined) {
      continue;
    }

    if (char === '*' && next === '*') {
      source += '.*';
      i += 1;
      continue;
    }
    if (char === '*') {
      source += '[^/]*';
      continue;
    }
    if (char === '?') {
      source += '[^/]';
      continue;
    }
    source += escapeRegex(char);
  }

  return new RegExp(`^${source}$`, 'u');
}

export function sensorAppliesToFiles(
  sensor: Pick<SensorDefinition, 'appliesTo'>,
  changedFiles: readonly string[],
): boolean {
  if (sensor.appliesTo.length === 0) {
    return true;
  }
  if (changedFiles.length === 0) {
    return false;
  }

  const normalizedFiles = changedFiles.map(normalizePath);
  return sensor.appliesTo.some((pattern) => {
    const matcher = globToRegExp(pattern);
    return normalizedFiles.some((file) => matcher.test(file));
  });
}
