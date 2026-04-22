import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listMaestroFilesUnderRepo } from './tui-kb.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-cli-tui-kb-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('listMaestroFilesUnderRepo', () => {
  it('returns an empty list when the knowledge base does not exist', () => {
    expect(listMaestroFilesUnderRepo(repoRoot)).toEqual([]);
  });

  it('walks .maestro files and truncates long previews', async () => {
    await mkdir(join(repoRoot, '.maestro', 'docs'), { recursive: true });
    await writeFile(join(repoRoot, '.maestro', 'AGENTS.md'), 'agents', 'utf8');
    await writeFile(
      join(repoRoot, '.maestro', 'docs', 'long.md'),
      'x'.repeat(4100),
      'utf8',
    );

    const files = listMaestroFilesUnderRepo(repoRoot).sort((a, b) =>
      a.path.localeCompare(b.path),
    );

    expect(files).toHaveLength(2);
    expect(files[0]).toEqual({
      path: '.maestro/AGENTS.md',
      previewText: 'agents',
    });
    expect(files[1]?.path).toBe('.maestro/docs/long.md');
    expect(files[1]?.previewText).toHaveLength(4001);
    expect(files[1]?.previewText.endsWith('…')).toBe(true);
  });
});
