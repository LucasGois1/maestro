import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSensorSetupToolSet } from './repo-tools.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'maestro-sensor-ts-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('createSensorSetupToolSet', () => {
  it('readFile returns repository file text', async () => {
    await writeFile(join(dir, 'Makefile'), 'test:\n\t@echo ok\n', 'utf8');
    const tools = createSensorSetupToolSet(dir);
    const readFileTool = tools.readFile as {
      execute: (input: { path: string }) => Promise<string>;
    };
    const text = await readFileTool.execute({ path: 'Makefile' });
    expect(text).toContain('test:');
  });
});
