import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectStaleDocumentation } from './detect-stale-docs.js';

let repoRoot: string;

beforeEach(async () => {
  const agentsRoot = fileURLToPath(new URL('../..', import.meta.url));
  const tmpBase = join(agentsRoot, '.vitest-tmp');
  await mkdir(tmpBase, { recursive: true });
  repoRoot = await mkdtemp(join(tmpBase, 'stale-doc-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('detectStaleDocumentation', () => {
  it('does not flag a relative link to an existing directory', async () => {
    await mkdir(join(repoRoot, '.maestro'), { recursive: true });
    await writeFile(join(repoRoot, '.maestro', 'AGENTS.md'), '# A\n', 'utf8');
    await mkdir(join(repoRoot, 'docs', 'nested'), { recursive: true });
    await writeFile(
      join(repoRoot, 'docs', 'index.md'),
      'See [nested](./nested)\n',
      'utf8',
    );

    const findings = await detectStaleDocumentation(repoRoot);
    const broken = findings.filter((f) => f.message.includes('Broken link'));
    expect(broken).toHaveLength(0);
  });
});
