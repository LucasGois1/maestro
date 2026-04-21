import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';

import { createKBManager } from '@maestro/kb';
import { join } from 'node:path';
import { z } from 'zod';

import { tool, type ToolSet } from 'ai';

import { resolvePathUnderRepo } from './safe-repo-path.js';

const execFileAsync = promisify(execFile);

const readKBInput = z.object({
  path: z
    .string()
    .min(1)
    .describe(
      'Relative path: Maestro KB file (e.g. AGENTS.md) or docs/... under the repo root.',
    ),
});

const listDirectoryInput = z.object({
  relativePath: z
    .string()
    .optional()
    .describe('Directory relative to repo root; default "" = root.'),
  maxDepth: z
    .number()
    .int()
    .min(0)
    .max(6)
    .optional()
    .describe('Max recursion depth from that directory (default 3).'),
});

const searchCodeInput = z.object({
  query: z.string().min(1).describe('Literal search string (passed to ripgrep).'),
  maxLines: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('Cap on matching lines returned (default 40).'),
});

async function readRepoFile(repoRoot: string, rel: string): Promise<string> {
  const abs = resolvePathUnderRepo(repoRoot, rel);
  return readFile(abs, 'utf8');
}

async function listDirRecursive(
  baseAbs: string,
  relPrefix: string,
  maxDepth: number,
  depth: number,
  out: string[],
): Promise<void> {
  if (depth > maxDepth) return;
  let entries;
  try {
    entries = await readdir(baseAbs, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const name = ent.name;
    if (name === 'node_modules' || name === '.git' || name === 'dist') {
      continue;
    }
    const childRel = relPrefix ? `${relPrefix}/${name}` : name;
    if (ent.isDirectory()) {
      await listDirRecursive(
        join(baseAbs, name),
        childRel,
        maxDepth,
        depth + 1,
        out,
      );
    } else {
      out.push(childRel.replace(/\\/gu, '/'));
    }
  }
}

async function searchWithRipgrep(
  repoRoot: string,
  query: string,
  maxLines: number,
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'rg',
      [
        '--line-number',
        '--max-count',
        String(maxLines),
        '--max-filesize',
        '1M',
        '--',
        query,
        '.',
      ],
      {
        cwd: repoRoot,
        timeout: 15_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    const t = stdout.trim();
    return t.length > 0 ? t.slice(0, 12_000) : 'Sem resultados.';
  } catch (e: unknown) {
    const err = e as { code?: number | string; stderr?: string; message?: string };
    if (err.code === 1) {
      return 'Sem resultados.';
    }
    if (err.code === 'ENOENT') {
      return 'Ripgrep (rg) não está instalado; instala para pesquisa no código.';
    }
    return `Erro na pesquisa: ${err.stderr ?? err.message ?? String(e)}`;
  }
}

/**
 * AI SDK tools for the Planner: KB/docs read, directory listing, ripgrep search.
 */
export function createPlannerToolSet(repoRoot: string): ToolSet {
  const kb = createKBManager({ repoRoot });

  const readKB = tool({
    description:
      'Lê um ficheiro Markdown da KB Maestro (.maestro/) ou de docs/ na raiz do repositório.',
    inputSchema: readKBInput,
    execute: async ({ path: p }) => {
      const norm = p.trim().replace(/^[/\\]+/u, '');
      try {
        if (norm.startsWith('docs/') || norm.startsWith('docs\\')) {
          return await readRepoFile(repoRoot, norm.replace(/\\/gu, '/'));
        }
        return await kb.read(norm.replace(/\\/gu, '/'));
      } catch (e) {
        return `Erro ao ler: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const listDirectory = tool({
    description:
      'Lista ficheiros sob um diretório da raiz do repo (profundidade limitada; ignora node_modules/.git).',
    inputSchema: listDirectoryInput,
    execute: async ({ relativePath: rel, maxDepth: md }) => {
      const relNorm = (rel ?? '').trim().replace(/^[/\\]+/u, '');
      const maxDepth = md ?? 3;
      try {
        const base = resolvePathUnderRepo(repoRoot, relNorm);
        const out: string[] = [];
        await listDirRecursive(base, relNorm, maxDepth, 0, out);
        out.sort((a, b) => a.localeCompare(b));
        const lines = out.slice(0, 400);
        const suffix = out.length > 400 ? `\n… (${out.length.toString()} ficheiros, truncado)` : '';
        return lines.length > 0
          ? `${lines.join('\n')}${suffix}`
          : '(vazio)';
      } catch (e) {
        return `Erro: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const searchCode = tool({
    description:
      'Pesquisa literal no código com ripgrep (rg) a partir da raiz do repositório.',
    inputSchema: searchCodeInput,
    execute: async ({ query, maxLines: ml }) => {
      const maxLines = ml ?? 40;
      return searchWithRipgrep(repoRoot, query, maxLines);
    },
  });

  return { readKB, listDirectory, searchCode } as ToolSet;
}
