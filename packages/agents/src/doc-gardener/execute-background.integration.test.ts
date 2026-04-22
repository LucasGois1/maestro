import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CONFIG } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { executeBackgroundGardener } from './execute-background.js';

let repoRoot: string;

beforeEach(async () => {
  const agentsRoot = fileURLToPath(new URL('../..', import.meta.url));
  const tmpBase = join(agentsRoot, '.vitest-tmp');
  await mkdir(tmpBase, { recursive: true });
  repoRoot = await mkdtemp(join(tmpBase, 'gardener-int-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('executeBackgroundGardener (integration)', () => {
  it('flags a broken markdown link via heuristics (doc)', async () => {
    await mkdir(join(repoRoot, '.maestro'), { recursive: true });
    await writeFile(join(repoRoot, '.maestro', 'AGENTS.md'), '# Agents\n', 'utf8');
    await mkdir(join(repoRoot, 'docs'), { recursive: true });
    await writeFile(
      join(repoRoot, 'docs', 'stale.md'),
      'See [missing](./not-there.md)\n',
      'utf8',
    );

    const result = await executeBackgroundGardener({
      repoRoot,
      runType: 'doc',
      config: DEFAULT_CONFIG,
      bus: createEventBus(),
      runId: 'int-doc',
      skipLlm: true,
      skipPr: true,
    });

    expect(result.issuesFound).toBeGreaterThanOrEqual(1);
    expect(result.reportPath).toMatch(/\.maestro\/docs\/background-reports\//u);
    const absReport = join(repoRoot, result.reportPath);
    const body = await readFile(absReport, 'utf8');
    expect(body).toMatch(/Broken link/);
  });
});
