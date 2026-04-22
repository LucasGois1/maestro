import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createArchitectToolSet,
  createPlannerToolSet,
  readRepoFileContent,
  summarizeDependencies,
} from './repo-tools.js';

function toolExec<I>(value: unknown): (input: I) => Promise<string> {
  return (value as { execute: (input: I) => Promise<string> }).execute;
}

describe('summarizeDependencies', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'maestro-deps-'));
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'test-pkg',
        dependencies: { react: '^19.0.0', hono: '^4.0.0' },
        devDependencies: { vitest: '^3.0.0' },
      }),
      'utf8',
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('includes package.json dependency names', async () => {
    const s = await summarizeDependencies(dir);
    expect(s).toContain('package.json');
    expect(s).toContain('react');
    expect(s).toContain('vitest');
  });

  it('returns a fallback when no manifests are present', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'maestro-deps-empty-'));
    try {
      await expect(summarizeDependencies(empty)).resolves.toContain(
        'Nenhum manifesto encontrado',
      );
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  it('reads repo files with truncation for large content', async () => {
    await writeFile(join(dir, 'large.txt'), 'x'.repeat(120_010), 'utf8');

    const content = await readRepoFileContent(dir, 'large.txt');

    expect(content).toHaveLength(120_012);
    expect(content).toContain('…(truncado)');
  });

  it('planner tools list directories and search code', async () => {
    await mkdir(join(dir, 'src'), { recursive: true });
    await mkdir(join(dir, 'node_modules', 'ignored'), { recursive: true });
    await writeFile(join(dir, 'src', 'app.ts'), 'const target = 1;\n', 'utf8');
    await writeFile(
      join(dir, 'node_modules', 'ignored', 'dep.ts'),
      'target\n',
      'utf8',
    );
    const tools = createPlannerToolSet(dir);

    await expect(
      toolExec<{ relativePath?: string; maxDepth?: number }>(
        tools.listDirectory,
      )({ relativePath: '', maxDepth: 2 }),
    ).resolves.toContain('src/app.ts');
    await expect(
      toolExec<{ query: string; maxLines?: number }>(tools.searchCode)({
        query: 'target',
        maxLines: 5,
      }),
    ).resolves.toContain('src/app.ts');
  });

  it('architect tools read files and summarize dependencies', async () => {
    const tools = createArchitectToolSet(dir);

    await expect(
      toolExec<{ path: string }>(tools.readFile)({ path: 'package.json' }),
    ).resolves.toContain('"test-pkg"');
    await expect(
      toolExec<Record<string, never>>(tools.getDependencies)({}),
    ).resolves.toContain('package.json (test-pkg)');
  });
});
