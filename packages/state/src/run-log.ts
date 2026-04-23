import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { runLogPath } from './paths.js';

export type RunLogLevel = 'info' | 'warn' | 'error';

export type RunLogEntry = {
  readonly event: string;
  readonly level?: RunLogLevel;
  readonly detail?: string;
  readonly now?: Date;
};

export type AppendRunLogOptions = {
  readonly repoRoot: string;
  readonly runId: string;
  readonly maestroDir?: string;
  readonly entry: RunLogEntry;
};

function format(entry: RunLogEntry): string {
  const level = entry.level ?? 'info';
  const timestamp = (entry.now ?? new Date()).toISOString();
  const detail = entry.detail ? ` — ${entry.detail}` : '';
  return `- ${timestamp} ${level.toUpperCase()} ${entry.event}${detail}\n`;
}

export async function appendRunLog(
  options: AppendRunLogOptions,
): Promise<void> {
  const path = runLogPath({
    repoRoot: options.repoRoot,
    runId: options.runId,
    ...(options.maestroDir !== undefined ? { maestroDir: options.maestroDir } : {}),
  });
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, format(options.entry), 'utf8');
}
