import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadSensorsFile } from './registry.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map(async (dir) => {
      await import('node:fs/promises').then(({ rm }) =>
        rm(dir, { recursive: true, force: true }),
      );
    }),
  );
  tempDirs.length = 0;
});

describe('loadSensorsFile', () => {
  it('returns an empty registry when the sensors file is missing', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'maestro-sensors-'));
    tempDirs.push(repoRoot);

    const registry = await loadSensorsFile({ repoRoot });

    expect(registry.sensors).toEqual([]);
    expect(registry.concurrency).toBe(4);
  });

  it('loads and validates .maestro/sensors.json', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'maestro-sensors-'));
    tempDirs.push(repoRoot);

    await mkdir(join(repoRoot, '.maestro'), { recursive: true });
    await writeFile(
      join(repoRoot, '.maestro', 'sensors.json'),
      JSON.stringify({
        concurrency: 2,
        sensors: [
          {
            id: 'ruff',
            kind: 'computational',
            command: 'ruff check .',
          },
        ],
      }),
      'utf8',
    );

    const registry = await loadSensorsFile({ repoRoot });

    expect(registry.concurrency).toBe(2);
    expect(registry.sensors).toEqual([
      expect.objectContaining({
        id: 'ruff',
        parseOutput: 'generic',
      }),
    ]);
  });
});
