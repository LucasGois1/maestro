import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { runRoot, type RunPathOptions } from '@maestro/state';

export const AUDIT_FILE = 'audit.jsonl';

export type AuditApprover = 'allowlist' | 'yolo' | 'user' | 'system';

export type AuditEntry = {
  readonly ts: string;
  readonly runId: string;
  readonly agentId?: string;
  readonly cmd: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly approvedBy: AuditApprover;
  readonly exitCode?: number;
  readonly durationMs?: number;
  readonly denyPattern?: string;
  readonly note?: string;
};

export function auditFilePath(opts: RunPathOptions): string {
  return join(runRoot(opts), AUDIT_FILE);
}

export type AppendAuditOptions = {
  readonly repoRoot: string;
  readonly runId: string;
  readonly maestroDir?: string;
  readonly entry: Omit<AuditEntry, 'ts' | 'runId'> &
    Partial<Pick<AuditEntry, 'ts'>>;
};

export async function appendAudit(options: AppendAuditOptions): Promise<void> {
  const base: RunPathOptions = {
    repoRoot: options.repoRoot,
    runId: options.runId,
    ...(options.maestroDir !== undefined
      ? { maestroDir: options.maestroDir }
      : {}),
  };
  const path = auditFilePath(base);
  await mkdir(dirname(path), { recursive: true });
  const record: AuditEntry = {
    runId: options.runId,
    ts: options.entry.ts ?? new Date().toISOString(),
    ...options.entry,
  };
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8');
}
