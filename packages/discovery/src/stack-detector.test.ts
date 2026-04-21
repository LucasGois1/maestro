import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectStack } from './stack-detector.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'maestro-disc-stack-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('detectStack', () => {
  it('detects Go from go.mod', async () => {
    await writeFile(join(root, 'go.mod'), 'module example.com/foo\n', 'utf8');
    const r = await detectStack(root);
    expect(r.kind).toBe('go');
    expect(r.markers).toContain('go.mod');
  });

  it('detects Rust from Cargo.toml', async () => {
    await writeFile(
      join(root, 'Cargo.toml'),
      '[package]\nname = "x"\nversion = "0.1.0"\n',
      'utf8',
    );
    const r = await detectStack(root);
    expect(r.kind).toBe('rust');
    expect(r.markers).toContain('Cargo.toml');
  });

  it('detects Java from pom.xml', async () => {
    await writeFile(join(root, 'pom.xml'), '<project></project>\n', 'utf8');
    const r = await detectStack(root);
    expect(r.kind).toBe('java');
    expect(r.markers).toContain('pom.xml');
  });

  it('detects Ruby from Gemfile', async () => {
    await writeFile(join(root, 'Gemfile'), "source 'https://rubygems.org'\n", 'utf8');
    const r = await detectStack(root);
    expect(r.kind).toBe('ruby');
    expect(r.markers).toContain('Gemfile');
  });

  it('detects Python from pyproject.toml', async () => {
    await writeFile(
      join(root, 'pyproject.toml'),
      '[project]\nname = "x"\ndependencies = ["fastapi"]\n',
      'utf8',
    );
    const r = await detectStack(root);
    expect(r.kind).toBe('python');
    expect(r.markers).toContain('pyproject.toml');
    expect(r.hints.framework).toBe('fastapi');
  });

  it('detects Node from package.json', async () => {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'x', version: '1.0.0' }),
      'utf8',
    );
    const r = await detectStack(root);
    expect(r.kind).toBe('node');
    expect(r.markers).toContain('package.json');
  });

  it('detects Node+TS when typescript is a devDependency', async () => {
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'x',
        devDependencies: { typescript: '^5.0.0' },
      }),
      'utf8',
    );
    const r = await detectStack(root);
    expect(r.kind).toBe('node-ts');
  });

  it('prefers go.mod over package.json when both exist', async () => {
    await writeFile(join(root, 'go.mod'), 'module x\n', 'utf8');
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'x' }),
      'utf8',
    );
    const r = await detectStack(root);
    expect(r.kind).toBe('go');
  });

  it('returns unknown when no markers', async () => {
    await writeFile(join(root, 'README.md'), '# hi\n', 'utf8');
    const r = await detectStack(root);
    expect(r.kind).toBe('unknown');
    expect(r.markers).toHaveLength(0);
  });
});
