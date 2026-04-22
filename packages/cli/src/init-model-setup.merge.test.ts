import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { mergeWriteProjectConfig } from './init-model-setup.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = join(tmpdir(), `maestro-merge-${Date.now()}`);
  await mkdir(join(repoRoot, '.maestro'), { recursive: true });
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('mergeWriteProjectConfig', () => {
  it('merges defaults and providers into project config.json', async () => {
    await mergeWriteProjectConfig(repoRoot, {
      defaults: {
        planner: { model: 'openai/gpt-5-nano' },
      },
      providers: {
        openai: { apiKey: 'sk-test' },
      },
    });

    const raw = await readFile(
      join(repoRoot, '.maestro', 'config.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw) as {
      defaults: { planner: { model: string } };
      providers: { openai: { apiKey: string } };
    };
    expect(parsed.defaults.planner.model).toBe('openai/gpt-5-nano');
    expect(parsed.providers.openai.apiKey).toBe('sk-test');
  });

  it('preserves unrelated keys on disk', async () => {
    await mergeWriteProjectConfig(repoRoot, {
      discovery: { enabled: false },
    });
    await mergeWriteProjectConfig(repoRoot, {
      defaults: {
        discovery: { model: 'openai/gpt-4o-mini' },
      },
    });

    const raw = JSON.parse(
      await readFile(join(repoRoot, '.maestro', 'config.json'), 'utf8'),
    ) as { discovery: { enabled: boolean }; defaults: { discovery: { model: string } } };
    expect(raw.discovery.enabled).toBe(false);
    expect(raw.defaults.discovery.model).toBe('openai/gpt-4o-mini');
  });
});
