import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { writeCompletedExecPlan } from './exec-plan.js';

describe('writeCompletedExecPlan', () => {
  it('writes a completed exec plan and returns its repo-relative path', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'maestro-exec-plan-'));

    const result = await writeCompletedExecPlan({
      repoRoot,
      fileName: 'auth-flow.md',
      markdown: '# Auth flow\n',
    });

    expect(result.relativePathPosix).toBe(
      '.maestro/docs/exec-plans/completed/auth-flow.md',
    );
    await expect(
      readFile(
        join(
          repoRoot,
          '.maestro',
          'docs',
          'exec-plans',
          'completed',
          'auth-flow.md',
        ),
        'utf8',
      ),
    ).resolves.toBe('# Auth flow\n');
  });
});
