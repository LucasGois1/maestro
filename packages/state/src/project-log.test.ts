import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendProjectLog, readProjectLog } from './project-log.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-log-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('appendProjectLog', () => {
  it('creates the file on first write and appends thereafter', async () => {
    await appendProjectLog({
      repoRoot,
      entry: {
        event: 'run.started',
        runId: 'r1',
        detail: 'prompt was "ship"',
        now: new Date('2026-04-20T00:00:00.000Z'),
      },
    });
    await appendProjectLog({
      repoRoot,
      entry: {
        event: 'run.completed',
        runId: 'r1',
        now: new Date('2026-04-20T00:05:00.000Z'),
      },
    });

    const contents = await readProjectLog(repoRoot);
    expect(contents).toContain('run.started');
    expect(contents).toContain('run.completed');
    expect(contents).toContain('[r1]');
    expect(contents.split('\n').filter(Boolean)).toHaveLength(2);
  });

  it('readProjectLog returns empty string when log is absent', async () => {
    expect(await readProjectLog(repoRoot)).toBe('');
  });
});
