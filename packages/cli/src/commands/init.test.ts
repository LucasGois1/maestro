import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

vi.mock(
  '@maestro/kb',
  async () => await import('../../../../packages/kb/src/index.ts'),
);

import { lintKnowledgeBase } from '@maestro/kb';

import { createInitCommand } from './init.js';

let repoRoot: string;
let stdout: string[];

const io = {
  stdout: (line: string) => stdout.push(line),
  stderr: (line: string) => {
    throw new Error(`unexpected stderr: ${line}`);
  },
};

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-cli-init-'));
  stdout = [];
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('maestro init', () => {
  it('creates .maestro scaffold and passes kb lint', async () => {
    const program = new Command('maestro');
    program.addCommand(
      createInitCommand({
        io,
        cwd: () => repoRoot,
      }),
    );
    program.exitOverride();
    await program.parseAsync(['init', '--no-ai'], { from: 'user' });

    expect(stdout.some((line) => line.includes('computational stack'))).toBe(
      true,
    );

    await readFile(join(repoRoot, '.maestro', 'config.json'), 'utf8');
    await readFile(join(repoRoot, '.maestro', 'AGENTS.md'), 'utf8');

    const log = await readFile(join(repoRoot, '.maestro', 'log.md'), 'utf8');
    expect(log).toContain('project.initialized');

    const report = await lintKnowledgeBase({ repoRoot });
    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
  });
});
