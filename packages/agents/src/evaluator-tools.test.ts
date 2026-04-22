import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configSchema } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createEvaluatorToolSet } from './evaluator-tools.js';

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
    runId: 'run-eval',
    bus: createEventBus(),
    codeDiff: '+change',
    sprintContract: 'acceptance',
  };
}

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-evaluator-tools-repo-'));
  worktreeRoot = await mkdtemp(join(tmpdir(), 'maestro-evaluator-tools-wt-'));
  await writeFile(join(worktreeRoot, 'README.md'), 'hello\n', 'utf8');
});

afterEach(async () => {
  await Promise.all([
    rm(repoRoot, { recursive: true, force: true }),
    rm(worktreeRoot, { recursive: true, force: true }),
  ]);
});

describe('createEvaluatorToolSet', () => {
  it('reads files, runs shell commands, and delegates sensors through hooks', async () => {
    const tools = createEvaluatorToolSet(ctx(), {
      runSensor: async (id) => `sensor ${id} ok`,
    });

    await expect(
      toolExec<{ path: string }>(tools.readFile)({ path: 'README.md' }),
    ).resolves.toBe('hello\n');
    await expect(
      toolExec<{ cmd: string; args: string[] }>(tools.runShell)({
        cmd: 'git',
        args: ['--version'],
      }),
    ).resolves.toContain('OK');
    await expect(
      toolExec<{ id: string }>(tools.runSensor)({ id: 'unit' }),
    ).resolves.toBe('sensor unit ok');
  });

  it('uses hooks for browser, sqlite, and API tools', async () => {
    const tools = createEvaluatorToolSet(ctx(), {
      navigateBrowser: async (url) => `browser:${url}`,
      querySqlite: async (dbPath, sql) => `sqlite:${dbPath}:${sql}`,
      callApi: async (input) => `api:${input.method}:${input.url}`,
    });

    await expect(
      toolExec<{ url: string }>(tools.navigateBrowser)({
        url: 'https://example.test',
      }),
    ).resolves.toBe('browser:https://example.test');
    await expect(
      toolExec<{ dbPath: string; sql: string }>(tools.querySqlite)({
        dbPath: 'db.sqlite',
        sql: 'select 1',
      }),
    ).resolves.toBe('sqlite:db.sqlite:select 1');
    await expect(
      toolExec<{
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        url: string;
      }>(tools.callApi)({ method: 'POST', url: 'https://api.example.test' }),
    ).resolves.toBe('api:POST:https://api.example.test');
  });

  it('blocks invalid URLs, private hosts, and non-select sqlite statements', async () => {
    const tools = createEvaluatorToolSet(ctx());

    await expect(
      toolExec<{ url: string }>(tools.navigateBrowser)({
        url: 'file:///tmp/x',
      }),
    ).resolves.toBe('Invalid or non-http(s) URL.');
    await expect(
      toolExec<{ url: string }>(tools.navigateBrowser)({
        url: 'http://127.0.0.1:3000',
      }),
    ).resolves.toBe('URL host is blocked (local/private networks).');
    await expect(
      toolExec<{ dbPath: string; sql: string }>(tools.querySqlite)({
        dbPath: 'db.sqlite',
        sql: 'delete from users',
      }),
    ).resolves.toBe('Only SELECT queries are allowed.');
    await expect(
      toolExec<{ method: 'GET'; url: string }>(tools.callApi)({
        method: 'GET',
        url: 'ftp://example.test',
      }),
    ).resolves.toBe('Invalid or non-http(s) URL.');
    await expect(
      toolExec<{ method: 'GET'; url: string }>(tools.callApi)({
        method: 'GET',
        url: 'http://10.0.0.1',
      }),
    ).resolves.toBe('URL host is blocked (local/private networks).');
  });
});
