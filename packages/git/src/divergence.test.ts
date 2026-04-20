import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { commitSprint } from './commit.js';
import { detectDivergence } from './divergence.js';
import { runGit } from './runner.js';

let cwd: string;

async function init(): Promise<void> {
  await runGit(['init', '-b', 'main'], { cwd });
  await runGit(['config', 'user.email', 'm@example.com'], { cwd });
  await runGit(['config', 'user.name', 'M'], { cwd });
  await runGit(['config', 'commit.gpgsign', 'false'], { cwd });
  await writeFile(join(cwd, 'a.txt'), 'a\n', 'utf8');
  await commitSprint({ cwd, type: 'chore', subject: 'init' });
}

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'maestro-div-'));
  await init();
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('detectDivergence', () => {
  it('reports no divergence on the expected branch', async () => {
    const report = await detectDivergence({
      cwd,
      expectedBranch: 'main',
      since: '2099-01-01',
    });
    expect(report.branchOk).toBe(true);
    expect(report.newCommits).toBe(0);
    expect(report.diverged).toBe(false);
  });

  it('flags branch mismatch', async () => {
    await runGit(['checkout', '-b', 'feature'], { cwd });
    const report = await detectDivergence({
      cwd,
      expectedBranch: 'main',
      since: '2099-01-01',
    });
    expect(report.branchOk).toBe(false);
    expect(report.currentBranch).toBe('feature');
    expect(report.diverged).toBe(true);
  });

  it('counts new commits since the given timestamp', async () => {
    await writeFile(join(cwd, 'b.txt'), 'b\n', 'utf8');
    await commitSprint({ cwd, type: 'feat', subject: 'add b' });
    const report = await detectDivergence({
      cwd,
      expectedBranch: 'main',
      since: '1970-01-01',
    });
    expect(report.newCommits).toBeGreaterThan(0);
    expect(report.diverged).toBe(true);
  });
});
