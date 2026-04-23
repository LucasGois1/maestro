import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { createKBManager } from '@maestro/kb';
import { z } from 'zod';

import { tool, type ToolSet } from 'ai';

import { resolvePathUnderRepo } from './planner/safe-repo-path.js';

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
  query: z
    .string()
    .min(1)
    .describe('Literal search string (passed to ripgrep).'),
  maxLines: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('Cap on matching lines returned (default 40).'),
});

const readFileToolInput = z.object({
  path: z
    .string()
    .min(1)
    .describe(
      'File path relative to repository root (any text file; large files truncated).',
    ),
});

export async function readRepoFileContent(
  repoRoot: string,
  rel: string,
): Promise<string> {
  const abs = resolvePathUnderRepo(repoRoot, rel);
  const buf = await readFile(abs);
  const text = buf.toString('utf8');
  if (text.length > 120_000) {
    return `${text.slice(0, 120_000)}\n…(truncado)`;
  }
  return text;
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
    const err = e as {
      code?: number | string;
      stderr?: string;
      message?: string;
    };
    if (err.code === 1) {
      return 'Sem resultados.';
    }
    if (err.code === 'ENOENT') {
      return 'Ripgrep (rg) não está instalado; instala para pesquisa no código.';
    }
    return `Erro na pesquisa: ${err.stderr ?? err.message ?? String(e)}`;
  }
}

/** Resume manifests under repo root for the Architect. */
export async function summarizeDependencies(repoRoot: string): Promise<string> {
  const chunks: string[] = [];

  try {
    const raw = await readFile(join(repoRoot, 'package.json'), 'utf8');
    const j = JSON.parse(raw) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const name = j.name ?? 'root';
    const depKeys = j.dependencies ? Object.keys(j.dependencies) : [];
    const devKeys = j.devDependencies ? Object.keys(j.devDependencies) : [];
    chunks.push(
      [
        `package.json (${name})`,
        depKeys.length > 0
          ? `dependencies: ${depKeys.slice(0, 45).join(', ')}${depKeys.length > 45 ? '…' : ''}`
          : 'dependencies: (nenhuma)',
        devKeys.length > 0
          ? `devDependencies: ${devKeys.slice(0, 30).join(', ')}${devKeys.length > 30 ? '…' : ''}`
          : '',
      ]
        .filter((l) => l.length > 0)
        .join('\n'),
    );
  } catch {
    // skip
  }

  try {
    const g = await readFile(join(repoRoot, 'go.mod'), 'utf8');
    chunks.push(`go.mod (excerpt):\n${g.split('\n').slice(0, 35).join('\n')}`);
  } catch {
    // skip
  }

  try {
    const c = await readFile(join(repoRoot, 'Cargo.toml'), 'utf8');
    chunks.push(
      `Cargo.toml (excerpt):\n${c.split('\n').slice(0, 45).join('\n')}`,
    );
  } catch {
    // skip
  }

  try {
    const p = await readFile(join(repoRoot, 'pyproject.toml'), 'utf8');
    chunks.push(
      `pyproject.toml (excerpt):\n${p.split('\n').slice(0, 45).join('\n')}`,
    );
  } catch {
    // skip
  }

  if (chunks.length === 0) {
    return 'Nenhum manifesto encontrado (package.json, go.mod, Cargo.toml, pyproject.toml).';
  }
  return chunks.join('\n\n');
}

/**
 * Tools shared with the Planner: KB/docs read, directory listing, ripgrep search.
 *
 * @param workspaceRoot — Raiz para `docs/`, listagem e ripgrep (ex.: worktree).
 * @param kbRepoRoot — Checkout onde vive `.maestro/` para a KB (default = workspaceRoot).
 */
export function createPlannerToolSet(
  workspaceRoot: string,
  kbRepoRoot: string = workspaceRoot,
): ToolSet {
  const kb = createKBManager({ repoRoot: kbRepoRoot });

  const readKB = tool({
    description:
      'Lê um ficheiro Markdown da KB Maestro (.maestro/) ou de docs/ na raiz do repositório.',
    inputSchema: readKBInput,
    execute: async ({ path: p }) => {
      const norm = p.trim().replace(/^[/\\]+/u, '');
      try {
        if (norm.startsWith('docs/') || norm.startsWith('docs\\')) {
          return await readRepoFileContent(
            workspaceRoot,
            norm.replace(/\\/gu, '/'),
          );
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
        const base = resolvePathUnderRepo(workspaceRoot, relNorm);
        const out: string[] = [];
        await listDirRecursive(base, relNorm, maxDepth, 0, out);
        out.sort((a, b) => a.localeCompare(b));
        const lines = out.slice(0, 400);
        const suffix =
          out.length > 400
            ? `\n… (${out.length.toString()} ficheiros, truncado)`
            : '';
        return lines.length > 0 ? `${lines.join('\n')}${suffix}` : '(vazio)';
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
      return searchWithRipgrep(workspaceRoot, query, maxLines);
    },
  });

  return { readKB, listDirectory, searchCode } as ToolSet;
}

/**
 * Planner tools plus readFile (repo-relative) and dependency summary.
 *
 * @param workspaceRoot — Código e manifests (ex.: worktree).
 * @param kbRepoRoot — KB `.maestro/` (default = workspaceRoot).
 */
export function createArchitectToolSet(
  workspaceRoot: string,
  kbRepoRoot: string = workspaceRoot,
): ToolSet {
  const base = createPlannerToolSet(workspaceRoot, kbRepoRoot);

  const readFile = tool({
    description:
      'Lê um ficheiro de texto sob a raiz do repositório (caminho relativo).',
    inputSchema: readFileToolInput,
    execute: async ({ path: p }) => {
      const norm = p.trim().replace(/^[/\\]+/u, '');
      try {
        return await readRepoFileContent(
          workspaceRoot,
          norm.replace(/\\/gu, '/'),
        );
      } catch (e) {
        return `Erro ao ler: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const getDependencies = tool({
    description:
      'Resume dependências declaradas (package.json, go.mod, Cargo.toml, pyproject.toml).',
    inputSchema: z.object({}),
    execute: async () => summarizeDependencies(workspaceRoot),
  });

  return { ...base, readFile, getDependencies } as ToolSet;
}

/**
 * Read-only repo tools for the sensor-setup agent (`maestro init`): discover build/test
 * commands from manifests, Makefiles, CI, etc. No shell execution.
 */
export function createSensorSetupToolSet(repoRoot: string): ToolSet {
  const listDirectory = tool({
    description:
      'List files under a path relative to the repository root (limited depth; skips node_modules, .git, dist).',
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
        const suffix =
          out.length > 400
            ? `\n… (${out.length.toString()} files, truncated)`
            : '';
        return lines.length > 0 ? `${lines.join('\n')}${suffix}` : '(empty)';
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const readFile = tool({
    description:
      'Read a text file under the repository root (relative path; large files truncated).',
    inputSchema: readFileToolInput,
    execute: async ({ path: p }) => {
      const norm = p.trim().replace(/^[/\\]+/u, '');
      try {
        return await readRepoFileContent(
          repoRoot,
          norm.replace(/\\/gu, '/'),
        );
      } catch (e) {
        return `Error reading file: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const searchCode = tool({
    description:
      'Literal code search with ripgrep (rg) from the repository root.',
    inputSchema: searchCodeInput,
    execute: async ({ query, maxLines: ml }) => {
      const maxLines = ml ?? 40;
      return searchWithRipgrep(repoRoot, query, maxLines);
    },
  });

  const getDependencies = tool({
    description:
      'Summarize declared dependencies (package.json, go.mod, Cargo.toml, pyproject.toml).',
    inputSchema: z.object({}),
    execute: async () => summarizeDependencies(repoRoot),
  });

  return { listDirectory, readFile, searchCode, getDependencies } as ToolSet;
}
