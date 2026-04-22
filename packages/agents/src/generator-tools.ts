import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { MaestroConfig } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import { commitSprint } from '@maestro/git';
import {
  composePolicy,
  denyAllPrompter,
  runShellCommand,
} from '@maestro/sandbox';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import { resolvePathUnderRepo } from './planner/safe-repo-path.js';
import { executeRunSensorTool } from './run-sensor-tool.js';
import { createPlannerToolSet, readRepoFileContent } from './repo-tools.js';

const readFileInput = z.object({
  path: z.string().min(1).describe('Caminho relativo à raiz do repositório.'),
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
  readonly repoRoot: string;
  readonly config: MaestroConfig;
  readonly runId: string;
  readonly bus: EventBus;
  readonly maestroDir?: string;
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
 * Ferramentas do Generator: ficheiros, shell com policy, sensor, git, listagem, ripgrep.
 */
export function createGeneratorToolSet(
  ctx: GeneratorToolContext,
  hooks?: GeneratorToolHooks,
): ToolSet {
  const { listDirectory, searchCode } = createPlannerToolSet(ctx.repoRoot);
  const policy = policyFromConfig(ctx.config);

  const readFileTool = tool({
    description: 'Lê um ficheiro de texto sob a raiz do repositório.',
    inputSchema: readFileInput,
    execute: async ({ path: p }) => {
      const norm = p.trim().replace(/^[/\\]+/u, '');
      try {
        return await readRepoFileContent(
          ctx.repoRoot,
          norm.replace(/\\/gu, '/'),
        );
      } catch (e) {
        return `Erro ao ler: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const writeFileTool = tool({
    description:
      'Cria ou substitui um ficheiro sob a raiz do repositório (caminho relativo).',
    inputSchema: writeFileInput,
    execute: async ({ path: p, content }) => {
      try {
        const abs = resolvePathUnderRepo(
          ctx.repoRoot,
          p
            .trim()
            .replace(/^[/\\]+/u, '')
            .replace(/\\/gu, '/'),
        );
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, content, 'utf8');
        return `Escrito: ${p}`;
      } catch (e) {
        return `Erro ao escrever: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const editFileTool = tool({
    description:
      'Substitui uma única ocorrência de oldStr por newStr no ficheiro.',
    inputSchema: editFileInput,
    execute: async ({ path: p, oldStr, newStr }) => {
      try {
        const abs = resolvePathUnderRepo(
          ctx.repoRoot,
          p
            .trim()
            .replace(/^[/\\]+/u, '')
            .replace(/\\/gu, '/'),
        );
        const before = await readFile(abs, 'utf8');
        const ix = before.indexOf(oldStr);
        if (ix === -1) {
          return 'oldStr não encontrado no ficheiro.';
        }
        if (before.indexOf(oldStr, ix + 1) !== -1) {
          return 'oldStr não é único; torne o fragmento mais específico.';
        }
        const after = `${before.slice(0, ix)}${newStr}${before.slice(ix + oldStr.length)}`;
        await writeFile(abs, after, 'utf8');
        return `Editado: ${p}`;
      } catch (e) {
        return `Erro ao editar: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const runShellTool = tool({
    description:
      'Executa comando no shell na raiz do repo; sujeito ao permission model.',
    inputSchema: runShellInput,
    execute: async ({ cmd, args }) => {
      try {
        const result = await runShellCommand({
          cmd,
          args,
          cwd: ctx.repoRoot,
          runId: ctx.runId,
          repoRoot: ctx.repoRoot,
          ...(ctx.maestroDir !== undefined
            ? { maestroDir: ctx.maestroDir }
            : {}),
          policy,
          approver: denyAllPrompter,
          timeoutMs: 120_000,
        });
        const head =
          result.exitCode === 0 ? 'OK' : `exit ${result.exitCode.toString()}`;
        const out = [head, result.stdout, result.stderr]
          .filter((s) => s.length > 0)
          .join('\n');
        return out.slice(0, 24_000);
      } catch (e) {
        return `Erro: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const runSensorTool = tool({
    description:
      'Executa um sensor registado (computacional ou inferencial) por id.',
    inputSchema: runSensorInput,
    execute: async ({ id }) =>
      executeRunSensorTool(
        {
          repoRoot: ctx.repoRoot,
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
      'Faz commit com mensagem Conventional Commits (type, scope opcional, subject).',
    inputSchema: gitCommitInput,
    execute: async ({ type, scope, subject }) => {
      try {
        const sha = await commitSprint({
          cwd: ctx.repoRoot,
          type,
          ...(scope !== undefined ? { scope } : {}),
          subject,
          addAll: true,
        });
        return `Committed ${sha}`;
      } catch (e) {
        return `Erro git: ${e instanceof Error ? e.message : String(e)}`;
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
