import { EventEmitter } from 'node:events';
import type { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createGitRunner, GitCommandError } from './index.js';

type SpawnCall = {
  readonly program: string;
  readonly args: readonly string[];
  readonly options: {
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly stdio?: readonly string[];
  };
};

function fakeSpawn(
  calls: SpawnCall[],
  result:
    | {
        readonly stdout?: string;
        readonly stderr?: string;
        readonly code?: number | null;
      }
    | Error,
): typeof spawn {
  return ((
    program: string,
    args: readonly string[],
    options: SpawnCall['options'],
  ) => {
    calls.push({ program, args, options });
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    queueMicrotask(() => {
      if (result instanceof Error) {
        child.emit('error', result);
        return;
      }
      child.stdout.end(result.stdout ?? '');
      child.stderr.end(result.stderr ?? '');
      child.emit('close', result.code ?? 0);
    });
    return child;
  }) as unknown as typeof spawn;
}

describe('createGitRunner', () => {
  it('spawns git with cwd, env, and captured output', async () => {
    const calls: SpawnCall[] = [];
    const runner = createGitRunner(
      fakeSpawn(calls, { stdout: 'ok\n', stderr: 'warn\n', code: 0 }),
    );

    await expect(
      runner(['status'], { cwd: '/repo', env: { FOO: 'bar' } }),
    ).resolves.toEqual({
      stdout: 'ok\n',
      stderr: 'warn\n',
      code: 0,
    });
    expect(calls[0]).toMatchObject({
      program: 'git',
      args: ['status'],
      options: { cwd: '/repo', env: { FOO: 'bar' } },
    });
  });

  it('rejects non-zero exits unless allowNonZero is enabled', async () => {
    const runner = createGitRunner(
      fakeSpawn([], { stderr: 'fatal: nope\n', code: 128 }),
    );

    await expect(runner(['status'])).rejects.toBeInstanceOf(GitCommandError);

    const forgivingRunner = createGitRunner(
      fakeSpawn([], { stderr: 'fatal: nope\n', code: 128 }),
    );
    await expect(
      forgivingRunner(['status'], { allowNonZero: true }),
    ).resolves.toMatchObject({ code: 128, stderr: 'fatal: nope\n' });
  });

  it('rejects spawn errors', async () => {
    const runner = createGitRunner(fakeSpawn([], new Error('missing git')));

    await expect(runner(['status'])).rejects.toThrow('missing git');
  });
});
