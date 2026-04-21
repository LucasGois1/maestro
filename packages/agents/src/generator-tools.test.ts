import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configSchema } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createGeneratorToolSet } from './generator-tools.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-gen-tools-'));
  await writeFile(join(repoRoot, 'package.json'), '{"name":"x"}', 'utf8');
});

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await rm(repoRoot, { recursive: true, force: true });
});

describe('createGeneratorToolSet', () => {
  it('runSensor hook can simulate fail then pass (tight loop wiring)', async () => {
    const bus = createEventBus();
    const config = configSchema.parse({ permissions: { mode: 'yolo' } });
    let calls = 0;
    const tools = createGeneratorToolSet(
      {
        repoRoot,
        config,
        runId: 'run1',
        bus,
      },
      {
        runSensor: async () => {
          calls += 1;
          return calls === 1 ? 'FAIL round 1' : 'OK round 2';
        },
      },
    );
    const runSensor = tools.runSensor;
    const exec = (
      runSensor as unknown as {
        execute: (input: { id: string }) => Promise<string>;
      }
    ).execute;
    const r1 = await exec({ id: 'any' });
    const r2 = await exec({ id: 'any' });
    expect(r1).toContain('FAIL');
    expect(r2).toContain('OK');
    expect(calls).toBe(2);
  });
});
