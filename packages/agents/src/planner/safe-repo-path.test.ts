import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolvePathUnderRepo } from './safe-repo-path.js';

describe('resolvePathUnderRepo', () => {
  let repo: string;

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'maestro-safe-repo-'));
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('resolves a normal relative path under the repo', () => {
    expect(resolvePathUnderRepo(repo, join('docs', 'a.md'))).toBe(
      join(repo, 'docs', 'a.md'),
    );
  });

  it('rejects path traversal', () => {
    expect(() => resolvePathUnderRepo(repo, join('..', 'etc', 'passwd'))).toThrow(
      /escapes repository root/u,
    );
  });
});
