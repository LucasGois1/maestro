import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  renderHandoffMarkdown,
  writeHandoff,
  type HandoffArtifact,
} from './handoff.js';

let repoRoot: string;

const handoff: HandoffArtifact = {
  sprint: 2,
  summary: 'Implemented JWT signing and verification.',
  changedFiles: ['app/auth/jwt.py', 'tests/test_jwt.py'],
  decisions: ['Split sign/verify into two modules'],
  nextSteps: ['Add refresh token flow'],
  logReferences: ['logs/generator-sprint-2.jsonl'],
};

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-handoff-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('renderHandoffMarkdown', () => {
  it('produces a structured markdown document', () => {
    const md = renderHandoffMarkdown(handoff);
    expect(md).toContain('# Sprint 2 — Handoff');
    expect(md).toContain('## Summary');
    expect(md).toContain('## Key decisions');
    expect(md).toContain('## Changed files');
    expect(md).toContain('## Next steps');
    expect(md).toContain('## Log references');
    expect(md).toContain('`app/auth/jwt.py`');
  });

  it('skips empty sections', () => {
    const md = renderHandoffMarkdown({
      sprint: 1,
      summary: 'Minimal.',
      changedFiles: [],
      decisions: [],
      nextSteps: [],
    });
    expect(md).not.toContain('## Key decisions');
    expect(md).not.toContain('## Changed files');
    expect(md).not.toContain('## Next steps');
  });
});

describe('writeHandoff', () => {
  it('writes to .maestro/runs/<id>/checkpoints/sprint-N-handoff.md', async () => {
    const path = await writeHandoff({
      repoRoot,
      runId: 'run-1',
      handoff,
    });
    expect(path).toContain(
      join('runs', 'run-1', 'checkpoints', 'sprint-2-handoff.md'),
    );
    const contents = await readFile(path, 'utf8');
    expect(contents).toContain('# Sprint 2 — Handoff');
  });
});
