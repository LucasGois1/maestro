import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendRunLog } from './run-log.js';
import { runLogPath } from './paths.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-runlog-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('appendRunLog', () => {
  it('appends a line under the run directory', async () => {
    const runId = 'run-xyz';
    await appendRunLog({
      repoRoot,
      runId,
      entry: { event: 'test.event', detail: 'hello' },
    });
    const text = await readFile(
      runLogPath({ repoRoot, runId }),
      'utf8',
    );
    expect(text).toContain('test.event');
    expect(text).toContain('hello');
  });
});
