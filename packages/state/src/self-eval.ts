import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { selfEvalPath } from './paths.js';

export type SprintSelfEvalPayload = {
  readonly coversAllCriteria: boolean;
  readonly missingCriteria: readonly string[];
  readonly concerns: readonly string[];
};

export function renderSelfEvalMarkdown(payload: SprintSelfEvalPayload): string {
  const lines: string[] = [
    '# Self-evaluation',
    '',
    `**Covers all criteria:** ${payload.coversAllCriteria ? 'yes' : 'no'}`,
    '',
  ];
  if (payload.missingCriteria.length > 0) {
    lines.push('## Missing criteria', '');
    for (const m of payload.missingCriteria) lines.push(`- ${m}`);
    lines.push('');
  }
  if (payload.concerns.length > 0) {
    lines.push('## Concerns', '');
    for (const c of payload.concerns) lines.push(`- ${c}`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export type WriteSprintSelfEvalOptions = {
  readonly repoRoot: string;
  readonly runId: string;
  readonly maestroDir?: string;
  readonly sprint: number;
  readonly selfEval: SprintSelfEvalPayload;
};

export async function writeSprintSelfEval(
  options: WriteSprintSelfEvalOptions,
): Promise<string> {
  const path = selfEvalPath({
    repoRoot: options.repoRoot,
    runId: options.runId,
    sprint: options.sprint,
    ...(options.maestroDir !== undefined
      ? { maestroDir: options.maestroDir }
      : {}),
  });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderSelfEvalMarkdown(options.selfEval), 'utf8');
  return path;
}
