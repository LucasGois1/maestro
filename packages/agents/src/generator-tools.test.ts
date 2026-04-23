import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configSchema } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createGeneratorToolSet } from './generator-tools.js';

let repoRoot: string;

function toolExec<I>(value: unknown): (input: I) => Promise<string> {
  return (value as { execute: (input: I) => Promise<string> }).execute;
}

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-gen-tools-'));
  await writeFile(join(repoRoot, 'package.json'), '{"name":"x"}', 'utf8');
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('createGeneratorToolSet', () => {
  it('reads, writes, and edits repo files safely', async () => {
    const bus = createEventBus();
    const config = configSchema.parse({ permissions: { mode: 'yolo' } });
    const tools = createGeneratorToolSet({
      workspaceRoot: repoRoot,
      stateRepoRoot: repoRoot,
      config,
      runId: 'run1',
      bus,
    });

    const writeFileTool = toolExec<{ path: string; content: string }>(
      tools.writeFile,
    );
    const readFileTool = toolExec<{ path: string }>(tools.readFile);
    const editFileTool = toolExec<{
      path: string;
      oldStr: string;
      newStr: string;
    }>(tools.editFile);

    await expect(
      writeFileTool({ path: 'src/example.ts', content: 'one two\n' }),
    ).resolves.toBe('Escrito: src/example.ts');
    await expect(readFileTool({ path: 'src/example.ts' })).resolves.toBe(
      'one two\n',
    );
    await expect(
      editFileTool({
        path: 'src/example.ts',
        oldStr: 'two',
        newStr: 'three',
      }),
    ).resolves.toBe('Editado: src/example.ts');
    await expect(
      readFile(join(repoRoot, 'src', 'example.ts'), 'utf8'),
    ).resolves.toBe('one three\n');
    await expect(
      editFileTool({
        path: 'src/example.ts',
        oldStr: 'missing',
        newStr: 'x',
      }),
    ).resolves.toBe('oldStr não encontrado no ficheiro.');
  });

  it('writes under workspaceRoot when stateRepoRoot differs', async () => {
    const stateRoot = await mkdtemp(join(tmpdir(), 'maestro-gen-state-'));
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'maestro-gen-ws-'));
    try {
      await mkdir(join(stateRoot, '.maestro'), { recursive: true });
      await writeFile(
        join(stateRoot, '.maestro', 'AGENTS.md'),
        '# Agents\n',
        'utf8',
      );
      await writeFile(
        join(workspaceRoot, 'package.json'),
        '{"name":"ws"}',
        'utf8',
      );

      const bus = createEventBus();
      const config = configSchema.parse({ permissions: { mode: 'yolo' } });
      const tools = createGeneratorToolSet({
        workspaceRoot,
        stateRepoRoot: stateRoot,
        config,
        runId: 'run1',
        bus,
      });

      const writeFileTool = toolExec<{ path: string; content: string }>(
        tools.writeFile,
      );
      await expect(
        writeFileTool({ path: 'lib/x.ts', content: 'export {}\n' }),
      ).resolves.toBe('Escrito: lib/x.ts');

      await expect(
        readFile(join(workspaceRoot, 'lib', 'x.ts'), 'utf8'),
      ).resolves.toBe('export {}\n');
      await expect(readFile(join(stateRoot, 'lib', 'x.ts'), 'utf8')).rejects.toThrow();
    } finally {
      await rm(stateRoot, { recursive: true, force: true });
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('rejects ambiguous edits and reports shell/git errors without throwing', async () => {
    const bus = createEventBus();
    const config = configSchema.parse({ permissions: { mode: 'yolo' } });
    await writeFile(join(repoRoot, 'dup.txt'), 'same same\n', 'utf8');
    const tools = createGeneratorToolSet({
      workspaceRoot: repoRoot,
      stateRepoRoot: repoRoot,
      config,
      runId: 'run1',
      bus,
    });

    await expect(
      toolExec<{ path: string; oldStr: string; newStr: string }>(
        tools.editFile,
      )({ path: 'dup.txt', oldStr: 'same', newStr: 'new' }),
    ).resolves.toBe('oldStr não é único; torne o fragmento mais específico.');

    await expect(
      toolExec<{ cmd: string; args: string[] }>(tools.runShell)({
        cmd: 'git',
        args: ['--version'],
      }),
    ).resolves.toContain('OK');
    await expect(
      toolExec<{ type: string; scope?: string; subject: string }>(
        tools.gitCommit,
      )({ type: 'test', subject: 'commit from non git repo' }),
    ).resolves.toContain('Erro git:');
  });

  it('runSensor hook can simulate fail then pass (tight loop wiring)', async () => {
    const bus = createEventBus();
    const config = configSchema.parse({ permissions: { mode: 'yolo' } });
    let calls = 0;
    const tools = createGeneratorToolSet(
      {
        workspaceRoot: repoRoot,
        stateRepoRoot: repoRoot,
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
    const exec = toolExec<{ id: string }>(tools.runSensor);
    const r1 = await exec({ id: 'any' });
    const r2 = await exec({ id: 'any' });
    expect(r1).toContain('FAIL');
    expect(r2).toContain('OK');
    expect(calls).toBe(2);
  });
});
