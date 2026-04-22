import { readFile, stat } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

import { maestroRoot } from '@maestro/state';

export type StaleDocFinding = {
  readonly path: string;
  readonly message: string;
  readonly kind: 'broken_link' | 'agents_too_long';
};

function isExternal(href: string): boolean {
  const t = href.trim();
  return /^(https?:|mailto:|#)/u.test(t);
}

async function pathExists(abs: string): Promise<boolean> {
  try {
    const s = await stat(abs);
    return s.isFile() || s.isDirectory();
  } catch {
    return false;
  }
}

async function checkMarkdownLinks(
  repoRoot: string,
  fileRel: string,
  content: string,
): Promise<StaleDocFinding[]> {
  const out: StaleDocFinding[] = [];
  const dir = dirname(join(repoRoot, fileRel));
  for (const m of content.matchAll(/\[([^\]]*)\]\(([^)]+)\)/gu)) {
    const href = (m[2] ?? '').trim();
    if (href.length === 0 || isExternal(href)) continue;
    const clean = href.split('#')[0] ?? href;
    const target = resolve(dir, clean);
    const rel = relative(repoRoot, target).replace(/\\/gu, '/');
    if (rel.startsWith('..')) continue;
    const ok = await pathExists(join(repoRoot, rel));
    if (!ok) {
      out.push({
        path: fileRel.replace(/\\/gu, '/'),
        message: `Broken link target "${href}" (resolved ${rel})`,
        kind: 'broken_link',
      });
    }
  }
  return out;
}

async function readIfExists(abs: string): Promise<string | null> {
  try {
    return await readFile(abs, 'utf8');
  } catch {
    return null;
  }
}

async function collectMarkdownFiles(
  repoRoot: string,
  maestroDir: string | undefined,
): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const out: string[] = [];
  const mRoot = maestroRoot(repoRoot, maestroDir);
  const agents = join(mRoot, 'AGENTS.md');
  if (await pathExists(agents)) {
    out.push(relative(repoRoot, agents).replace(/\\/gu, '/'));
  }
  const arch = join(repoRoot, 'ARCHITECTURE.md');
  if (await pathExists(arch)) {
    out.push('ARCHITECTURE.md');
  }
  async function walkDocs(relDir: string): Promise<void> {
    const abs = join(repoRoot, relDir);
    let entries: Dirent[];
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const sub = join(relDir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'dist') continue;
        await walkDocs(sub);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        out.push(sub.replace(/\\/gu, '/'));
      }
    }
  }
  await walkDocs('docs');
  return [...new Set(out)];
}

/**
 * Heurísticas determinísticas: links markdown quebrados e AGENTS.md > 150 linhas.
 */
export async function detectStaleDocumentation(
  repoRoot: string,
  maestroDir?: string,
): Promise<readonly StaleDocFinding[]> {
  const findings: StaleDocFinding[] = [];
  const files = await collectMarkdownFiles(repoRoot, maestroDir);
  for (const rel of files) {
    const abs = join(repoRoot, rel);
    const text = await readIfExists(abs);
    if (text === null) continue;
    if (rel.endsWith('AGENTS.md')) {
      const lines = text.split('\n').length;
      if (lines > 150) {
        findings.push({
          path: rel,
          message: `AGENTS.md has ${lines.toString()} lines (> 150 recommended cap)`,
          kind: 'agents_too_long',
        });
      }
    }
    findings.push(...(await checkMarkdownLinks(repoRoot, rel, text)));
  }
  return findings;
}
