import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ConfigValidationError,
  loadConfig,
  readConfigFile,
  writeConfigFile,
} from './loader.js';

let home: string;
let cwd: string;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'maestro-home-'));
  cwd = await mkdtemp(join(tmpdir(), 'maestro-cwd-'));
});

afterEach(async () => {
  await Promise.all([
    rm(home, { recursive: true, force: true }),
    rm(cwd, { recursive: true, force: true }),
  ]);
});

async function writeJson(filePath: string, data: unknown) {
  await mkdir(join(filePath, '..'), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

describe('loadConfig', () => {
  it('returns defaults when no files exist', async () => {
    const loaded = await loadConfig({ home, cwd, env: {} });
    expect(loaded.sources.global.exists).toBe(false);
    expect(loaded.sources.project.exists).toBe(false);
    expect(loaded.resolved.permissions.mode).toBe('allowlist');
    expect(loaded.resolved.branching.prefix).toBe('maestro/');
  });

  it('reads global config and merges into defaults', async () => {
    await writeJson(join(home, '.maestro', 'config.json'), {
      providers: { anthropic: { apiKey: 'sk-global' } },
      permissions: { mode: 'strict' },
    });
    const loaded = await loadConfig({ home, cwd, env: {} });
    expect(loaded.resolved.providers.anthropic.apiKey).toBe('sk-global');
    expect(loaded.resolved.permissions.mode).toBe('strict');
  });

  it('lets project config override global config', async () => {
    await writeJson(join(home, '.maestro', 'config.json'), {
      providers: { anthropic: { apiKey: 'sk-global' } },
      permissions: { mode: 'strict' },
    });
    await writeJson(join(cwd, '.maestro', 'config.json'), {
      permissions: { mode: 'yolo', allowlist: ['pytest'] },
    });
    const loaded = await loadConfig({ home, cwd, env: {} });
    expect(loaded.resolved.providers.anthropic.apiKey).toBe('sk-global');
    expect(loaded.resolved.permissions.mode).toBe('yolo');
    expect(loaded.resolved.permissions.allowlist).toEqual(['pytest']);
  });

  it('lets env vars override secrets from config files', async () => {
    await writeJson(join(home, '.maestro', 'config.json'), {
      providers: { anthropic: { apiKey: 'sk-global' } },
    });
    const loaded = await loadConfig({
      home,
      cwd,
      env: { MAESTRO_ANTHROPIC_KEY: 'sk-env' },
    });
    expect(loaded.resolved.providers.anthropic.apiKey).toBe('sk-env');
  });

  it('lets runOverrides win over everything', async () => {
    await writeJson(join(home, '.maestro', 'config.json'), {
      permissions: { mode: 'strict' },
    });
    await writeJson(join(cwd, '.maestro', 'config.json'), {
      permissions: { mode: 'allowlist' },
    });
    const loaded = await loadConfig({
      home,
      cwd,
      env: {},
      runOverrides: { permissions: { mode: 'yolo' } },
    });
    expect(loaded.resolved.permissions.mode).toBe('yolo');
  });

  it('throws a ConfigValidationError on invalid merged config', async () => {
    await writeJson(join(cwd, '.maestro', 'config.json'), {
      permissions: { mode: 'chaotic' },
    });
    await expect(loadConfig({ home, cwd, env: {} })).rejects.toBeInstanceOf(
      ConfigValidationError,
    );
  });

  it('throws a ConfigParseError on malformed JSON', async () => {
    await mkdir(join(cwd, '.maestro'), { recursive: true });
    await writeFile(join(cwd, '.maestro', 'config.json'), '{ not json', 'utf8');
    await expect(loadConfig({ home, cwd, env: {} })).rejects.toThrowError(
      /Invalid JSON/,
    );
  });
});

describe('writeConfigFile / readConfigFile', () => {
  it('round-trips a config through disk', async () => {
    const path = join(cwd, '.maestro', 'config.json');
    await writeConfigFile(path, {
      providers: { anthropic: { apiKey: 'sk-1' } },
    });
    const read = await readConfigFile(path);
    expect(read).toEqual({
      providers: { anthropic: { apiKey: 'sk-1' } },
    });
  });

  it('returns null when reading a missing file', async () => {
    expect(await readConfigFile(join(cwd, 'missing.json'))).toBeNull();
  });
});
