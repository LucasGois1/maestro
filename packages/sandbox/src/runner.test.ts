import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auditFilePath } from './audit.js';
import { composePolicy } from './policy.js';
import {
  CommandDeniedError,
  CommandRejectedError,
  CommandTimedOutError,
  denyAllPrompter,
  runShellCommand,
} from './runner.js';

let repoRoot: string;

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-sandbox-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

describe('runShellCommand', () => {
  it('executes an allowlisted command and appends an audit entry', async () => {
    const result = await runShellCommand({
      cmd: 'git',
      args: ['status'],
      cwd: repoRoot,
      runId: 'r1',
      repoRoot,
      policy: composePolicy({ mode: 'allowlist' }),
    });
    expect(result.exitCode).toBeGreaterThanOrEqual(0);
    const audit = await readFile(
      auditFilePath({ repoRoot, runId: 'r1' }),
      'utf8',
    );
    const lastLine = audit.trim().split('\n').pop() ?? '';
    const parsed = JSON.parse(lastLine);
    expect(parsed.cmd).toBe('git');
    expect(parsed.approvedBy).toBe('allowlist');
  });

  it('refuses denylisted commands and records them with deny pattern', async () => {
    await expect(
      runShellCommand({
        cmd: 'rm',
        args: ['-rf', '/'],
        cwd: repoRoot,
        runId: 'r2',
        repoRoot,
        maestroDir: '.custom-maestro',
        agentId: 'generator',
        policy: composePolicy({ mode: 'allowlist' }),
      }),
    ).rejects.toBeInstanceOf(CommandDeniedError);

    const audit = await readFile(
      auditFilePath({
        repoRoot,
        runId: 'r2',
        maestroDir: '.custom-maestro',
      }),
      'utf8',
    );
    const parsed = JSON.parse(audit.trim().split('\n').pop() ?? '{}');
    expect(parsed.agentId).toBe('generator');
    expect(parsed.denyPattern).toBeDefined();
    expect(parsed.approvedBy).toBe('system');
  });

  it('prompts for unmatched commands and rejects when the user declines', async () => {
    const approver = vi.fn(async () => ({ choice: 'deny' as const }));
    await expect(
      runShellCommand({
        cmd: 'customscript',
        args: ['--flag'],
        cwd: repoRoot,
        runId: 'r3',
        repoRoot,
        maestroDir: '.custom-maestro',
        agentId: 'evaluator',
        policy: composePolicy({ mode: 'allowlist' }),
        approver,
      }),
    ).rejects.toBeInstanceOf(CommandRejectedError);
    expect(approver).toHaveBeenCalledOnce();
    expect(approver).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'evaluator' }),
    );

    const audit = await readFile(
      auditFilePath({
        repoRoot,
        runId: 'r3',
        maestroDir: '.custom-maestro',
      }),
      'utf8',
    );
    const parsed = JSON.parse(audit.trim().split('\n').pop() ?? '{}');
    expect(parsed.agentId).toBe('evaluator');
    expect(parsed.note).toBe('rejected by user');
  });

  it('uses the default deny-all prompter when approval is required', async () => {
    await expect(
      denyAllPrompter({
        cmd: 'customscript',
        args: [],
        commandLine: 'customscript',
        cwd: repoRoot,
        reason: 'unmatched',
      }),
    ).resolves.toEqual({ choice: 'deny' });

    await expect(
      runShellCommand({
        cmd: 'customscript',
        args: [],
        cwd: repoRoot,
        runId: 'r-default-deny',
        repoRoot,
        policy: composePolicy({ mode: 'allowlist' }),
      }),
    ).rejects.toBeInstanceOf(CommandRejectedError);
  });

  it('passes through when the approver says once', async () => {
    const approver = vi.fn(async () => ({ choice: 'once' as const }));
    const result = await runShellCommand({
      cmd: 'git',
      args: ['--version'],
      cwd: repoRoot,
      runId: 'r4',
      repoRoot,
      policy: composePolicy({ mode: 'strict' }),
      approver,
    });
    expect(result.exitCode).toBeGreaterThanOrEqual(0);
    expect(approver).toHaveBeenCalledOnce();
  });

  it('adds a pattern to the allowlist when the approver says always', async () => {
    const added: string[] = [];
    const approver = vi.fn(async () => ({
      choice: 'always' as const,
      pattern: 'customscript *',
    }));
    try {
      await runShellCommand({
        cmd: 'customscript',
        args: [],
        cwd: repoRoot,
        runId: 'r5',
        repoRoot,
        policy: composePolicy({ mode: 'allowlist' }),
        approver,
        onDynamicAllowlistAdd: (p) => added.push(p),
      });
    } catch {
      // command is synthetic and might exit non-zero; we care about the hook
    }
    expect(added).toContain('customscript *');
  });

  it('derives a dynamic allowlist pattern when approver says always without one', async () => {
    const added: string[] = [];
    const approver = vi.fn(async () => ({ choice: 'always' as const }));

    const result = await runShellCommand({
      cmd: 'git',
      args: ['--version'],
      cwd: repoRoot,
      runId: 'r-derived-pattern',
      repoRoot,
      policy: composePolicy({ mode: 'strict' }),
      approver,
      onDynamicAllowlistAdd: (p) => added.push(p),
    });

    expect(result.approvedBy).toBe('user');
    expect(added).toContain('git *');
  });

  it('records yolo approvals with agent and custom maestro directory metadata', async () => {
    const result = await runShellCommand({
      cmd: 'git',
      args: ['--version'],
      cwd: repoRoot,
      runId: 'r-yolo',
      repoRoot,
      maestroDir: '.custom-maestro',
      agentId: 'generator',
      policy: composePolicy({ mode: 'yolo' }),
    });

    expect(result.approvedBy).toBe('yolo');
    const audit = await readFile(
      auditFilePath({
        repoRoot,
        runId: 'r-yolo',
        maestroDir: '.custom-maestro',
      }),
      'utf8',
    );
    const parsed = JSON.parse(audit.trim().split('\n').pop() ?? '{}');
    expect(parsed.agentId).toBe('generator');
    expect(parsed.approvedBy).toBe('yolo');
  });

  it('times out long-running commands with the configured timeout', async () => {
    await expect(
      runShellCommand({
        cmd: 'node',
        args: [
          '-e',
          'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)',
        ],
        cwd: repoRoot,
        runId: 'r6',
        repoRoot,
        policy: composePolicy({ mode: 'yolo' }),
        timeoutMs: 10,
      }),
    ).rejects.toBeInstanceOf(CommandTimedOutError);
  });
});
