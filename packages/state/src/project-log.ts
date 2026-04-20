import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { projectLogPath } from './paths.js';

export type ProjectLogLevel = 'info' | 'warn' | 'error';

export type ProjectLogEntry = {
  readonly runId?: string;
  readonly event: string;
  readonly level?: ProjectLogLevel;
  readonly detail?: string;
  readonly now?: Date;
};

export type AppendProjectLogOptions = {
  readonly repoRoot: string;
  readonly maestroDir?: string;
  readonly entry: ProjectLogEntry;
};

function format(entry: ProjectLogEntry): string {
  const level = entry.level ?? 'info';
  const timestamp = (entry.now ?? new Date()).toISOString();
  const runId = entry.runId ? ` [${entry.runId}]` : '';
  const detail = entry.detail ? ` — ${entry.detail}` : '';
  return `- ${timestamp}${runId} ${level.toUpperCase()} ${entry.event}${detail}\n`;
}

export async function appendProjectLog(
  options: AppendProjectLogOptions,
): Promise<void> {
  const path = projectLogPath(options.repoRoot, options.maestroDir);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, format(options.entry), 'utf8');
}

export async function readProjectLog(
  repoRoot: string,
  maestroDir?: string,
): Promise<string> {
  const path = projectLogPath(repoRoot, maestroDir);
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'ENOENT'
    ) {
      return '';
    }
    throw error;
  }
}
