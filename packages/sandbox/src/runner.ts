import { spawn } from 'node:child_process';

import { appendAudit, type AuditApprover, type AuditEntry } from './audit.js';
import { checkCommand, type Policy, type PolicyDecision } from './policy.js';
import { renderCommandLine } from './patterns.js';

export class CommandDeniedError extends Error {
  constructor(
    message: string,
    public readonly pattern: string,
    public readonly commandLine: string,
  ) {
    super(message);
    this.name = 'CommandDeniedError';
  }
}

export class CommandRejectedError extends Error {
  constructor(
    message: string,
    public readonly commandLine: string,
  ) {
    super(message);
    this.name = 'CommandRejectedError';
  }
}

export type ApprovalDecision =
  | { readonly choice: 'once' }
  | { readonly choice: 'always'; readonly pattern?: string }
  | { readonly choice: 'deny' };

export type ApprovalRequest = {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly commandLine: string;
  readonly cwd: string;
  readonly agentId?: string;
  readonly reason: 'strict' | 'unmatched';
};

export type ApprovalPrompter = (
  request: ApprovalRequest,
) => Promise<ApprovalDecision>;

export const denyAllPrompter: ApprovalPrompter = async () => ({
  choice: 'deny',
});

export type RunCommandOptions = {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly stdio?: 'inherit' | 'ignore' | 'pipe';
  readonly agentId?: string;
  readonly runId: string;
  readonly repoRoot: string;
  readonly maestroDir?: string;
  readonly policy: Policy;
  readonly approver?: ApprovalPrompter;
  readonly spawnImpl?: typeof spawn;
  readonly onDynamicAllowlistAdd?: (pattern: string) => void;
};

export type RunCommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly decision: PolicyDecision;
  readonly approvedBy: AuditApprover;
};

function approverToAudit(
  decision: PolicyDecision,
  approved: ApprovalDecision | null,
): AuditApprover {
  if (decision.kind === 'allow') {
    return decision.reason === 'yolo' ? 'yolo' : 'allowlist';
  }
  if (decision.kind === 'ask' && approved?.choice !== 'deny') return 'user';
  return 'system';
}

async function executeCommand(
  options: RunCommandOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const impl = options.spawnImpl ?? spawn;
  return new Promise((resolve, reject) => {
    const child = impl(options.cmd, [...options.args], {
      cwd: options.cwd,
      ...(options.env !== undefined ? { env: options.env } : {}),
      stdio: options.stdio ?? 'pipe',
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

export async function runShellCommand(
  options: RunCommandOptions,
): Promise<RunCommandResult> {
  const decision = checkCommand({
    cmd: options.cmd,
    args: options.args,
    policy: options.policy,
  });
  const commandLine = renderCommandLine(options.cmd, options.args);

  if (decision.kind === 'deny') {
    const entry: AuditEntry = {
      ts: new Date().toISOString(),
      runId: options.runId,
      ...(options.agentId !== undefined ? { agentId: options.agentId } : {}),
      cmd: options.cmd,
      args: options.args,
      cwd: options.cwd,
      approvedBy: 'system',
      denyPattern: decision.pattern,
      note: 'blocked by denylist',
    };
    await appendAudit({
      repoRoot: options.repoRoot,
      runId: options.runId,
      ...(options.maestroDir !== undefined
        ? { maestroDir: options.maestroDir }
        : {}),
      entry,
    });
    throw new CommandDeniedError(
      `Command "${commandLine}" blocked by denylist pattern "${decision.pattern}".`,
      decision.pattern,
      commandLine,
    );
  }

  let approvalDecision: ApprovalDecision | null = null;
  if (decision.kind === 'ask') {
    const approver = options.approver ?? denyAllPrompter;
    approvalDecision = await approver({
      cmd: options.cmd,
      args: options.args,
      commandLine,
      cwd: options.cwd,
      ...(options.agentId !== undefined ? { agentId: options.agentId } : {}),
      reason: decision.reason,
    });
    if (approvalDecision.choice === 'deny') {
      await appendAudit({
        repoRoot: options.repoRoot,
        runId: options.runId,
        ...(options.maestroDir !== undefined
          ? { maestroDir: options.maestroDir }
          : {}),
        entry: {
          ts: new Date().toISOString(),
          ...(options.agentId !== undefined
            ? { agentId: options.agentId }
            : {}),
          cmd: options.cmd,
          args: options.args,
          cwd: options.cwd,
          approvedBy: 'user',
          note: 'rejected by user',
        },
      });
      throw new CommandRejectedError(
        `Command "${commandLine}" rejected by the approver.`,
        commandLine,
      );
    }
    if (approvalDecision.choice === 'always') {
      const pattern = approvalDecision.pattern ?? `${options.cmd} *`;
      options.onDynamicAllowlistAdd?.(pattern);
    }
  }

  const startedAt = Date.now();
  const { stdout, stderr, exitCode } = await executeCommand(options);
  const durationMs = Date.now() - startedAt;

  const approvedBy = approverToAudit(decision, approvalDecision);
  await appendAudit({
    repoRoot: options.repoRoot,
    runId: options.runId,
    ...(options.maestroDir !== undefined
      ? { maestroDir: options.maestroDir }
      : {}),
    entry: {
      ts: new Date().toISOString(),
      ...(options.agentId !== undefined ? { agentId: options.agentId } : {}),
      cmd: options.cmd,
      args: options.args,
      cwd: options.cwd,
      approvedBy,
      exitCode,
      durationMs,
    },
  });

  return { stdout, stderr, exitCode, durationMs, decision, approvedBy };
}
