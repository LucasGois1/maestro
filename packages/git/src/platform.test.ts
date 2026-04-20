import { describe, expect, it } from 'vitest';

import {
  buildPrCommand,
  detectRemote,
  renderPrBody,
  UnsupportedPlatformError,
  type GitRunner,
} from './index.js';

function runnerWithRemote(url: string): GitRunner {
  return async () => ({ stdout: `${url}\n`, stderr: '', code: 0 });
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

  it('returns null when the remote lookup fails', async () => {
    const info = await detectRemote({
      cwd: '/tmp',
      runner: async () => ({ stdout: '', stderr: 'no remote', code: 1 }),
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
    const cmd = buildPrCommand({ platform: 'github', pr, baseBranch: 'main' });
    expect(cmd.program).toBe('gh');
    expect(cmd.args).toContain('--title');
    expect(cmd.args).toContain(pr.title);
    expect(cmd.args).toContain('--label');
    expect(cmd.args).toContain('maestro');
  });

  it('builds a glab command for GitLab', () => {
    const cmd = buildPrCommand({ platform: 'gitlab', pr, baseBranch: 'main' });
    expect(cmd.program).toBe('glab');
    expect(cmd.args).toContain('--title');
    expect(cmd.args.join(' ')).toContain('maestro,ai-generated');
  });

  it('throws for unknown platforms', () => {
    expect(() => buildPrCommand({ platform: 'unknown', pr })).toThrow(
      UnsupportedPlatformError,
    );
  });
});
