import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createKBManager } from './manager.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-kb-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('createKBManager', () => {
  it('init creates the expected .maestro structure and default templates', async () => {
    const kb = createKBManager({ repoRoot });

    await kb.init();

    const agents = await readFile(
      join(repoRoot, '.maestro', 'AGENTS.md'),
      'utf8',
    );
    const architecture = await readFile(
      join(repoRoot, '.maestro', 'ARCHITECTURE.md'),
      'utf8',
    );
    const sensors = await readFile(
      join(repoRoot, '.maestro', 'sensors.json'),
      'utf8',
    );

    expect(agents).toContain('# AGENTS');
    expect(architecture).toContain('# ARCHITECTURE');
    expect(sensors).toContain('"sensors"');

    const configRaw = await readFile(
      join(repoRoot, '.maestro', 'config.json'),
      'utf8',
    );
    const config = JSON.parse(configRaw) as { version?: number };
    expect(config.version).toBe(1);
  });

  it('supports read, write, list, and getAgentContext', async () => {
    const kb = createKBManager({ repoRoot });
    await kb.init();

    await kb.write('docs/product-specs/sample.md', '# Sample\n');

    expect(await kb.read('docs/product-specs/sample.md')).toBe('# Sample\n');
    expect(await kb.list('docs/**/*.md')).toContain('docs/product-specs/sample.md');

    const context = await kb.getAgentContext();
    expect(context.agentsMd).toContain('# AGENTS');
    expect(context.architectureMd).toContain('# ARCHITECTURE');
    expect(context.agentsPath).toContain('.maestro/AGENTS.md');
    expect(context.architecturePath).toContain('.maestro/ARCHITECTURE.md');
  });

  it('appendLog writes to the project log', async () => {
    const kb = createKBManager({ repoRoot });
    await kb.init();

    await kb.appendLog({
      event: 'kb.initialized',
      detail: 'Created default templates',
      runId: 'run-1',
      now: new Date('2026-04-20T00:00:00.000Z'),
    });

    const log = await readFile(join(repoRoot, '.maestro', 'log.md'), 'utf8');
    expect(log).toContain('kb.initialized');
    expect(log).toContain('[run-1]');
  });
});
