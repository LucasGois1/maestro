import type { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { editSprintContract, resolveEditorCommand } from './editor.js';

type SpawnFn = typeof spawn;

let dir: string;
let filePath: string;

const SOURCE = `---
sprint: 1
feature: Demo
status: negotiating
acceptance_criteria:
  - id: a1
    description: first
    verifier: pytest
negotiated_by:
  - architect
---

# body
`;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'maestro-editor-'));
  filePath = join(dir, 'contract.md');
  await writeFile(filePath, SOURCE, 'utf8');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('resolveEditorCommand', () => {
  it('prefers MAESTRO_EDITOR', () => {
    expect(
      resolveEditorCommand({
        MAESTRO_EDITOR: 'code --wait',
        VISUAL: 'nano',
        EDITOR: 'vi',
      }),
    ).toBe('code --wait');
  });

  it('falls back to VISUAL then EDITOR', () => {
    expect(resolveEditorCommand({ VISUAL: 'nano', EDITOR: 'vi' })).toBe('nano');
    expect(resolveEditorCommand({ EDITOR: 'vi' })).toBe('vi');
  });

  it('uses vi as the default on POSIX', () => {
    expect(resolveEditorCommand({})).toBe(
      process.platform === 'win32' ? 'notepad' : 'vi',
    );
  });
});

describe('editSprintContract', () => {
  it('appends "human" to negotiated_by after a successful edit', async () => {
    const fakeChild = new EventEmitter() as EventEmitter & {
      kill?: () => void;
    };
    const fakeSpawn = (() => {
      setImmediate(() => fakeChild.emit('exit', 0));
      return fakeChild;
    }) as unknown as SpawnFn;

    const result = await editSprintContract({
      filePath,
      env: { EDITOR: 'true' },
      stdio: 'ignore',
      spawnImpl: fakeSpawn,
    });

    expect(result.frontmatter.negotiated_by).toContain('human');
    const persisted = await readFile(filePath, 'utf8');
    expect(persisted).toMatch(/- human/);
  });

  it('propagates a non-zero exit as EditorLaunchError', async () => {
    const fakeChild = new EventEmitter();
    const fakeSpawn = (() => {
      setImmediate(() => fakeChild.emit('exit', 2));
      return fakeChild;
    }) as unknown as SpawnFn;

    await expect(
      editSprintContract({
        filePath,
        env: { EDITOR: 'true' },
        stdio: 'ignore',
        spawnImpl: fakeSpawn,
      }),
    ).rejects.toThrow(/Editor exited/);
  });
});
