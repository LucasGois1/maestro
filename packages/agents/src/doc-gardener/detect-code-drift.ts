import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type CodeDriftFinding = {
  readonly path: string;
  readonly message: string;
  readonly kind: 'duplicate_snippet';
};

function normalizeLines(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//'));
}

/** Encontra blocos de 3+ linhas consecutivas repetidas em dois ficheiros .ts/.tsx. */
function findDuplicateBlocks(
  relA: string,
  textA: string,
  relB: string,
  textB: string,
): CodeDriftFinding | null {
  const la = normalizeLines(textA);
  const lb = normalizeLines(textB);
  if (relA === relB || la.length < 4 || lb.length < 4) return null;
  for (let len = Math.min(8, la.length, lb.length); len >= 3; len--) {
    for (let i = 0; i + len <= la.length; i += 1) {
      const slice = la.slice(i, i + len).join('\n');
      for (let j = 0; j + len <= lb.length; j += 1) {
        const sliceB = lb.slice(j, j + len).join('\n');
        if (slice === sliceB && slice.length > 20) {
          return {
            path: `${relA} ↔ ${relB}`,
            message: `Duplicate ${len.toString()}-line snippet (extract shared helper per golden principles).`,
            kind: 'duplicate_snippet',
          };
        }
      }
    }
  }
  return null;
}

/**
 * Expõe a análise de pares para testes (sem `git ls-files`).
 */
export function analyzeDuplicateSourceFiles(
  contents: ReadonlyMap<string, string>,
): readonly CodeDriftFinding[] {
  const rels = [...contents.keys()];
  const out: CodeDriftFinding[] = [];
  for (let a = 0; a < rels.length; a += 1) {
    for (let b = a + 1; b < rels.length; b += 1) {
      const ra = rels[a];
      const rb = rels[b];
      if (ra === undefined || rb === undefined) continue;
      const ta = contents.get(ra);
      const tb = contents.get(rb);
      if (ta === undefined || tb === undefined) continue;
      const hit = findDuplicateBlocks(ra, ta, rb, tb);
      if (hit) {
        out.push(hit);
        return out;
      }
    }
  }
  return out;
}

async function listSourceFiles(repoRoot: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['ls-files', '*.ts', '*.tsx'],
      { cwd: repoRoot, maxBuffer: 2_000_000 },
    );
    return stdout
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.includes('node_modules'))
      .slice(0, 60);
  } catch {
    return [];
  }
}

/**
 * Heurística leve: duplicação de blocos entre ficheiros fonte (amostra limitada).
 */
export async function detectCodeDriftHeuristic(
  repoRoot: string,
): Promise<readonly CodeDriftFinding[]> {
  const files = await listSourceFiles(repoRoot);
  if (files.length < 2) return [];
  const contents = new Map<string, string>();
  for (const rel of files) {
    try {
      const t = await readFile(join(repoRoot, rel), 'utf8');
      contents.set(rel, t);
    } catch {
      /* skip */
    }
  }
  return analyzeDuplicateSourceFiles(contents);
}
