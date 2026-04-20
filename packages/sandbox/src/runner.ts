import { ExecaError, execa } from 'execa';

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

export class CommandTimedOutError extends Error {
  constructor(
    message: string,
    public readonly commandLine: string,
    public readonly timeoutMs: number,
    public readonly stdout = '',
    public readonly stderr = '',
  ) {
    super(message);
    this.name = 'CommandTimedOutError';
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
  readonly onDynamicAllowlistAdd?: (pattern: string) => void;
  readonly timeoutMs?: number;
};

export type RunCommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly decision: PolicyDecision;
  readonly approvedBy: AuditApprover;
};

function toTextOutput(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('utf8');
  }
  return '';
}

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
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}> {
  const commandLine = renderCommandLine(options.cmd, options.args);
  let timedOut = false;
  const subprocess = execa(options.cmd, [...options.args], {
    cwd: options.cwd,
    ...(options.env !== undefined ? { env: options.env } : {}),
    stdout: options.stdio ?? 'pipe',
    stderr: options.stdio ?? 'pipe',
    stdin: 'ignore',
    reject: false,
  });
  const timer =
    options.timeoutMs !== undefined
      ? setTimeout(() => {
          timedOut = true;
          subprocess.kill('SIGKILL');
        }, options.timeoutMs)
      : undefined;

  try {
    const result = await subprocess;
    if (timer) {
      clearTimeout(timer);
    }
    if (timedOut) {
      throw new CommandTimedOutError(
        `Command "${commandLine}" timed out after ${options.timeoutMs ?? 0}ms.`,
        commandLine,
        options.timeoutMs ?? 0,
        toTextOutput(result.stdout),
        toTextOutput(result.stderr),
      );
    }

    return {
      stdout: toTextOutput(result.stdout),
      stderr: toTextOutput(result.stderr),
      exitCode: result.exitCode ?? 0,
      durationMs: result.durationMs,
    };
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
    }
    if (timedOut) {
      const execaError = error as Partial<ExecaError>;
      throw new CommandTimedOutError(
        `Command "${commandLine}" timed out after ${options.timeoutMs ?? 0}ms.`,
        commandLine,
        options.timeoutMs ?? 0,
        toTextOutput(execaError.stdout),
        toTextOutput(execaError.stderr),
      );
    }
    if (error instanceof ExecaError && error.timedOut) {
      throw new CommandTimedOutError(
        `Command "${commandLine}" timed out after ${options.timeoutMs ?? 0}ms.`,
        commandLine,
        options.timeoutMs ?? 0,
        toTextOutput(error.stdout),
        toTextOutput(error.stderr),
      );
    }
    throw error;
  }
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

  let stdout = '';
  let stderr = '';
  let exitCode = 0;
  let durationMs = 0;
  try {
    const execution = await executeCommand(options);
    stdout = execution.stdout;
    stderr = execution.stderr;
    exitCode = execution.exitCode;
    durationMs = execution.durationMs;
  } catch (error) {
    if (!(error instanceof CommandTimedOutError)) {
      throw error;
    }

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
        approvedBy: approverToAudit(decision, approvalDecision),
        durationMs: error.timeoutMs,
        note: `timed out after ${error.timeoutMs}ms`,
      },
    });
    throw error;
  }

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
