import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import type { MaestroConfig } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import {
  buildPrCommand,
  getGitLogOneline,
  parsePrUrlFromCliOutput,
  UnsupportedPlatformError,
} from '@maestro/git';
import { maestroRoot } from '@maestro/state';
import {
  composePolicy,
  denyAllPrompter,
  runShellCommand,
  type ApprovalPrompter,
  type RunCommandResult,
} from '@maestro/sandbox';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import { resolvePathUnderRepo } from './planner/safe-repo-path.js';
import { readRepoFileContent } from './repo-tools.js';

type MergerRemoteInfo = {
  readonly platform: 'github' | 'gitlab' | 'unknown';
  readonly url: string;
  readonly name?: string | undefined;
};

const readFileInput = z.object({
  path: z.string().min(1).describe('Relative to worktree root.'),
});

const writeFileInput = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const appendFileInput = z.object({
  path: z
    .string()
    .min(1)
    .describe('Relative path under .maestro/ only (e.g. log.md).'),
  content: z.string(),
});

const gitLogInput = z.object({
  maxCount: z.number().int().min(1).max(200).optional(),
  revisionRange: z.string().optional(),
});

const getMergeContextInput = z.object({}).strict();

const openPullRequestInput = z
  .object({
    title: z.string().min(1),
    body: z.string().min(1),
    labels: z.array(z.string().min(1)).default([]),
    draft: z.boolean().optional(),
  })
  .passthrough();

export type MergerToolContext = {
  readonly repoRoot: string;
  readonly worktreeRoot: string;
  readonly config: MaestroConfig;
  readonly runId: string;
  readonly bus: EventBus;
  readonly branch: string;
  readonly baseBranch?: string;
  readonly remote: MergerRemoteInfo | null;
  readonly requireDraftPr?: boolean;
  readonly maestroDir?: string;
  readonly shellApprover?: ApprovalPrompter;
};

export type MergerToolHooks = {
  readonly gitLog?: (input: {
    maxCount?: number;
    revisionRange?: string;
  }) => Promise<string>;
  readonly runShell?: (input: {
    readonly cmd: string;
    readonly args: readonly string[];
  }) => Promise<
    Pick<RunCommandResult, 'exitCode' | 'stdout' | 'stderr' | 'durationMs'>
  >;
};

function policyFromConfig(
  config: MaestroConfig,
  extraAllowlist: readonly string[] = [],
) {
  const mode =
    extraAllowlist.length > 0 && config.permissions.mode === 'strict'
      ? 'allowlist'
      : config.permissions.mode;
  return composePolicy({
    mode,
    allowlist: [...config.permissions.allowlist, ...extraAllowlist],
    denylist: [...config.permissions.denylist],
  });
}

function resolveMaestroPath(
  repoRoot: string,
  relativePath: string,
  maestroDir?: string,
): string {
  const root = maestroRoot(repoRoot, maestroDir);
  const norm = relativePath
    .trim()
    .replace(/^[/\\]+/u, '')
    .replace(/\\/gu, '/');
  const abs = join(root, norm);
  const relRoot = relative(root, abs);
  if (relRoot.startsWith('..') || relRoot.includes('..')) {
    throw new Error('Path escapes .maestro root');
  }
  return abs;
}

function labelsFailed(output: string): boolean {
  const lower = output.toLocaleLowerCase();
  return (
    lower.includes('label') &&
    (lower.includes('not found') ||
      lower.includes('could not add') ||
      lower.includes('invalid'))
  );
}

function stringifyToolResult(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Ferramentas do Merger: ficheiros no worktree, append em `.maestro/`, git log,
 * e PR/MR com invariantes da run encapsulados.
 */
export function createMergerToolSet(
  ctx: MergerToolContext,
  hooks?: MergerToolHooks,
): ToolSet {
  async function runCommand(options: {
    readonly cmd: string;
    readonly args: readonly string[];
    readonly extraAllowlist?: readonly string[];
  }): Promise<
    Pick<RunCommandResult, 'exitCode' | 'stdout' | 'stderr' | 'durationMs'>
  > {
    if (hooks?.runShell) {
      return hooks.runShell({ cmd: options.cmd, args: options.args });
    }
    return runShellCommand({
      cmd: options.cmd,
      args: options.args,
      agentId: 'merger',
      cwd: ctx.worktreeRoot,
      runId: ctx.runId,
      repoRoot: ctx.repoRoot,
      ...(ctx.maestroDir !== undefined ? { maestroDir: ctx.maestroDir } : {}),
      policy: policyFromConfig(ctx.config, options.extraAllowlist ?? []),
      approver: ctx.shellApprover ?? denyAllPrompter,
      timeoutMs: 180_000,
    });
  }

  const readFileTool = tool({
    description: 'Read a text file relative to the worktree root.',
    inputSchema: readFileInput,
    execute: async ({ path: p }) => {
      const norm = p.trim().replace(/^[/\\]+/u, '');
      try {
        return await readRepoFileContent(
          ctx.worktreeRoot,
          norm.replace(/\\/gu, '/'),
        );
      } catch (e) {
        return `Read error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const writeFileTool = tool({
    description: 'Write a file relative to the worktree root.',
    inputSchema: writeFileInput,
    execute: async ({ path: p, content }) => {
      try {
        const abs = resolvePathUnderRepo(
          ctx.worktreeRoot,
          p
            .trim()
            .replace(/^[/\\]+/u, '')
            .replace(/\\/gu, '/'),
        );
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, content, 'utf8');
        return `Written: ${p}`;
      } catch (e) {
        return `Write error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const appendFileTool = tool({
    description:
      'Append UTF-8 text to a file under .maestro/ (e.g. log.md), path relative to .maestro.',
    inputSchema: appendFileInput,
    execute: async ({ path: p, content }) => {
      try {
        const abs = resolveMaestroPath(ctx.repoRoot, p, ctx.maestroDir);
        await mkdir(dirname(abs), { recursive: true });
        await appendFile(abs, content, 'utf8');
        return `Appended: ${p}`;
      } catch (e) {
        return `Append error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const gitLogTool = tool({
    description: 'Show recent commits (oneline) in the worktree.',
    inputSchema: gitLogInput,
    execute: async (input) => {
      if (hooks?.gitLog) {
        const payload: { maxCount?: number; revisionRange?: string } = {};
        if (
          input.revisionRange !== undefined &&
          input.revisionRange.length > 0
        ) {
          payload.revisionRange = input.revisionRange;
        }
        if (input.maxCount !== undefined) {
          payload.maxCount = input.maxCount;
        }
        return hooks.gitLog(payload);
      }
      try {
        if (
          input.revisionRange !== undefined &&
          input.revisionRange.length > 0
        ) {
          return await getGitLogOneline({
            cwd: ctx.worktreeRoot,
            revisionRange: input.revisionRange,
          });
        }
        if (input.maxCount !== undefined) {
          return await getGitLogOneline({
            cwd: ctx.worktreeRoot,
            maxCount: input.maxCount,
          });
        }
        return await getGitLogOneline({ cwd: ctx.worktreeRoot });
      } catch (e) {
        return `git log error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const getMergeContextTool = tool({
    description:
      'Return the run-owned merge context: branch, base branch, remote, status, and recent commits.',
    inputSchema: getMergeContextInput,
    execute: async () => {
      const recentCommits = hooks?.gitLog
        ? await hooks.gitLog({ maxCount: 20 })
        : await getGitLogOneline({ cwd: ctx.worktreeRoot, maxCount: 20 }).catch(
            (e: unknown) =>
              `git log error: ${e instanceof Error ? e.message : String(e)}`,
          );
      const status = await runCommand({
        cmd: 'git',
        args: ['status', '--short', '--branch'],
      }).catch((e: unknown) => ({
        exitCode: 1,
        stdout: '',
        stderr: e instanceof Error ? e.message : String(e),
        durationMs: 0,
      }));
      return stringifyToolResult({
        branch: ctx.branch,
        baseBranch: ctx.baseBranch ?? 'main',
        remote: ctx.remote,
        requireDraftPr: ctx.requireDraftPr ?? false,
        recentCommits,
        status:
          status.exitCode === 0
            ? status.stdout.trim()
            : `git status error: ${status.stderr.trim()}`,
      });
    },
  });

  const openPullRequestTool = tool({
    description:
      'Push the run branch and open a PR/MR using run-owned branch/base/remote invariants.',
    inputSchema: openPullRequestInput,
    execute: async ({ title, body, labels, draft }) => {
      const safeLabels = labels ?? [];
      const remote = ctx.remote;
      const baseBranch = ctx.baseBranch ?? 'main';
      if (remote === null || remote.platform === 'unknown') {
        return stringifyToolResult({
          ok: false,
          stage: 'remote',
          branch: ctx.branch,
          baseBranch,
          reason: 'No supported git remote detected.',
        });
      }

      try {
        const remoteName = remote.name ?? 'origin';
        const push = await runCommand({
          cmd: 'git',
          args: ['push', remoteName, ctx.branch],
          extraAllowlist: [`git push ${remoteName} ${ctx.branch}`],
        });
        if (push.exitCode !== 0) {
          return stringifyToolResult({
            ok: false,
            stage: 'push',
            branch: ctx.branch,
            baseBranch,
            exitCode: push.exitCode,
            stdout: push.stdout.slice(0, 4_000),
            stderr: push.stderr.slice(0, 4_000),
          });
        }

        const prCommand = buildPrCommand({
          platform: remote.platform,
          pr: {
            title,
            summary: body,
            sprints: [],
            labels: safeLabels,
          },
          baseBranch,
          head: ctx.branch,
          draft: draft ?? ctx.requireDraftPr ?? false,
        });
        let pr = await runCommand({
          cmd: prCommand.program,
          args: prCommand.args,
        });
        let retriedWithoutLabels = false;
        const combined = `${pr.stdout}\n${pr.stderr}`;
        if (
          pr.exitCode !== 0 &&
          safeLabels.length > 0 &&
          labelsFailed(combined)
        ) {
          const retry = buildPrCommand({
            platform: remote.platform,
            pr: {
              title,
              summary: body,
              sprints: [],
              labels: [],
            },
            baseBranch,
            head: ctx.branch,
            draft: draft ?? ctx.requireDraftPr ?? false,
          });
          pr = await runCommand({ cmd: retry.program, args: retry.args });
          retriedWithoutLabels = true;
        }

        const parsed = parsePrUrlFromCliOutput(`${pr.stdout}\n${pr.stderr}`);
        return stringifyToolResult({
          ok: pr.exitCode === 0 && parsed.prUrl !== undefined,
          stage: 'pr',
          branch: ctx.branch,
          baseBranch,
          remote,
          exitCode: pr.exitCode,
          prUrl: parsed.prUrl ?? null,
          prNumber: parsed.prNumber ?? null,
          retriedWithoutLabels,
          stdout: pr.stdout.slice(0, 4_000),
          stderr: pr.stderr.slice(0, 4_000),
        });
      } catch (e) {
        if (e instanceof UnsupportedPlatformError) {
          return stringifyToolResult({
            ok: false,
            stage: 'remote',
            branch: ctx.branch,
            baseBranch,
            reason: e.message,
          });
        }
        return stringifyToolResult({
          ok: false,
          stage: 'exception',
          branch: ctx.branch,
          baseBranch,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    },
  });

  return {
    readFile: readFileTool,
    writeFile: writeFileTool,
    appendFile: appendFileTool,
    gitLog: gitLogTool,
    getMergeContext: getMergeContextTool,
    openPullRequest: openPullRequestTool,
  } as ToolSet;
}
