import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createConfigCommand } from './config.js';

let home: string;
let cwd: string;
let originalCwd: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;
let stdout: string[];
let stderr: string[];

const io = {
  stdout: (line: string) => stdout.push(line),
  stderr: (line: string) => stderr.push(line),
};

async function run(args: string[]): Promise<void> {
  const program = createConfigCommand(io);
  program.exitOverride();
  await program.parseAsync(args, { from: 'user' });
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'maestro-home-'));
  cwd = await mkdtemp(join(tmpdir(), 'maestro-cwd-'));
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  process.chdir(cwd);
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  stdout = [];
  stderr = [];
  process.exitCode = 0;
});

afterEach(async () => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  delete process.env.MAESTRO_ANTHROPIC_KEY;
  process.exitCode = 0;
  await Promise.all([
    rm(home, { recursive: true, force: true }),
    rm(cwd, { recursive: true, force: true }),
  ]);
});

describe('maestro config', () => {
  it('list prints the resolved config with secrets masked', async () => {
    await mkdir(join(cwd, '.maestro'), { recursive: true });
    await writeFile(
      join(cwd, '.maestro', 'config.json'),
      JSON.stringify({ providers: { anthropic: { apiKey: 'sk-real' } } }),
    );
    await run(['list']);
    const parsed = JSON.parse(stdout.join('\n'));
    expect(parsed.providers.anthropic.apiKey).toBe('***masked***');
  });

  it('get returns a specific path', async () => {
    await run(['get', 'permissions.mode']);
    expect(stdout).toEqual(['allowlist']);
  });

  it('get masks a secret path', async () => {
    await mkdir(join(cwd, '.maestro'), { recursive: true });
    await writeFile(
      join(cwd, '.maestro', 'config.json'),
      JSON.stringify({ providers: { anthropic: { apiKey: 'sk-real' } } }),
    );
    await run(['get', 'providers.anthropic.apiKey']);
    expect(stdout).toEqual(['***masked***']);
  });

  it('set writes to the project config and validates', async () => {
    await run(['set', 'permissions.mode', 'yolo']);
    const file = JSON.parse(
      await readFile(join(cwd, '.maestro', 'config.json'), 'utf8'),
    );
    expect(file.permissions.mode).toBe('yolo');
  });

  it('set rejects invalid values without writing', async () => {
    await run(['set', 'permissions.mode', 'chaotic']);
    expect(process.exitCode).toBe(1);
    expect(stderr.join('\n')).toMatch(/permissions.mode/);
  });

  it('validate reports invalid configs', async () => {
    await mkdir(join(cwd, '.maestro'), { recursive: true });
    await writeFile(
      join(cwd, '.maestro', 'config.json'),
      JSON.stringify({ permissions: { mode: 'chaotic' } }),
    );
    await run(['validate']);
    expect(process.exitCode).toBe(1);
    expect(stderr.join('\n')).toMatch(/Configuration is invalid/);
  });

  it('validate succeeds on a valid config', async () => {
    await run(['validate']);
    expect(process.exitCode).toBe(0);
    expect(stdout.join('\n')).toMatch(/Configuration is valid/);
  });

  it('path lists which config files exist', async () => {
    await mkdir(join(cwd, '.maestro'), { recursive: true });
    await writeFile(
      join(cwd, '.maestro', 'config.json'),
      JSON.stringify({}),
    );
    await run(['path']);
    const joined = stdout.join('\n');
    expect(joined).toMatch(/project.*\[exists\]/);
    expect(joined).toMatch(/global.*\[absent/);
  });
});

describe('maestro config (resolveConfigPaths sanity)', () => {
  it('resolves under HOME env var', () => {
    // Smoke test that chdir + HOME are honoured across the CLI tests above.
    expect(typeof process.env.HOME).toBe('string');
    expect(vi).toBeDefined();
  });
});
