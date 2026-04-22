import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it } from 'vitest';

import { renderSelfEvalMarkdown, writeSprintSelfEval } from './self-eval.js';

describe('renderSelfEvalMarkdown', () => {
  it('renders criteria and concerns', () => {
    const md = renderSelfEvalMarkdown({
      coversAllCriteria: false,
      missingCriteria: ['Test X'],
      concerns: ['Risk Y'],
    });
    expect(md).toContain('**Covers all criteria:** no');
    expect(md).toContain('Test X');
    expect(md).toContain('Risk Y');
  });

  it('renders a compact passing evaluation when no lists are present', () => {
    expect(
      renderSelfEvalMarkdown({
        coversAllCriteria: true,
        missingCriteria: [],
        concerns: [],
      }),
    ).toBe('# Self-evaluation\n\n**Covers all criteria:** yes\n');
  });

  it('writes the self-eval markdown for a sprint', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'maestro-self-eval-'));

    const path = await writeSprintSelfEval({
      repoRoot,
      runId: 'run-1',
      sprint: 2,
      selfEval: {
        coversAllCriteria: false,
        missingCriteria: ['Replay fixture missing'],
        concerns: [],
      },
    });

    expect(path).toBe(
      join(
        repoRoot,
        '.maestro',
        'runs',
        'run-1',
        'checkpoints',
        'sprint-2-self-eval.md',
      ),
    );
    await expect(readFile(path, 'utf8')).resolves.toContain(
      'Replay fixture missing',
    );
  });
});
