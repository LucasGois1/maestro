import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { MaestroConfig } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import {
  buildPrCommand,
  detectRemote,
  executePrCommand,
  parsePrUrlFromCliOutput,
  UnsupportedPlatformError,
} from '@maestro/git';
import {
  composePolicy,
  denyAllPrompter,
  runShellCommand,
} from '@maestro/sandbox';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import { executeRunSensorTool } from './run-sensor-tool.js';
import { createArchitectToolSet } from './repo-tools.js';
import { resolvePathUnderRepo } from './planner/safe-repo-path.js';

const writeFileInput = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const runShellInput = z.object({
  cmd: z.string().min(1),
  args: z.array(z.string()).default([]),
});

const createPrInput = z.object({
  title: z.string().min(1),
  body: z.string(),
  labels: z.array(z.string().min(1)).min(1),
});

const runSensorInput = z.object({
  sensorId: z.string().min(1),
});

export type GardenerToolContext = {
  readonly repoRoot: string;
  readonly worktreeRoot: string;
  readonly config: MaestroConfig;
  readonly runId: string;
  readonly bus: EventBus;
  readonly maestroDir?: string;
  readonly codeDiff?: string;
};

function policyFromConfig(config: MaestroConfig) {
  return composePolicy({
    mode: config.permissions.mode,
    allowlist: [...config.permissions.allowlist],
    denylist: [...config.permissions.denylist],
  });
}

/**
 * Tools do Doc Gardener: leitura/listagem/pesquisa (architect), escrita, shell, PR, runSensor.
 */
export function createGardenerToolSet(ctx: GardenerToolContext): ToolSet {
  const policy = policyFromConfig(ctx.config);
  const base = createArchitectToolSet(ctx.worktreeRoot, ctx.repoRoot);

  const writeFileTool = tool({
    description:
      'Write a UTF-8 file relative to the repository root (creates parent dirs).',
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

  const runShellTool = tool({
    description:
      'Run a shell command in the worktree (git, gh, …); subject to permission policy.',
    inputSchema: runShellInput,
    execute: async ({ cmd, args }) => {
      try {
        const result = await runShellCommand({
          cmd,
          args,
          cwd: ctx.worktreeRoot,
          runId: ctx.runId,
          repoRoot: ctx.repoRoot,
          ...(ctx.maestroDir !== undefined
            ? { maestroDir: ctx.maestroDir }
            : {}),
          policy,
          approver: denyAllPrompter,
          timeoutMs: 180_000,
        });
        const head =
          result.exitCode === 0 ? 'OK' : `exit ${result.exitCode.toString()}`;
        const out = [head, result.stdout, result.stderr]
          .filter((s) => s.length > 0)
          .join('\n');
        return out.slice(0, 32_000);
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const createPullRequest = tool({
    description:
      'Open a pull request via gh (GitHub) or glab (GitLab) using the current branch.',
    inputSchema: createPrInput,
    execute: async ({ title, body, labels }) => {
      try {
        const remote = await detectRemote({ cwd: ctx.worktreeRoot });
        if (!remote || remote.platform === 'unknown') {
          return 'No supported git remote (need GitHub or GitLab URL on origin).';
        }
        const cmd = buildPrCommand({
          platform: remote.platform,
          pr: {
            title,
            summary: body,
            sprints: [],
            labels,
          },
        });
        const result = await executePrCommand({
          command: cmd,
          cwd: ctx.worktreeRoot,
        });
        const parsed = parsePrUrlFromCliOutput(result.stdout);
        const url = parsed.prUrl ?? '(see stdout)';
        return JSON.stringify({
          ok: result.code === 0,
          code: result.code,
          prUrl: parsed.prUrl,
          prNumber: parsed.prNumber,
          url,
          stdout: result.stdout.slice(0, 4000),
        });
      } catch (e) {
        if (e instanceof UnsupportedPlatformError) {
          return e.message;
        }
        return `createPr error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const runSensorTool = tool({
    description:
      'Run a sensor from sensors.json by id (validates repo state; optional diff from context).',
    inputSchema: runSensorInput,
    execute: async ({ sensorId }) => {
      try {
        return await executeRunSensorTool(
          {
            repoRoot: ctx.repoRoot,
            executionRoot: ctx.worktreeRoot,
            runId: ctx.runId,
            bus: ctx.bus,
            policy,
            config: ctx.config,
            ...(ctx.maestroDir !== undefined
              ? { maestroDir: ctx.maestroDir }
              : {}),
            ...(ctx.codeDiff !== undefined ? { diff: ctx.codeDiff } : {}),
          },
          sensorId,
        );
      } catch (e) {
        return `runSensor error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  return {
    ...base,
    writeFile: writeFileTool,
    runShell: runShellTool,
    createPullRequest,
    runSensor: runSensorTool,
  } as ToolSet;
}
