import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configSchema } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createGardenerToolSet } from './gardener-tools.js';

let repoRoot: string;
let worktreeRoot: string;

function toolExec<I>(value: unknown): (input: I) => Promise<string> {
  return (value as { execute: (input: I) => Promise<string> }).execute;
}

function ctx() {
  return {
    repoRoot,
    worktreeRoot,
    config: configSchema.parse({ permissions: { mode: 'yolo' } }),
    runId: 'run-gardener',
    bus: createEventBus(),
    maestroDir: '.maestro',
    codeDiff: '+docs',
  };
}

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-gardener-tools-repo-'));
  worktreeRoot = await mkdtemp(join(tmpdir(), 'maestro-gardener-tools-wt-'));
  await writeFile(
    join(worktreeRoot, 'package.json'),
    '{"name":"docs"}',
    'utf8',
  );
});

afterEach(async () => {
  await Promise.all([
    rm(repoRoot, { recursive: true, force: true }),
    rm(worktreeRoot, { recursive: true, force: true }),
  ]);
});

describe('createGardenerToolSet', () => {
  it('inherits architect read tools and writes documentation files', async () => {
    const tools = createGardenerToolSet(ctx());

    await expect(
      toolExec<{ path: string }>(tools.readFile)({ path: 'package.json' }),
    ).resolves.toContain('"docs"');
    await expect(
      toolExec<Record<string, never>>(tools.getDependencies)({}),
    ).resolves.toContain('package.json (docs)');
    await expect(
      toolExec<{ path: string; content: string }>(tools.writeFile)({
        path: 'docs/testing.md',
        content: '# Testing\n',
      }),
    ).resolves.toBe('Written: docs/testing.md');
    await expect(
      readFile(join(worktreeRoot, 'docs', 'testing.md'), 'utf8'),
    ).resolves.toBe('# Testing\n');
  });

  it('runs shell, reports unsupported PR remotes, and surfaces sensor errors', async () => {
    const tools = createGardenerToolSet(ctx());

    await expect(
      toolExec<{ cmd: string; args: string[] }>(tools.runShell)({
        cmd: 'git',
        args: ['--version'],
      }),
    ).resolves.toContain('OK');
    await expect(
      toolExec<{ title: string; body: string; labels: string[] }>(
        tools.createPullRequest,
      )({
        title: 'docs: update',
        body: 'Update docs',
        labels: ['docs'],
      }),
    ).resolves.toBe(
      'No supported git remote (need GitHub or GitLab URL on origin).',
    );
    await expect(
      toolExec<{ sensorId: string }>(tools.runSensor)({ sensorId: 'missing' }),
    ).resolves.toContain('Sensor "missing" não encontrado');
  });
});
