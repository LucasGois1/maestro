import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  appendArchitectNotesToPlanMarkdown,
  loadArchitectureDocument,
  patchPlanFileWithArchitectNotes,
  writeDesignNotesSprintFile,
} from './plan-architect-notes.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-plan-notes-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('loadArchitectureDocument', () => {
  it('prefers a non-empty override', async () => {
    await expect(
      loadArchitectureDocument(repoRoot, '  # Override\n  '),
    ).resolves.toBe('  # Override\n  ');
  });

  it('reads ARCHITECTURE.md from the maestro directory', async () => {
    await mkdir(join(repoRoot, '.custom-maestro'), { recursive: true });
    await writeFile(
      join(repoRoot, '.custom-maestro', 'ARCHITECTURE.md'),
      '# Architecture\n',
      'utf8',
    );

    await expect(
      loadArchitectureDocument(repoRoot, undefined, '.custom-maestro'),
    ).resolves.toBe('# Architecture\n');
  });

  it('throws when no architecture document is available', async () => {
    await expect(loadArchitectureDocument(repoRoot, undefined)).rejects.toThrow(
      'Cannot read ARCHITECTURE.md',
    );
  });
});

describe('appendArchitectNotesToPlanMarkdown', () => {
  const plan = [
    '# Plan',
    '',
    '### Sprint 1 — First',
    '',
    'Body 1',
    '',
    '### Sprint 2 — Second',
    '',
    'Body 2',
    '',
  ].join('\n');

  it('inserts notes under the requested sprint', () => {
    const next = appendArchitectNotesToPlanMarkdown(
      plan,
      1,
      '### Architect notes\n\nNotes',
    );

    expect(next).toContain('Body 1\n\n### Architect notes\n\nNotes');
    expect(next).toContain('### Sprint 2 — Second');
  });

  it('replaces existing notes and throws when the sprint is missing', () => {
    const withNotes = appendArchitectNotesToPlanMarkdown(
      plan,
      2,
      '### Architect notes\n\nOld',
    );

    expect(
      appendArchitectNotesToPlanMarkdown(
        withNotes,
        2,
        '### Architect notes\n\nNew',
      ),
    ).not.toContain('Old');
    expect(() =>
      appendArchitectNotesToPlanMarkdown(plan, 9, '### Architect notes\n\nx'),
    ).toThrow('Could not find "### Sprint 9"');
  });
});

describe('plan file helpers', () => {
  it('patches plan.md and writes sprint design notes', async () => {
    const runDir = join(repoRoot, '.maestro', 'runs', 'run-1');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      join(runDir, 'plan.md'),
      '### Sprint 1 — First\n\nBody\n',
      'utf8',
    );

    await patchPlanFileWithArchitectNotes(
      repoRoot,
      'run-1',
      1,
      '### Architect notes\n\nPatched',
    );
    await writeDesignNotesSprintFile(repoRoot, 'run-1', 1, '# Notes\n');

    await expect(readFile(join(runDir, 'plan.md'), 'utf8')).resolves.toContain(
      'Patched',
    );
    await expect(
      readFile(
        join(runDir, 'design-notes', 'design-notes-sprint-1.md'),
        'utf8',
      ),
    ).resolves.toBe('# Notes\n');
  });
});
