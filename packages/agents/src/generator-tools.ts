import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { MaestroConfig } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import { commitSprint } from '@maestro/git';
import {
  composePolicy,
  denyAllPrompter,
  runShellCommand,
  type ApprovalPrompter,
} from '@maestro/sandbox';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import { resolvePathUnderRepo } from './planner/safe-repo-path.js';
import { executeRunSensorTool } from './run-sensor-tool.js';
import { createPlannerToolSet, readRepoFileContent } from './repo-tools.js';

const readFileInput = z.object({
  path: z
    .string()
    .min(1)
    .describe('Relative path to the implementation root (worktree / branch).'),
});

const writeFileInput = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const editFileInput = z.object({
  path: z.string().min(1),
  oldStr: z.string().min(1),
  newStr: z.string(),
});

const runShellInput = z.object({
  cmd: z.string().min(1),
  args: z.array(z.string()).default([]),
});

const runSensorInput = z.object({
  id: z.string().min(1).describe('Sensor id from .maestro/sensors.json'),
});

const gitCommitInput = z.object({
  type: z.string().min(1),
  scope: z.string().optional(),
  subject: z.string().min(1),
});

export type GeneratorToolContext = {
  /** Raiz onde ler/escrever código e correr shell/git. */
  readonly workspaceRoot: string;
  /** Checkout com `.maestro/runs`, sensors e audit de comandos. */
  readonly stateRepoRoot: string;
  readonly config: MaestroConfig;
  readonly runId: string;
  readonly bus: EventBus;
  readonly maestroDir?: string;
  /** Quando definido (TUI), pede aprovação humana para shell fora da allowlist. */
  readonly shellApprover?: ApprovalPrompter;
};

export type GeneratorToolHooks = {
  /** Substitui execução real do sensor (testes do tight loop). */
  readonly runSensor?: (id: string) => Promise<string>;
};

function policyFromConfig(config: MaestroConfig) {
  return composePolicy({
    mode: config.permissions.mode,
    allowlist: [...config.permissions.allowlist],
    denylist: [...config.permissions.denylist],
  });
}

/**
 * Generator Tools: file operations, shell with policy, sensor, git, listing, ripgrep.
 */
export function createGeneratorToolSet(
  ctx: GeneratorToolContext,
  hooks?: GeneratorToolHooks,
): ToolSet {
  const { listDirectory, searchCode } = createPlannerToolSet(
    ctx.workspaceRoot,
    ctx.stateRepoRoot,
  );
  const policy = policyFromConfig(ctx.config);

  const readFileTool = tool({
    description:
      'Reads a text file at the implementation root (relative path).',
    inputSchema: readFileInput,
    execute: async ({ path: p }) => {
      const norm = p.trim().replace(/^[/\\]+/u, '');
      try {
        return await readRepoFileContent(
          ctx.workspaceRoot,
          norm.replace(/\\/gu, '/'),
        );
      } catch (e) {
        return `Error reading: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const writeFileTool = tool({
    description:
      'Creates or replaces a file at the implementation root (relative path).',
    inputSchema: writeFileInput,
    execute: async ({ path: p, content }) => {
      try {
        const abs = resolvePathUnderRepo(
          ctx.workspaceRoot,
          p
            .trim()
            .replace(/^[/\\]+/u, '')
            .replace(/\\/gu, '/'),
        );
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, content, 'utf8');
        return `Written: ${p}`;
      } catch (e) {
        return `Erro ao escrever: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const editFileTool = tool({
    description:
      'Replaces a single occurrence of oldStr with newStr in the file.',
    inputSchema: editFileInput,
    execute: async ({ path: p, oldStr, newStr }) => {
      try {
        const abs = resolvePathUnderRepo(
          ctx.workspaceRoot,
          p
            .trim()
            .replace(/^[/\\]+/u, '')
            .replace(/\\/gu, '/'),
        );
        const before = await readFile(abs, 'utf8');
        const ix = before.indexOf(oldStr);
        if (ix === -1) {
          return 'oldStr not found in the file.';
        }
        if (before.indexOf(oldStr, ix + 1) !== -1) {
          return 'oldStr is not unique; make the fragment more specific.';
        }
        const after = `${before.slice(0, ix)}${newStr}${before.slice(ix + oldStr.length)}`;
        await writeFile(abs, after, 'utf8');
        return `Edited: ${p}`;
      } catch (e) {
        return `Error editing: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const runShellTool = tool({
    description:
      'Executes a shell command with cwd = the implementation root; subject to the permission model.',
    inputSchema: runShellInput,
    execute: async ({ cmd, args }) => {
      try {
        const result = await runShellCommand({
          cmd,
          args,
          agentId: 'generator',
          cwd: ctx.workspaceRoot,
          runId: ctx.runId,
          repoRoot: ctx.stateRepoRoot,
          ...(ctx.maestroDir !== undefined
            ? { maestroDir: ctx.maestroDir }
            : {}),
          policy,
          approver: ctx.shellApprover ?? denyAllPrompter,
          timeoutMs: 120_000,
        });
        const head =
          result.exitCode === 0 ? 'OK' : `exit ${result.exitCode.toString()}`;
        const out = [head, result.stdout, result.stderr]
          .filter((s) => s.length > 0)
          .join('\n');
        return out.slice(0, 24_000);
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const runSensorTool = tool({
    description:
      'Executes a registered sensor (computational or inferential) by id.',
    inputSchema: runSensorInput,
    execute: async ({ id }) =>
      executeRunSensorTool(
        {
          repoRoot: ctx.stateRepoRoot,
          executionRoot: ctx.workspaceRoot,
          runId: ctx.runId,
          bus: ctx.bus,
          ...(ctx.maestroDir !== undefined
            ? { maestroDir: ctx.maestroDir }
            : {}),
          policy,
          config: ctx.config,
        },
        id,
        hooks?.runSensor,
      ),
  });

  const gitCommitTool = tool({
    description:
      'Commits with a Conventional Commits message (type, optional scope, subject).',
    inputSchema: gitCommitInput,
    execute: async ({ type, scope, subject }) => {
      try {
        const sha = await commitSprint({
          cwd: ctx.workspaceRoot,
          type,
          ...(scope !== undefined ? { scope } : {}),
          subject,
          addAll: true,
        });
        return `Committed ${sha}`;
      } catch (e) {
        return `Git error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  return {
    readFile: readFileTool,
    writeFile: writeFileTool,
    editFile: editFileTool,
    runShell: runShellTool,
    runSensor: runSensorTool,
    gitCommit: gitCommitTool,
    listDirectory,
    searchCode,
  } as ToolSet;
}
