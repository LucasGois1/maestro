import { describe, expect, it } from 'vitest';

import type { ArchitectModelOutput } from './architect-output.schema.js';
import {
  architectNotesForPlanEmbed,
  renderArchitectNotesMarkdown,
} from './format-notes.js';

function output(
  overrides: Partial<ArchitectModelOutput> = {},
): ArchitectModelOutput {
  return {
    sprintIdx: 2,
    scopeTecnico: {
      newFiles: [],
      filesToTouch: [],
      testFiles: [],
    },
    patternsToFollow: [],
    libraries: [],
    boundaryCheck: 'ok',
    boundaryNotes: null,
    escalation: null,
    ...overrides,
  };
}

describe('renderArchitectNotesMarkdown', () => {
  it('renders empty sections explicitly', () => {
    const markdown = renderArchitectNotesMarkdown(output(), 'Testing');

    expect(markdown).toContain('# Design notes — Sprint 2 — Testing');
    expect(markdown).toContain('- _(nenhum)_');
    expect(markdown).toContain('**Estado:** `ok`');
  });

  it('renders file lists, libraries, boundary notes, and escalation', () => {
    const markdown = renderArchitectNotesMarkdown(
      output({
        scopeTecnico: {
          newFiles: [{ path: 'src/new.ts', layer: 'domain' }],
          filesToTouch: ['src/existing.ts'],
          testFiles: ['src/new.test.ts'],
        },
        patternsToFollow: ['Keep adapters thin'],
        libraries: [{ name: 'zod', reason: 'schema validation' }],
        boundaryCheck: 'violation',
        boundaryNotes: 'Crosses package boundary',
        escalation: { reason: 'Needs product decision' },
      }),
      'Tools',
    );

    expect(markdown).toContain('`src/new.ts` (domain)');
    expect(markdown).toContain('Keep adapters thin');
    expect(markdown).toContain('**zod** — schema validation');
    expect(markdown).toContain('Crosses package boundary');
    expect(markdown).toContain('**Escalação:** Needs product decision');
  });
});

describe('architectNotesForPlanEmbed', () => {
  it('drops the H1 and wraps the notes for plan.md', () => {
    const markdown = architectNotesForPlanEmbed(output(), 'Testing');

    expect(markdown).toMatch(/^### Architect notes/u);
    expect(markdown).not.toContain('# Design notes');
  });
});
