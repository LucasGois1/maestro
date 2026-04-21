import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  applyGreenfieldTemplate,
  GREENFIELD_TEMPLATE_IDS,
  resolveTemplateDirectory,
} from './greenfield.js';

describe('greenfield templates', () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'maestro-gf-'));
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it.each([...GREENFIELD_TEMPLATE_IDS])(
    'applies template %s with expected KB files',
    async (templateId) => {
      await applyGreenfieldTemplate(repoRoot, templateId);

      const agents = await readFile(
        join(repoRoot, '.maestro', 'AGENTS.md'),
        'utf8',
      );
      const arch = await readFile(
        join(repoRoot, '.maestro', 'ARCHITECTURE.md'),
        'utf8',
      );
      const sensors = await readFile(
        join(repoRoot, '.maestro', 'sensors.json'),
        'utf8',
      );

      expect(agents).toContain('# AGENTS');
      expect(arch).toContain('# ARCHITECTURE');
      expect(sensors).toContain('"sensors"');
    },
  );

  it('resolves an on-disk directory for every canonical id', async () => {
    for (const id of GREENFIELD_TEMPLATE_IDS) {
      const dir = resolveTemplateDirectory(id);
      await expect(access(dir)).resolves.toBeUndefined();
    }
  });
});
