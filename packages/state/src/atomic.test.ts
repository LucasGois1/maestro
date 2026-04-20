import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeAtomic, writeAtomicJson } from './atomic.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'maestro-atomic-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('writeAtomic', () => {
  it('creates nested directories', async () => {
    const target = join(dir, 'a', 'b', 'file.txt');
    await writeAtomic(target, 'hello');
    expect(await readFile(target, 'utf8')).toBe('hello');
  });

  it('does not leave .tmp files behind', async () => {
    const target = join(dir, 'file.txt');
    await writeAtomic(target, 'x');
    const entries = await readdir(dir);
    expect(entries.filter((e) => e.endsWith('.tmp'))).toHaveLength(0);
  });

  it('overwrites existing files', async () => {
    const target = join(dir, 'file.txt');
    await writeAtomic(target, 'one');
    await writeAtomic(target, 'two');
    expect(await readFile(target, 'utf8')).toBe('two');
  });
});

describe('writeAtomicJson', () => {
  it('serializes with 2-space indent and trailing newline', async () => {
    const target = join(dir, 'data.json');
    await writeAtomicJson(target, { hello: 'world' });
    expect(await readFile(target, 'utf8')).toBe('{\n  "hello": "world"\n}\n');
  });
});
