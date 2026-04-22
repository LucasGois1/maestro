import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

import type { StructuralSummary } from './types.js';

const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'target',
  'venv',
  '.venv',
  '__pycache__',
  '.turbo',
  'coverage',
  '.maestro',
]);

const MAX_FILES = 8000;
const MAX_DEPTH = 4;

const TEST_DIR_NAMES = new Set([
  'tests',
  'test',
  '__tests__',
  'spec',
  'specs',
  'e2e',
]);

function extKey(path: string): string {
  const base = path.split('/').pop() ?? path;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) {
    return '';
  }
  return base.slice(dot).toLowerCase();
}

export async function analyzeStructure(
  repoRoot: string,
): Promise<StructuralSummary> {
  const topLevelNames: string[] = [];
  const extensionCounts: Record<string, number> = {};
  const testDirectoryHints: string[] = [];
  let approxFileCount = 0;

  try {
    const entries = await readdir(repoRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') {
        continue;
      }
      /** Omit vendor/build trees from the human-facing top-level list (still skipped in walk). */
      if (SKIP_DIR_NAMES.has(entry.name)) {
        continue;
      }
      topLevelNames.push(entry.name);
      if (entry.isDirectory() && TEST_DIR_NAMES.has(entry.name)) {
        testDirectoryHints.push(entry.name);
      }
    }
  } catch {
    return {
      topLevelNames: [],
      extensionCounts: {},
      testDirectoryHints: [],
      approxFileCount: 0,
    };
  }

  topLevelNames.sort((a, b) => a.localeCompare(b));

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || approxFileCount >= MAX_FILES) {
      return;
    }

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (approxFileCount >= MAX_FILES) {
        return;
      }

      const full = join(dir, entry.name);
      const rel = relative(repoRoot, full);

      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) {
          continue;
        }
        if (
          entry.name === 'test' ||
          entry.name === 'tests' ||
          entry.name === '__tests__'
        ) {
          if (!testDirectoryHints.includes(rel)) {
            testDirectoryHints.push(rel);
          }
        }
        await walk(full, depth + 1);
        continue;
      }

      approxFileCount += 1;
      const ext = extKey(entry.name);
      if (ext) {
        extensionCounts[ext] = (extensionCounts[ext] ?? 0) + 1;
      }
    }
  }

  await walk(repoRoot, 0);

  testDirectoryHints.sort((a, b) => a.localeCompare(b));

  return {
    topLevelNames,
    extensionCounts,
    testDirectoryHints,
    approxFileCount,
  };
}

export async function pathIsDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}
