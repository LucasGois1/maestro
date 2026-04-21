import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import type { MaestroConfig } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import { getGitLogOneline } from '@maestro/git';
import { maestroRoot } from '@maestro/state';
import { composePolicy, denyAllPrompter, runShellCommand } from '@maestro/sandbox';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import { resolvePathUnderRepo } from './planner/safe-repo-path.js';
import { readRepoFileContent } from './repo-tools.js';

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

const runShellInput = z.object({
  cmd: z.string().min(1),
  args: z.array(z.string()).default([]),
});

const gitLogInput = z.object({
  maxCount: z.number().int().min(1).max(200).optional(),
  revisionRange: z.string().optional(),
});

export type MergerToolContext = {
  readonly repoRoot: string;
  readonly worktreeRoot: string;
  readonly config: MaestroConfig;
  readonly runId: string;
  readonly bus: EventBus;
  readonly maestroDir?: string;
};

export type MergerToolHooks = {
  readonly gitLog?: (input: {
    maxCount?: number;
    revisionRange?: string;
  }) => Promise<string>;
};

function policyFromConfig(config: MaestroConfig) {
  return composePolicy({
    mode: config.permissions.mode,
    allowlist: [...config.permissions.allowlist],
    denylist: [...config.permissions.denylist],
  });
}

function resolveMaestroPath(
  repoRoot: string,
  relativePath: string,
  maestroDir?: string,
): string {
  const root = maestroRoot(repoRoot, maestroDir);
  const norm = relativePath.trim().replace(/^[/\\]+/u, '').replace(/\\/gu, '/');
  const abs = join(root, norm);
  const relRoot = relative(root, abs);
  if (relRoot.startsWith('..') || relRoot.includes('..')) {
    throw new Error('Path escapes .maestro root');
  }
  return abs;
}

/**
 * Ferramentas do Merger: ficheiros no worktree, append em `.maestro/`, shell, git log.
 */
export function createMergerToolSet(
  ctx: MergerToolContext,
  hooks?: MergerToolHooks,
): ToolSet {
  const policy = policyFromConfig(ctx.config);

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
          p.trim().replace(/^[/\\]+/u, '').replace(/\\/gu, '/'),
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

  const runShellTool = tool({
    description:
      'Run shell in worktree (gh, glab, git, …); subject to permission policy.',
    inputSchema: runShellInput,
    execute: async ({ cmd, args }) => {
      try {
        const result = await runShellCommand({
          cmd,
          args,
          cwd: ctx.worktreeRoot,
          runId: ctx.runId,
          repoRoot: ctx.repoRoot,
          ...(ctx.maestroDir !== undefined ? { maestroDir: ctx.maestroDir } : {}),
          policy,
          approver: denyAllPrompter,
          timeoutMs: 180_000,
        });
        const head =
          result.exitCode === 0
            ? 'OK'
            : `exit ${result.exitCode.toString()}`;
        const out = [head, result.stdout, result.stderr]
          .filter((s) => s.length > 0)
          .join('\n');
        return out.slice(0, 32_000);
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const gitLogTool = tool({
    description: 'Show recent commits (oneline) in the worktree.',
    inputSchema: gitLogInput,
    execute: async (input) => {
      if (hooks?.gitLog) {
        const payload: { maxCount?: number; revisionRange?: string } = {};
        if (input.revisionRange !== undefined && input.revisionRange.length > 0) {
          payload.revisionRange = input.revisionRange;
        }
        if (input.maxCount !== undefined) {
          payload.maxCount = input.maxCount;
        }
        return hooks.gitLog(payload);
      }
      try {
        if (input.revisionRange !== undefined && input.revisionRange.length > 0) {
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

  return {
    readFile: readFileTool,
    writeFile: writeFileTool,
    appendFile: appendFileTool,
    runShell: runShellTool,
    gitLog: gitLogTool,
  } as ToolSet;
}
