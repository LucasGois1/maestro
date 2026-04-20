import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { sensorsFileSchema, type SensorsFile } from './schema.js';

export type LoadSensorsFileOptions = {
  readonly repoRoot: string;
  readonly maestroDir?: string;
};

function isNodeEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  );
}

export async function loadSensorsFile(
  options: LoadSensorsFileOptions,
): Promise<SensorsFile> {
  const maestroDir = options.maestroDir ?? '.maestro';
  const path = join(options.repoRoot, maestroDir, 'sensors.json');

  try {
    const content = await readFile(path, 'utf8');
    return sensorsFileSchema.parse(JSON.parse(content));
  } catch (error) {
    if (isNodeEnoent(error)) {
      return sensorsFileSchema.parse({});
    }
    throw error;
  }
}
