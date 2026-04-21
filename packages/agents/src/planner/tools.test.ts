import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createKBManager } from '@maestro/kb';

import { createPlannerToolSet } from './tools.js';

describe('createPlannerToolSet', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'maestro-planner-tools-'));
    const kb = createKBManager({ repoRoot: dir });
    await kb.init();
    await mkdir(join(dir, 'docs'), { recursive: true });
    await writeFile(join(dir, 'docs', 'note.md'), '# Hello\n', 'utf8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('exposes readKB, listDirectory, searchCode', () => {
    const tools = createPlannerToolSet(dir);
    expect(Object.keys(tools).sort()).toEqual([
      'listDirectory',
      'readKB',
      'searchCode',
    ]);
  });

  it('readKB reads docs/ paths and KB-relative paths', async () => {
    const { readKB } = createPlannerToolSet(dir);
    const docs = await readFile(join(dir, 'docs', 'note.md'), 'utf8');
    const exec = (
      readKB as unknown as {
        execute: (input: { path: string }) => Promise<string>;
      }
    ).execute;
    expect(await exec({ path: 'docs/note.md' })).toBe(docs);
    const agents = await readFile(join(dir, '.maestro', 'AGENTS.md'), 'utf8');
    expect(await exec({ path: 'AGENTS.md' })).toBe(agents);
  });
});
