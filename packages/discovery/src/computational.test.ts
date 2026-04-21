import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runComputationalDiscovery } from './computational.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'maestro-disc-comp-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('runComputationalDiscovery', () => {
  it('combines stack and structure', async () => {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'p' }),
      'utf8',
    );
    await writeFile(join(root, 'index.js'), 'module.exports = {}\n', 'utf8');

    const r = await runComputationalDiscovery(root);

    expect(r.repoRoot).toBe(root);
    expect(r.stack.kind).toBe('node');
    expect(r.structure.approxFileCount).toBeGreaterThanOrEqual(1);
    expect(r.structure.extensionCounts['.js']).toBeGreaterThanOrEqual(1);
  });
});
