import { randomUUID } from 'node:crypto';

import {
  BranchNameError,
  computeBranchName,
  createWorktree,
} from '@maestro/git';
import { ConfigValidationError } from '@maestro/config';
import { loadConfigWithAutoResolvedModels } from '@maestro/provider';
import type { EventBus } from '@maestro/core';
import { runPipeline, resumePipeline } from '@maestro/pipeline';
import { createStateStore, type StateStore } from '@maestro/state';
import type {
  CommandCatalogEntry,
  TuiCommandExecutionResult,
  TuiCommandExecutor,
} from '@maestro/tui';

import { createAbortCommand } from './commands/abort.js';
import { createBackgroundCommand } from './commands/background.js';
import { createConfigCommand } from './commands/config.js';
import { createGitCommand } from './commands/git.js';
import { createKBCommand } from './commands/kb.js';
import { createRunsCommand } from './commands/runs.js';

export type CreateTuiCommandExecutorOptions = {
  readonly repoRoot: string;
  readonly bus: EventBus;
  readonly store?: StateStore;
  readonly randomUuid?: () => string;
};

type ParsedRunInput = {
  readonly prompt: string;
  readonly branch?: string;
  readonly noWorktree: boolean;
};

type CapturedIo = {
  readonly lines: string[];
  readonly errors: string[];
  readonly io: {
    stdout: (line: string) => void;
    stderr: (line: string) => void;
  };
};

function createCapturedIo(): CapturedIo {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    lines,
    errors,
    io: {
      stdout: (line) => lines.push(line),
      stderr: (line) => errors.push(line),
    },
  };
}

function tokenize(input: string): string[] {
  return (
    input.match(/"[^"]*"|'[^']*'|\S+/gu)?.map((token) => {
      if (
        (token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'"))
      ) {
        return token.slice(1, -1);
      }
      return token;
    }) ?? []
  );
}

function stripMaestroPrefix(tokens: readonly string[]): string[] {
  return tokens[0] === 'maestro' ? tokens.slice(1) : [...tokens];
}

function parseRunInput(tokens: readonly string[]): ParsedRunInput {
  let noWorktree = false;
  let branch: string | undefined;
  const prompt: string[] = [];
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '--no-worktree') {
      noWorktree = true;
      continue;
    }
    if (token === '--branch') {
      branch = tokens[i + 1];
      i += 1;
      continue;
    }
    if (token !== undefined) {
      prompt.push(token);
    }
  }
  return {
    prompt: prompt.join(' ').trim(),
    ...(branch !== undefined ? { branch } : {}),
    noWorktree,
  };
}

function formatError(error: unknown): string {
  if (error instanceof ConfigValidationError) {
    return [
      'Configuration is invalid:',
      ...error.issues.map(
        (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
    ].join('\n');
  }
  if (error instanceof BranchNameError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

async function executeRun(options: {
  readonly tokens: readonly string[];
  readonly repoRoot: string;
  readonly store: StateStore;
  readonly bus: EventBus;
  readonly randomUuid: () => string;
}): Promise<TuiCommandExecutionResult> {
  const parsed = parseRunInput(options.tokens);
  if (parsed.prompt.length === 0) {
    return { level: 'error', message: 'Usage: run <prompt>' };
  }
  const latest = await options.store.latest();
  if (latest?.status === 'running') {
    return {
      level: 'error',
      message: `A Maestro pipeline run is active (${latest.runId}).`,
    };
  }
  try {
    const loaded = await loadConfigWithAutoResolvedModels({ cwd: options.repoRoot });
    const runId = options.randomUuid();
    const branching = loaded.resolved.branching as {
      strategy: typeof loaded.resolved.branching.strategy;
      prefix: string;
      template?: string;
    };
    const branch =
      parsed.branch ??
      computeBranchName({
        strategy: branching.strategy,
        prefix: branching.prefix,
        ...(branching.template !== undefined
          ? { template: branching.template }
          : {}),
        context: { runId, prompt: parsed.prompt },
      });
    const worktree = parsed.noWorktree
      ? { path: options.repoRoot, branch }
      : await createWorktree({
          repoRoot: options.repoRoot,
          runId,
          branch,
        });
    void runPipeline({
      runId,
      prompt: parsed.prompt,
      branch,
      worktreePath: worktree.path,
      repoRoot: options.repoRoot,
      store: options.store,
      bus: options.bus,
      config: loaded.resolved,
    }).catch((error: unknown) => {
      options.bus.emit({
        type: 'pipeline.failed',
        runId,
        at: 'planning',
        error: formatError(error),
      });
    });
    return {
      level: 'info',
      message: `Run started: ${runId}`,
    };
  } catch (error) {
    return { level: 'error', message: formatError(error) };
  }
}

async function executeResume(options: {
  readonly tokens: readonly string[];
  readonly repoRoot: string;
  readonly store: StateStore;
  readonly bus: EventBus;
}): Promise<TuiCommandExecutionResult> {
  try {
    const loaded = await loadConfigWithAutoResolvedModels({ cwd: options.repoRoot });
    const rawId = options.tokens[1]?.trim();
    const explicitRunId =
      rawId !== undefined && rawId.length > 0 ? rawId : undefined;

    let runId: string | undefined = explicitRunId;
    if (runId === undefined) {
      const last = await options.store.latestResumable();
      if (!last) {
        return {
          level: 'error',
          message:
            'No runs recorded. Start one with `/run <prompt>` then use `/resume`.',
        };
      }
      runId = last.runId;
    }

    void resumePipeline({
      runId,
      repoRoot: options.repoRoot,
      store: options.store,
      bus: options.bus,
      config: loaded.resolved,
    }).catch((error: unknown) => {
      options.bus.emit({
        type: 'pipeline.failed',
        runId,
        at: 'planning',
        error: formatError(error),
      });
    });
    return {
      level: 'info',
      message: `Resume requested: ${runId}`,
    };
  } catch (error) {
    return { level: 'error', message: formatError(error) };
  }
}

async function executeCommanderBackedCommand(
  entry: CommandCatalogEntry,
  tokens: readonly string[],
  repoRoot: string,
  store: StateStore,
): Promise<TuiCommandExecutionResult> {
  const captured = createCapturedIo();
  const [root, ...args] = tokens;
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const command =
    entry.handlerId === 'abort'
      ? createAbortCommand({ io: captured.io, cwd: () => repoRoot, store })
      : entry.handlerId === 'runs'
        ? createRunsCommand({
            io: captured.io,
            cwd: () => repoRoot,
            store,
            confirm: async () => false,
          })
        : entry.handlerId === 'config'
          ? createConfigCommand(captured.io)
          : entry.handlerId === 'git'
            ? createGitCommand({ io: captured.io, cwd: () => repoRoot })
            : entry.handlerId === 'kb'
              ? createKBCommand({ io: captured.io, cwd: () => repoRoot })
              : entry.handlerId === 'background'
                ? createBackgroundCommand({
                    io: captured.io,
                    cwd: () => repoRoot,
                    store,
                  })
                : null;
  if (!command || root === undefined) {
    return { level: 'error', message: `Unsupported command: ${entry.command}` };
  }
  await command.parseAsync(args, { from: 'user' });
  const failed = process.exitCode !== undefined && process.exitCode !== 0;
  process.exitCode = previousExitCode;
  const output = [...captured.lines, ...captured.errors].join('\n');
  return {
    level: failed ? 'error' : 'info',
    message: output || `Command completed: ${entry.command}`,
  };
}

export function createTuiCommandExecutor({
  repoRoot,
  bus,
  store = createStateStore({ repoRoot }),
  randomUuid = () => randomUUID(),
}: CreateTuiCommandExecutorOptions): TuiCommandExecutor {
  return async ({ input, command }) => {
    const tokens = stripMaestroPrefix(tokenize(input));
    if (command.handlerId === 'run') {
      return executeRun({ tokens, repoRoot, store, bus, randomUuid });
    }
    if (command.handlerId === 'resume') {
      return executeResume({ tokens, repoRoot, store, bus });
    }
    if (command.handlerId === 'tui') {
      return { level: 'warn', message: 'Already inside the TUI.' };
    }
    return executeCommanderBackedCommand(command, tokens, repoRoot, store);
  };
}
