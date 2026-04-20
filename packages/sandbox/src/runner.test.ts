import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auditFilePath } from './audit.js';
import { composePolicy } from './policy.js';
import {
  CommandDeniedError,
  CommandRejectedError,
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
        policy: composePolicy({ mode: 'allowlist' }),
      }),
    ).rejects.toBeInstanceOf(CommandDeniedError);

    const audit = await readFile(
      auditFilePath({ repoRoot, runId: 'r2' }),
      'utf8',
    );
    const parsed = JSON.parse(audit.trim().split('\n').pop() ?? '{}');
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
        policy: composePolicy({ mode: 'allowlist' }),
        approver,
      }),
    ).rejects.toBeInstanceOf(CommandRejectedError);
    expect(approver).toHaveBeenCalledOnce();
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
});
