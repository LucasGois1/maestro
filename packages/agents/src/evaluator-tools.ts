import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { MaestroConfig } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import {
  composePolicy,
  denyAllPrompter,
  runShellCommand,
} from '@maestro/sandbox';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

import { resolvePathUnderRepo } from './planner/safe-repo-path.js';
import { readRepoFileContent } from './repo-tools.js';
import { executeRunSensorTool } from './run-sensor-tool.js';

const execFileAsync = promisify(execFile);

const readFileInput = z.object({
  path: z.string().min(1).describe('Relative path under the worktree root.'),
});

const runShellInput = z.object({
  cmd: z.string().min(1),
  args: z.array(z.string()).default([]),
});

const runSensorInput = z.object({
  id: z.string().min(1).describe('Sensor id from .maestro/sensors.json'),
});

const navigateBrowserInput = z.object({
  url: z
    .string()
    .min(1)
    .describe('http(s) URL — HTTP snapshot only, not real browser.'),
});

const querySqliteInput = z.object({
  dbPath: z
    .string()
    .min(1)
    .describe('SQLite file path relative to worktree root.'),
  sql: z.string().min(1).describe('Single SELECT statement.'),
});

const callApiInput = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
});

export type EvaluatorToolContext = {
  readonly repoRoot: string;
  readonly worktreeRoot: string;
  readonly config: MaestroConfig;
  readonly runId: string;
  readonly bus: EventBus;
  readonly maestroDir?: string;
  /** Diff do sprint para sensores inferenciais (ex.: code-review). */
  readonly codeDiff?: string;
  readonly sprintContract?: string;
};

export type EvaluatorToolHooks = {
  readonly runSensor?: (id: string) => Promise<string>;
  readonly querySqlite?: (dbPath: string, sql: string) => Promise<string>;
  readonly navigateBrowser?: (url: string) => Promise<string>;
  readonly callApi?: (input: z.infer<typeof callApiInput>) => Promise<string>;
};

function policyFromConfig(config: MaestroConfig) {
  return composePolicy({
    mode: config.permissions.mode,
    allowlist: [...config.permissions.allowlist],
    denylist: [...config.permissions.denylist],
  });
}

function parsePublicHttpUrl(urlStr: string): URL | null {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0') {
    return true;
  }
  if (h === '127.0.0.1' || h === '::1') {
    return true;
  }
  if (/^(10\.|192\.168\.)/u.test(h)) {
    return true;
  }
  const m = /^172\.(\d+)\./u.exec(h);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) {
      return true;
    }
  }
  return false;
}

function assertUrlAllowed(u: URL): string | null {
  if (isBlockedHost(u.hostname)) {
    return 'URL host is blocked (local/private networks).';
  }
  return null;
}

/**
 * Ferramentas do Evaluator: leitura no worktree, shell, sensores, HTTP snapshot, SQLite, API.
 */
export function createEvaluatorToolSet(
  ctx: EvaluatorToolContext,
  hooks?: EvaluatorToolHooks,
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

  const runShellTool = tool({
    description:
      'Run a shell command with cwd = worktree root; subject to permission policy.',
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
    description: 'Run a registered sensor by id (see .maestro/sensors.json).',
    inputSchema: runSensorInput,
    execute: async ({ id }) =>
      executeRunSensorTool(
        {
          repoRoot: ctx.repoRoot,
          executionRoot: ctx.worktreeRoot,
          runId: ctx.runId,
          bus: ctx.bus,
          ...(ctx.maestroDir !== undefined
            ? { maestroDir: ctx.maestroDir }
            : {}),
          policy,
          config: ctx.config,
          ...(ctx.codeDiff !== undefined ? { diff: ctx.codeDiff } : {}),
          ...(ctx.sprintContract !== undefined
            ? { sprintContract: ctx.sprintContract }
            : {}),
        },
        id,
        hooks?.runSensor,
      ),
  });

  const navigateBrowserTool = tool({
    description:
      'HTTP GET snapshot of a public URL (not Chrome DevTools). Body truncated.',
    inputSchema: navigateBrowserInput,
    execute: async ({ url }) => {
      if (hooks?.navigateBrowser) {
        return hooks.navigateBrowser(url);
      }
      const u = parsePublicHttpUrl(url);
      if (!u) {
        return 'Invalid or non-http(s) URL.';
      }
      const blocked = assertUrlAllowed(u);
      if (blocked) {
        return blocked;
      }
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 15_000);
      try {
        const res = await fetch(u, {
          method: 'GET',
          redirect: 'follow',
          signal: ac.signal,
        });
        const text = await res.text();
        const head = `status ${res.status.toString()} ${res.statusText}`;
        const slice = text.slice(0, 32_000);
        const tail = text.length > 32_000 ? '\n…[truncated]' : '';
        return `${head}\n\n${slice}${tail}`;
      } catch (e) {
        return `fetch failed: ${e instanceof Error ? e.message : String(e)}`;
      } finally {
        clearTimeout(t);
      }
    },
  });

  const querySqliteTool = tool({
    description:
      'Run a single read-only SELECT via sqlite3 CLI (must exist in PATH).',
    inputSchema: querySqliteInput,
    execute: async ({ dbPath, sql }) => {
      if (hooks?.querySqlite) {
        return hooks.querySqlite(dbPath, sql);
      }
      const trimmed = sql.trim();
      if (!/^select\b/is.test(trimmed)) {
        return 'Only SELECT queries are allowed.';
      }
      const singleStmt = trimmed.replace(/;+\s*$/u, '');
      if (singleStmt.includes(';')) {
        return 'Multiple statements are not allowed.';
      }
      try {
        const abs = resolvePathUnderRepo(
          ctx.worktreeRoot,
          dbPath
            .trim()
            .replace(/^[/\\]+/u, '')
            .replace(/\\/gu, '/'),
        );
        const { stdout, stderr } = await execFileAsync(
          'sqlite3',
          [abs, singleStmt],
          { maxBuffer: 256_000 },
        );
        const err = stderr.trim();
        const out = stdout.slice(0, 24_000);
        return err.length > 0 ? `${out}\nstderr: ${err}` : out;
      } catch (e) {
        const err = e as NodeJS.ErrnoException & { stderr?: string };
        if (err.code === 'ENOENT') {
          return 'sqlite3 CLI not found in PATH.';
        }
        return `sqlite3 error: ${err instanceof Error ? err.message : String(e)}`;
      }
    },
  });

  const callApiTool = tool({
    description:
      'HTTP request to an allowed public host (blocks localhost/private).',
    inputSchema: callApiInput,
    execute: async (input) => {
      if (hooks?.callApi) {
        return hooks.callApi(input);
      }
      const u = parsePublicHttpUrl(input.url);
      if (!u) {
        return 'Invalid or non-http(s) URL.';
      }
      const blocked = assertUrlAllowed(u);
      if (blocked) {
        return blocked;
      }
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 30_000);
      try {
        const res = await fetch(u, {
          method: input.method,
          ...(input.headers !== undefined ? { headers: input.headers } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          signal: ac.signal,
        });
        const text = await res.text();
        const head = `status ${res.status.toString()} ${res.statusText}`;
        const slice = text.slice(0, 24_000);
        const tail = text.length > 24_000 ? '\n…[truncated]' : '';
        return `${head}\n\n${slice}${tail}`;
      } catch (e) {
        return `fetch failed: ${e instanceof Error ? e.message : String(e)}`;
      } finally {
        clearTimeout(t);
      }
    },
  });

  return {
    readFile: readFileTool,
    runShell: runShellTool,
    runSensor: runSensorTool,
    navigateBrowser: navigateBrowserTool,
    querySqlite: querySqliteTool,
    callApi: callApiTool,
  } as ToolSet;
}
