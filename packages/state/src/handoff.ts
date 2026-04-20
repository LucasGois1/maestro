import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { handoffPath } from './paths.js';

export type HandoffArtifact = {
  readonly sprint: number;
  readonly summary: string;
  readonly changedFiles: readonly string[];
  readonly decisions: readonly string[];
  readonly nextSteps: readonly string[];
  readonly logReferences?: readonly string[];
};

export function renderHandoffMarkdown(handoff: HandoffArtifact): string {
  const lines: string[] = [];
  lines.push(`# Sprint ${handoff.sprint} — Handoff`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(handoff.summary.trim());
  lines.push('');
  if (handoff.decisions.length > 0) {
    lines.push('## Key decisions');
    lines.push('');
    for (const item of handoff.decisions) lines.push(`- ${item}`);
    lines.push('');
  }
  if (handoff.changedFiles.length > 0) {
    lines.push('## Changed files');
    lines.push('');
    for (const file of handoff.changedFiles) lines.push(`- \`${file}\``);
    lines.push('');
  }
  if (handoff.nextSteps.length > 0) {
    lines.push('## Next steps');
    lines.push('');
    for (const step of handoff.nextSteps) lines.push(`- ${step}`);
    lines.push('');
  }
  if (handoff.logReferences && handoff.logReferences.length > 0) {
    lines.push('## Log references');
    lines.push('');
    for (const ref of handoff.logReferences) lines.push(`- ${ref}`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export type WriteHandoffOptions = {
  readonly repoRoot: string;
  readonly runId: string;
  readonly maestroDir?: string;
  readonly handoff: HandoffArtifact;
};

export async function writeHandoff(
  options: WriteHandoffOptions,
): Promise<string> {
  const { handoff } = options;
  const base = {
    repoRoot: options.repoRoot,
    runId: options.runId,
    sprint: handoff.sprint,
    ...(options.maestroDir !== undefined
      ? { maestroDir: options.maestroDir }
      : {}),
  };
  const path = handoffPath(base);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderHandoffMarkdown(handoff), 'utf8');
  return path;
}
