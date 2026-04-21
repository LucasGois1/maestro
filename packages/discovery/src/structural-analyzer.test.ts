import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { analyzeStructure } from './structural-analyzer.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'maestro-disc-struct-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('analyzeStructure', () => {
  it('lists top-level names and skips heavy dirs', async () => {
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, 'node_modules'), { recursive: true });
    await writeFile(join(root, 'src', 'app.ts'), 'export {}\n', 'utf8');
    await writeFile(join(root, 'node_modules', 'x.js'), '1', 'utf8');

    const s = await analyzeStructure(root);

    expect(s.topLevelNames).toContain('src');
    expect(s.topLevelNames).not.toContain('node_modules');
    expect(s.extensionCounts['.ts']).toBe(1);
    expect(s.approxFileCount).toBe(1);
  });

  it('records test directory hints', async () => {
    await mkdir(join(root, 'tests'), { recursive: true });
    await writeFile(join(root, 'tests', 'a.test.ts'), '1', 'utf8');

    const s = await analyzeStructure(root);

    expect(s.testDirectoryHints.some((h) => h.includes('tests'))).toBe(true);
  });

  it('aggregates extensions across shallow tree', async () => {
    await writeFile(join(root, 'a.py'), '1', 'utf8');
    await writeFile(join(root, 'b.py'), '2', 'utf8');

    const s = await analyzeStructure(root);

    expect(s.extensionCounts['.py']).toBe(2);
  });
});
