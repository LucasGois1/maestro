import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { summarizeDependencies } from './repo-tools.js';

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
});
