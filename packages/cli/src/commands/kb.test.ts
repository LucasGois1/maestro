import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

vi.mock('@maestro/kb', async () => await import('../../../../packages/kb/src/index.ts'));

import { createKBCommand } from './kb.js';

let repoRoot: string;
let stdout: string[];
let stderr: string[];

const io = {
  stdout: (line: string) => stdout.push(line),
  stderr: (line: string) => stderr.push(line),
};

async function run(args: string[]): Promise<void> {
  const program = createKBCommand({
    io,
    cwd: () => repoRoot,
  });
  program.exitOverride();
  await program.parseAsync(args, { from: 'user' });
}

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-cli-kb-'));
  stdout = [];
  stderr = [];
  process.exitCode = 0;
});

afterEach(async () => {
  process.exitCode = 0;
  await rm(repoRoot, { recursive: true, force: true });
});

describe('maestro kb', () => {
  it('lint exits with 1 when the KB is invalid', async () => {
    await run(['lint']);

    expect(process.exitCode).toBe(1);
    expect(stderr.join('\n')).toMatch(/missing/i);
  });

  it('lint --fix repairs a partial architecture document', async () => {
    await mkdir(join(repoRoot, '.maestro'), { recursive: true });
    await writeFile(
      join(repoRoot, '.maestro', 'ARCHITECTURE.md'),
      '# ARCHITECTURE\n\n## Bird\'s Eye View\n',
      'utf8',
    );
    await writeFile(join(repoRoot, '.maestro', 'AGENTS.md'), '# AGENTS\n', 'utf8');

    await run(['lint', '--fix']);

    expect(process.exitCode).toBe(0);
    const architecture = await readFile(
      join(repoRoot, '.maestro', 'ARCHITECTURE.md'),
      'utf8',
    );
    expect(architecture).toContain('## Code Map');
    expect(stdout.join('\n')).toMatch(/fixed/i);
  });
});
