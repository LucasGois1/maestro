import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { maestroRoot } from '@maestro/state';

/** Load ARCHITECTURE.md from `.maestro/` or use override. */
export async function loadArchitectureDocument(
  repoRoot: string,
  override: string | undefined,
  maestroDir = '.maestro',
): Promise<string> {
  if (override?.trim()) return override;
  const path = join(maestroRoot(repoRoot, maestroDir), 'ARCHITECTURE.md');
  try {
    return await readFile(path, 'utf8');
  } catch {
    throw new Error(
      `Cannot read ARCHITECTURE.md at ${path}. Add the file or pass pipeline option "architecture".`,
    );
  }
}

/**
 * Inserts or replaces the `### Architect notes` block under the given sprint heading
 * (`### Sprint N — ...`).
 */
export function appendArchitectNotesToPlanMarkdown(
  content: string,
  sprintIdxOneBased: number,
  embeddedBlock: string,
): string {
  const headerRe = new RegExp(
    `^### Sprint ${sprintIdxOneBased.toString()} — .+$`,
    'mu',
  );
  const m = headerRe.exec(content);
  if (!m || m.index === undefined) {
    throw new Error(
      `Could not find "### Sprint ${sprintIdxOneBased.toString()}" in plan.md`,
    );
  }
  const start = m.index;
  const afterHeader = content.slice(start + m[0].length);
  const nextIx = afterHeader.search(/\n### Sprint \d+ — /u);
  const end = nextIx === -1 ? content.length : start + m[0].length + nextIx;

  let sectionBody = content.slice(start, end);
  sectionBody = sectionBody.replace(/\n### Architect notes\n[\s\S]*$/u, '');
  sectionBody = sectionBody.trimEnd();
  const updated = `${sectionBody}\n\n${embeddedBlock.trim()}\n`;
  return content.slice(0, start) + updated + content.slice(end);
}

export async function patchPlanFileWithArchitectNotes(
  repoRoot: string,
  runId: string,
  sprintIdxOneBased: number,
  embeddedBlock: string,
  maestroDir = '.maestro',
): Promise<void> {
  const path = join(maestroRoot(repoRoot, maestroDir), 'runs', runId, 'plan.md');
  const content = await readFile(path, 'utf8');
  const next = appendArchitectNotesToPlanMarkdown(
    content,
    sprintIdxOneBased,
    embeddedBlock,
  );
  await writeFile(path, next, 'utf8');
}

export async function writeDesignNotesSprintFile(
  repoRoot: string,
  runId: string,
  sprintNumberOneBased: number,
  body: string,
  maestroDir = '.maestro',
): Promise<void> {
  const dir = join(
    maestroRoot(repoRoot, maestroDir),
    'runs',
    runId,
    'design-notes',
  );
  await mkdir(dir, { recursive: true });
  const path = join(
    dir,
    `design-notes-sprint-${sprintNumberOneBased.toString()}.md`,
  );
  await writeFile(path, body, 'utf8');
}
