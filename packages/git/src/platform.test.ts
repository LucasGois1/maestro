import { EventEmitter } from 'node:events';
import type { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  buildPrCommand,
  detectRemote,
  executePrCommand,
  parsePrUrlFromCliOutput,
  renderPrBody,
  UnsupportedPlatformError,
  type GitRunner,
  type PlatformCommand,
} from './index.js';

function runnerWithRemote(url: string): GitRunner {
  return async () => ({ stdout: `${url}\n`, stderr: '', code: 0 });
}

function spawnWithOutput(stdout: string, code = 0): typeof spawn {
  return ((_program: string, _args: readonly string[]) => {
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough };
    child.stdout = new PassThrough();
    queueMicrotask(() => {
      child.stdout.end(stdout);
      child.emit('close', code);
    });
    return child;
  }) as unknown as typeof spawn;
}

const pr = {
  title: 'feat: ship jwt',
  summary: 'Add JWT auth.',
  sprints: [
    {
      id: 's1',
      description: 'JWT sign/verify',
      acceptance: ['signs', 'rejects expired'],
    },
  ],
  sensors: ['pytest', 'ruff'],
  runId: 'run-abc',
};

describe('detectRemote', () => {
  it('classifies github URLs', async () => {
    const info = await detectRemote({
      cwd: '/tmp',
      runner: runnerWithRemote('git@github.com:acme/repo.git'),
    });
    expect(info?.platform).toBe('github');
  });

  it('classifies gitlab URLs', async () => {
    const info = await detectRemote({
      cwd: '/tmp',
      runner: runnerWithRemote('https://gitlab.com/acme/repo.git'),
    });
    expect(info?.platform).toBe('gitlab');
  });

  it('classifies unknown URLs and preserves custom remote names', async () => {
    const info = await detectRemote({
      cwd: '/tmp',
      remote: 'upstream',
      runner: runnerWithRemote('ssh://example.test/acme/repo.git'),
    });
    expect(info).toEqual({
      name: 'upstream',
      url: 'ssh://example.test/acme/repo.git',
      platform: 'unknown',
    });
  });

  it('returns null when the remote lookup fails', async () => {
    const info = await detectRemote({
      cwd: '/tmp',
      runner: async () => ({ stdout: '', stderr: 'no remote', code: 1 }),
    });
    expect(info).toBeNull();
  });

  it('returns null for an empty remote URL', async () => {
    const info = await detectRemote({
      cwd: '/tmp',
      runner: async () => ({ stdout: '  \n', stderr: '', code: 0 }),
    });
    expect(info).toBeNull();
  });
});

describe('renderPrBody', () => {
  it('includes summary, sprints, sensors, and run reference', () => {
    const body = renderPrBody(pr);
    expect(body).toContain('## Summary');
    expect(body).toContain('Add JWT auth');
    expect(body).toContain('### s1 — JWT sign/verify');
    expect(body).toContain('- [x] signs');
    expect(body).toContain('## Sensors');
    expect(body).toContain('pytest ✅');
    expect(body).toContain('run-abc');
  });
});

describe('buildPrCommand', () => {
  it('builds a gh command for GitHub', () => {
    const cmd = buildPrCommand({
      platform: 'github',
      pr,
      baseBranch: 'main',
      head: 'maestro/branch',
    });
    expect(cmd.program).toBe('gh');
    expect(cmd.args).toContain('--title');
    expect(cmd.args).toContain(pr.title);
    expect(cmd.args).toContain('--head');
    expect(cmd.args).toContain('maestro/branch');
    expect(cmd.args).toContain('--label');
    expect(cmd.args).toContain('maestro');
  });

  it('builds a glab command for GitLab', () => {
    const cmd = buildPrCommand({
      platform: 'gitlab',
      pr,
      baseBranch: 'main',
      head: 'maestro/branch',
    });
    expect(cmd.program).toBe('glab');
    expect(cmd.args).toContain('--title');
    expect(cmd.args).toContain('--source-branch');
    expect(cmd.args).toContain('maestro/branch');
    expect(cmd.args.join(' ')).toContain('maestro,ai-generated');
  });

  it('adds --draft for GitHub and GitLab when draft is true', () => {
    const gh = buildPrCommand({
      platform: 'github',
      pr,
      baseBranch: 'main',
      draft: true,
    });
    expect(gh.args).toContain('--draft');
    const glab = buildPrCommand({
      platform: 'gitlab',
      pr,
      baseBranch: 'main',
      draft: true,
    });
    expect(glab.args).toContain('--draft');
  });

  it('throws for unknown platforms', () => {
    expect(() => buildPrCommand({ platform: 'unknown', pr })).toThrow(
      UnsupportedPlatformError,
    );
  });
});

describe('parsePrUrlFromCliOutput', () => {
  it('extracts GitHub and GitLab URLs with PR numbers', () => {
    expect(
      parsePrUrlFromCliOutput('Created https://github.com/acme/repo/pull/42'),
    ).toEqual({
      prUrl: 'https://github.com/acme/repo/pull/42',
      prNumber: 42,
    });
    expect(
      parsePrUrlFromCliOutput(
        'Created https://gitlab.example/acme/repo/-/merge_requests/7',
      ),
    ).toEqual({
      prUrl: 'https://gitlab.example/acme/repo/-/merge_requests/7',
      prNumber: 7,
    });
  });

  it('falls back to a loose URL or an empty result', () => {
    expect(parsePrUrlFromCliOutput('see https://example.test/pr')).toEqual({
      prUrl: 'https://example.test/pr',
    });
    expect(parsePrUrlFromCliOutput('created locally')).toEqual({});
  });
});

describe('executePrCommand', () => {
  it('returns stdout and exit code from the platform CLI', async () => {
    const command: PlatformCommand = {
      program: 'gh',
      args: ['pr', 'create'],
    };

    await expect(
      executePrCommand({
        command,
        cwd: '/repo',
        spawnImpl: spawnWithOutput('https://github.com/acme/repo/pull/3\n', 0),
      }),
    ).resolves.toEqual({
      stdout: 'https://github.com/acme/repo/pull/3\n',
      code: 0,
    });
  });

  it('rejects spawn errors', async () => {
    const command: PlatformCommand = {
      program: 'gh',
      args: ['pr', 'create'],
    };
    const spawnImpl = (() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
      };
      child.stdout = new PassThrough();
      queueMicrotask(() => child.emit('error', new Error('missing gh')));
      return child;
    }) as unknown as typeof spawn;

    await expect(
      executePrCommand({ command, cwd: '/repo', spawnImpl }),
    ).rejects.toThrow('missing gh');
  });
});
