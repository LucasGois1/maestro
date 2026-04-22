import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import type { ComputationalDiscoveryResult } from './types.js';

export type FileSample = {
  readonly path: string;
  readonly content: string;
};

const MAX_SAMPLES = 10;
const MAX_CHARS_PER_FILE = 6000;

const PREFERRED_ROOT_FILES = new Set([
  'readme.md',
  'readme.rst',
  'package.json',
  'pyproject.toml',
  'go.mod',
  'cargo.toml',
  'pom.xml',
  'gemfile',
]);

async function tryRead(
  relPath: string,
  repoRoot: string,
): Promise<FileSample | null> {
  const full = join(repoRoot, relPath);
  try {
    const content = await readFile(full, 'utf8');
    const trimmed =
      content.length > MAX_CHARS_PER_FILE
        ? `${content.slice(0, MAX_CHARS_PER_FILE)}\n… [truncated]`
        : content;
    return { path: relPath.replaceAll('\\', '/'), content: trimmed };
  } catch {
    return null;
  }
}

async function walkSourceFiles(repoRoot: string, out: string[]): Promise<void> {
  const srcPath = join(repoRoot, 'src');
  try {
    await access(srcPath);
  } catch {
    return;
  }
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4 || out.length >= 64) {
      return;
    }
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        await walk(full, depth + 1);
      } else if (/\.(ts|tsx|js|jsx|py|go|rs|rb|java)$/u.test(entry.name)) {
        out.push(relative(repoRoot, full));
      }
    }
  }
  await walk(srcPath, 0);
}

export type SampleRepositoryFilesOptions = {
  /** When set (e.g. git diff paths), only these paths are sampled first; falls back to full scan if empty. */
  readonly preferPaths?: readonly string[];
};

export async function sampleRepositoryFiles(
  repoRoot: string,
  _computational: ComputationalDiscoveryResult,
  options?: SampleRepositoryFilesOptions,
): Promise<FileSample[]> {
  const prefer = options?.preferPaths?.length
    ? new Set(options.preferPaths.map((p) => p.replaceAll('\\', '/')))
    : undefined;

  if (prefer !== undefined && prefer.size > 0) {
    const samples: FileSample[] = [];
    const sorted = [...prefer].sort((a, b) => a.localeCompare(b));
    for (const rel of sorted) {
      if (samples.length >= MAX_SAMPLES) {
        break;
      }
      const sample = await tryRead(rel, repoRoot);
      if (sample) {
        samples.push(sample);
      }
    }
    if (samples.length > 0) {
      return samples;
    }
  }

  const samples: FileSample[] = [];
  const seen = new Set<string>();
  const ordered: string[] = [];

  const rootEntries = await readdir(repoRoot, { withFileTypes: true }).catch(
    () => [],
  );
  for (const entry of rootEntries) {
    if (!entry.isFile()) {
      continue;
    }
    const lower = entry.name.toLowerCase();
    if (PREFERRED_ROOT_FILES.has(lower)) {
      ordered.push(entry.name);
    }
  }

  const extra: string[] = [];
  await walkSourceFiles(repoRoot, extra);
  extra.sort((a, b) => a.localeCompare(b));
  ordered.push(...extra);

  for (const rel of ordered) {
    if (samples.length >= MAX_SAMPLES) {
      break;
    }
    const key = rel.replaceAll('\\', '/');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const sample = await tryRead(rel, repoRoot);
    if (sample) {
      samples.push(sample);
    }
  }

  return samples;
}
