import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createGitFixture, createRunFixture } from './fixtures.js';

describe('fixture helpers', () => {
  it('creates git fixtures that do not inherit signing config', async () => {
    const fixture = await createGitFixture();
    try {
      const config = await readFile(
        join(fixture.repoRoot, '.git', 'config'),
        'utf8',
      );
      expect(config).toContain('gpgsign = false');
    } finally {
      await fixture.cleanup();
    }
  });

  it('creates a run fixture with state store and event bus', async () => {
    const fixture = await createRunFixture({ prompt: 'ship tests' });
    try {
      const state = await fixture.store.create({
        runId: fixture.runId,
        branch: fixture.branch,
        worktreePath: fixture.repoRoot,
        prompt: fixture.prompt,
        userAgent: 'testkit',
        providerDefaults: {},
      });
      expect(state.runId).toBe(fixture.runId);
      expect(fixture.events).toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });
});
