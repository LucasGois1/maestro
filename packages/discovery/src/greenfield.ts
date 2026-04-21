import { copyFile, cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GREENFIELD_TEMPLATE_IDS = [
  'python-fastapi',
  'node-nextjs',
  'go-service',
] as const;

export type GreenfieldTemplateId = (typeof GREENFIELD_TEMPLATE_IDS)[number];

export function listGreenfieldTemplateIds(): readonly string[] {
  return GREENFIELD_TEMPLATE_IDS;
}

export function isGreenfieldTemplateId(name: string): name is GreenfieldTemplateId {
  return (GREENFIELD_TEMPLATE_IDS as readonly string[]).includes(name);
}

export function resolveTemplateDirectory(templateId: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', 'templates', templateId);
}

export async function applyGreenfieldTemplate(
  repoRoot: string,
  templateId: GreenfieldTemplateId,
): Promise<void> {
  const src = resolveTemplateDirectory(templateId);
  const destRoot = join(repoRoot, '.maestro');
  await mkdir(destRoot, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = join(src, entry.name);
    const to = join(destRoot, entry.name);
    if (entry.isFile()) {
      await copyFile(from, to);
    } else if (entry.isDirectory()) {
      await cp(from, to, { recursive: true });
    }
  }
}
