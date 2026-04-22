import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface MaestroKbFileEntry {
  readonly path: string;
  readonly previewText: string;
}

const PREVIEW_MAX = 4000;

export function listMaestroFilesUnderRepo(
  repoRoot: string,
): MaestroKbFileEntry[] {
  const base = join(repoRoot, '.maestro');
  if (!existsSync(base)) {
    return [];
  }
  const out: MaestroKbFileEntry[] = [];

  function walk(dir: string): void {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(p);
      } else {
        const rel = relative(repoRoot, p);
        try {
          const raw = readFileSync(p, 'utf8');
          const previewText =
            raw.length > PREVIEW_MAX ? `${raw.slice(0, PREVIEW_MAX)}…` : raw;
          out.push({ path: rel, previewText });
        } catch {
          out.push({ path: rel, previewText: '(não legível)' });
        }
      }
    }
  }

  walk(base);
  return out;
}
