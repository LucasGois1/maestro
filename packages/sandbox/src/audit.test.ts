import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { appendAudit, auditFilePath } from './audit.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-sandbox-audit-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('appendAudit', () => {
  it('writes jsonl audit entries under a custom maestro directory', async () => {
    await appendAudit({
      repoRoot,
      runId: 'run-1',
      maestroDir: '.custom-maestro',
      entry: {
        ts: '2026-04-22T00:00:00.000Z',
        agentId: 'generator',
        cmd: 'pnpm',
        args: ['test'],
        cwd: repoRoot,
        approvedBy: 'allowlist',
        exitCode: 0,
        durationMs: 12,
      },
    });

    const path = auditFilePath({
      repoRoot,
      runId: 'run-1',
      maestroDir: '.custom-maestro',
    });
    const [line] = (await readFile(path, 'utf8')).trim().split('\n');
    expect(JSON.parse(line ?? '{}')).toMatchObject({
      ts: '2026-04-22T00:00:00.000Z',
      runId: 'run-1',
      agentId: 'generator',
      cmd: 'pnpm',
      approvedBy: 'allowlist',
    });
  });
});
