import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { lintKnowledgeBase } from './lint.js';
import { createKBManager } from './manager.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-kb-lint-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('lintKnowledgeBase', () => {
  it('reports broken links, duplicate sections, and missing architecture sections', async () => {
    const kb = createKBManager({ repoRoot });
    await kb.init();

    await writeFile(
      join(repoRoot, '.maestro', 'AGENTS.md'),
      [
        '# AGENTS',
        '',
        '## Repo Map',
        '[Broken](./docs/missing.md)',
        '## Repo Map',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      join(repoRoot, '.maestro', 'ARCHITECTURE.md'),
      ['# ARCHITECTURE', '', "## Bird's Eye View", 'Text'].join('\n'),
      'utf8',
    );

    const report = await lintKnowledgeBase({ repoRoot });

    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.rule === 'broken-link')).toBe(
      true,
    );
    expect(
      report.issues.some((issue) => issue.rule === 'duplicate-section'),
    ).toBe(true);
    expect(
      report.issues.some((issue) => issue.rule === 'missing-section'),
    ).toBe(true);
  });

  it('reports missing AGENTS.md sections', async () => {
    const kb = createKBManager({ repoRoot });
    await kb.init();

    await writeFile(
      join(repoRoot, '.maestro', 'AGENTS.md'),
      ['# AGENTS', '', '## Header', 'x'].join('\n'),
      'utf8',
    );

    const report = await lintKnowledgeBase({ repoRoot });

    expect(report.ok).toBe(false);
    expect(
      report.issues.some(
        (issue) =>
          issue.rule === 'missing-section' &&
          issue.file === '.maestro/AGENTS.md',
      ),
    ).toBe(true);
  });

  it('fix mode appends missing AGENTS sections', async () => {
    const kb = createKBManager({ repoRoot });
    await kb.init();

    await writeFile(
      join(repoRoot, '.maestro', 'AGENTS.md'),
      ['# AGENTS', '', '## Header', 'x'].join('\n'),
      'utf8',
    );
    await writeFile(
      join(repoRoot, '.maestro', 'ARCHITECTURE.md'),
      [
        '# ARCHITECTURE',
        '',
        "## Bird's Eye View",
        'ok',
        '## Code Map',
        'ok',
        '## Cross-Cutting Concerns',
        'ok',
        '## Module Boundaries',
        'ok',
        '## Data Flow',
        'ok',
      ].join('\n'),
      'utf8',
    );

    const fixed = await lintKnowledgeBase({ repoRoot, fix: true });
    const agents = await kb.read('AGENTS.md');

    expect(fixed.fixedFiles).toContain('.maestro/AGENTS.md');
    expect(agents).toContain('## Repo Map');
    expect(agents).toContain('## Escalation Path');

    const clean = await lintKnowledgeBase({ repoRoot });
    expect(clean.ok).toBe(true);
  });

  it('fix mode appends missing architecture sections and leaves valid docs passing', async () => {
    const kb = createKBManager({ repoRoot });
    await kb.init();

    await writeFile(
      join(repoRoot, '.maestro', 'ARCHITECTURE.md'),
      ['# ARCHITECTURE', '', "## Bird's Eye View", 'Text'].join('\n'),
      'utf8',
    );

    const fixed = await lintKnowledgeBase({ repoRoot, fix: true });
    const architecture = await kb.read('ARCHITECTURE.md');

    expect(fixed.fixedFiles).toContain('.maestro/ARCHITECTURE.md');
    expect(architecture).toContain('## Code Map');
    expect(architecture).toContain('## Module Boundaries');

    const clean = await lintKnowledgeBase({ repoRoot });
    expect(clean.ok).toBe(true);
  });

  it('flags AGENTS.md when it exceeds the line budget', async () => {
    const kb = createKBManager({ repoRoot });
    await kb.init();

    const base = await kb.read('AGENTS.md');
    const padding = Array.from(
      { length: 151 },
      (_, index) => `pad ${index + 1}`,
    ).join('\n');
    await writeFile(
      join(repoRoot, '.maestro', 'AGENTS.md'),
      `${base}\n${padding}\n`,
      'utf8',
    );

    const report = await lintKnowledgeBase({ repoRoot });
    expect(report.issues).toEqual([
      expect.objectContaining({
        rule: 'agents-line-budget',
      }),
    ]);
  });
});
