import { randomUUID } from 'node:crypto';
import { cwd as processCwd } from 'node:process';

import {
  BranchNameError,
  computeBranchName,
  createWorktree,
  type CreateWorktreeOptions,
  type WorktreeInfo,
} from '@maestro/git';
import { ConfigValidationError, type LoadedConfig } from '@maestro/config';
import { loadConfigWithAutoResolvedModels } from '@maestro/provider';
import { createEventBus, type EventBus } from '@maestro/core';
import {
  runPipeline,
  type PipelineRunOptions,
  type PipelineRunResult,
} from '@maestro/pipeline';
import { createStateStore, type StateStore } from '@maestro/state';
import { App, bridgeBusToStore, createTuiStore } from '@maestro/tui';
import { Command } from 'commander';
import { render, type Instance } from 'ink';
import { createElement } from 'react';

import { createTuiCommandExecutor } from '../tui-command-executor.js';

type Io = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

const defaultIo: Io = {
  /* v8 ignore next */
  stdout: (line) => process.stdout.write(`${line}\n`),
  /* v8 ignore next */
  stderr: (line) => process.stderr.write(`${line}\n`),
};

export type RunCommandOptions = {
  readonly io?: Io;
  readonly cwd?: () => string;
  readonly loadConfig?: typeof loadConfigWithAutoResolvedModels;
  readonly store?: StateStore;
  readonly randomUuid?: () => string;
  readonly createWorktree?: (
    options: CreateWorktreeOptions,
  ) => Promise<WorktreeInfo>;
  readonly runPipeline?: (
    options: PipelineRunOptions,
  ) => Promise<PipelineRunResult>;
  readonly renderApp?: typeof renderPipelineApp;
  readonly stdoutIsTTY?: boolean;
};

type RunFlags = {
  readonly worktree?: boolean;
  readonly branch?: string;
};

function formatConfigIssues(error: ConfigValidationError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

async function loadConfigOrExit(
  loader: typeof loadConfigWithAutoResolvedModels,
  repoRoot: string,
  io: Io,
): Promise<LoadedConfig | null> {
  try {
    return await loader({ cwd: repoRoot });
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      io.stderr('Configuration is invalid:');
      io.stderr(formatConfigIssues(error));
      return null;
    }
    io.stderr((error as Error).message);
    return null;
  }
}

function renderPipelineApp(options: {
  readonly store: ReturnType<typeof createTuiStore>;
  readonly bus: EventBus;
  readonly commandExecutor?: Parameters<typeof App>[0]['commandExecutor'];
}): Instance {
  return render(
    createElement(App, {
      store: options.store,
      bus: options.bus,
      ...(options.commandExecutor
        ? { commandExecutor: options.commandExecutor }
        : {}),
    }),
    {
      interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    },
  );
}

function resolveBranch(options: {
  readonly explicitBranch?: string;
  readonly config: LoadedConfig['resolved'];
  readonly runId: string;
  readonly prompt: string;
}): string {
  if (options.explicitBranch?.trim()) {
    return options.explicitBranch.trim();
  }
  const branching = options.config.branching as {
    strategy: LoadedConfig['resolved']['branching']['strategy'];
    prefix: string;
    template?: string;
  };
  return computeBranchName({
    strategy: branching.strategy,
    prefix: branching.prefix,
    ...(branching.template !== undefined
      ? { template: branching.template }
      : {}),
    context: {
      runId: options.runId,
      prompt: options.prompt,
    },
  });
}

export function createRunCommand(options: RunCommandOptions = {}): Command {
  const io = options.io ?? defaultIo;
  const cwd = options.cwd ?? (() => processCwd());
  const configLoader = options.loadConfig ?? loadConfigWithAutoResolvedModels;
  const randomUuid = options.randomUuid ?? (() => randomUUID());
  const worktreeCreator = options.createWorktree ?? createWorktree;
  const pipelineRunner = options.runPipeline ?? runPipeline;
  const renderApp = options.renderApp ?? renderPipelineApp;

  return new Command('run')
    .description('Start a Maestro pipeline run from a task prompt')
    .argument('<prompt...>', 'Task prompt to send to the Planner')
    .option(
      '--no-worktree',
      'Run in the current checkout instead of a worktree',
    )
    .option('--branch <branch>', 'Override the generated branch name')
    .action(async (promptParts: string[], flags: RunFlags) => {
      const repoRoot = cwd();
      const loaded = await loadConfigOrExit(configLoader, repoRoot, io);
      if (!loaded) {
        process.exitCode = 1;
        return;
      }

      const store = options.store ?? createStateStore({ repoRoot });
      const latest = await store.latest();
      if (latest?.status === 'running') {
        io.stderr(
          `A Maestro pipeline run is active (${latest.runId}, status: running). Stop or wait before starting a new run.`,
        );
        process.exitCode = 2;
        return;
      }

      const prompt = promptParts.join(' ').trim();
      const runId = randomUuid();
      let branch: string;
      try {
        branch = resolveBranch({
          ...(flags.branch !== undefined
            ? { explicitBranch: flags.branch }
            : {}),
          config: loaded.resolved,
          runId,
          prompt,
        });
      } catch (error) {
        io.stderr(
          error instanceof BranchNameError
            ? error.message
            : (error as Error).message,
        );
        process.exitCode = 1;
        return;
      }

      const worktree =
        flags.worktree === false
          ? { path: repoRoot, branch }
          : await worktreeCreator({ repoRoot, runId, branch });

      const bus = createEventBus();
      const tuiStore = createTuiStore();
      bridgeBusToStore(bus, tuiStore);
      const stdoutIsTTY = options.stdoutIsTTY ?? process.stdout.isTTY;
      const commandExecutor = createTuiCommandExecutor({
        repoRoot,
        bus,
        store,
      });
      const instance = stdoutIsTTY
        ? renderApp({ store: tuiStore, bus, commandExecutor })
        : null;

      if (!stdoutIsTTY) {
        io.stdout(`Run started: ${runId}`);
      }

      try {
        const result = await pipelineRunner({
          runId,
          prompt,
          branch,
          worktreePath: worktree.path,
          repoRoot,
          store,
          bus,
          config: loaded.resolved,
        });
        if (!stdoutIsTTY) {
          io.stdout(`Run completed: ${result.state.runId}`);
        }
      } catch (error) {
        io.stderr((error as Error).message);
        process.exitCode = 1;
      } finally {
        instance?.unmount();
      }
    });
}
