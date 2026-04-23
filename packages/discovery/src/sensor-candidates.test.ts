import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runComputationalDiscovery } from './computational.js';
import {
  buildCatalogSensorCandidates,
  buildHeuristicSensorCandidates,
  mergeSensorCandidateLayers,
} from './sensor-candidates.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-sensor-cand-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('buildHeuristicSensorCandidates', () => {
  it('maps package.json scripts for pnpm repos', async () => {
    await writeFile(
      join(repoRoot, 'package.json'),
      JSON.stringify({
        scripts: { test: 'vitest', lint: 'eslint .' },
      }),
      'utf8',
    );
    await writeFile(join(repoRoot, 'pnpm-lock.yaml'), '', 'utf8');
    const comp = await runComputationalDiscovery(repoRoot);
    const list = await buildHeuristicSensorCandidates(repoRoot, comp);
    const test = list.find((c) => c.id === 'test');
    expect(test?.command).toBe('pnpm');
    expect(test?.args).toEqual(['run', 'test']);
    const lint = list.find((c) => c.id === 'lint');
    expect(lint?.args).toEqual(['run', 'lint']);
  });

  it('adds cargo tests for rust', async () => {
    await writeFile(
      join(repoRoot, 'Cargo.toml'),
      '[package]\nname = "x"\nversion = "0.1.0"\nedition = "2021"\n',
      'utf8',
    );
    const comp = await runComputationalDiscovery(repoRoot);
    const list = await buildHeuristicSensorCandidates(repoRoot, comp);
    expect(list.some((c) => c.id === 'cargo-test')).toBe(true);
  });
});

describe('buildCatalogSensorCandidates', () => {
  it('includes snyk, sonar, and semgrep entries', () => {
    const list = buildCatalogSensorCandidates('unknown');
    expect(list.map((c) => c.id).sort()).toEqual([
      'semgrep-auto',
      'snyk-test',
      'sonar-scanner',
    ]);
    expect(list.every((c) => c.onFail === 'warn')).toBe(true);
  });
});

describe('mergeSensorCandidateLayers', () => {
  it('prefers LLM over heuristic for the same id', () => {
    const merged = mergeSensorCandidateLayers([
      [
        {
          id: 'test',
          command: 'pnpm',
          args: ['run', 'test'],
          onFail: 'block',
          rationale: 'from llm',
          source: 'llm',
        },
      ],
      [
        {
          id: 'test',
          command: 'npm',
          args: ['run', 'test'],
          onFail: 'block',
          rationale: 'from heuristic',
          source: 'heuristic',
        },
      ],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.command).toBe('pnpm');
    expect(merged[0]?.source).toBe('llm');
  });

  it('prefers heuristic over catalog for the same id', () => {
    const merged = mergeSensorCandidateLayers([
      [],
      [
        {
          id: 'semgrep-auto',
          command: 'semgrep',
          args: ['check', '.'],
          onFail: 'block',
          rationale: 'heuristic override shape',
          source: 'heuristic',
        },
      ],
      [
        {
          id: 'semgrep-auto',
          command: 'semgrep',
          args: ['--config', 'auto'],
          onFail: 'warn',
          rationale: 'catalog',
          source: 'catalog',
        },
      ],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.source).toBe('heuristic');
    expect(merged[0]?.args).toEqual(['check', '.']);
  });
});
