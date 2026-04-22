import { cwd as processCwd } from 'node:process';

import { ConfigValidationError, type LoadedConfig } from '@maestro/config';
import { loadConfigWithAutoResolvedModels } from '@maestro/provider';
import { createEventBus, type EventBus } from '@maestro/core';
import {
  PipelineRunNotFoundError,
  resumePipeline,
  type PipelineRunResult,
  type ResumePipelineOptions,
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

export type ResumeCommandOptions = {
  readonly io?: Io;
  readonly cwd?: () => string;
  readonly loadConfig?: typeof loadConfigWithAutoResolvedModels;
  readonly store?: StateStore;
  readonly resumePipeline?: (
    options: ResumePipelineOptions,
  ) => Promise<PipelineRunResult>;
  readonly renderApp?: typeof renderPipelineApp;
  readonly stdoutIsTTY?: boolean;
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

export function createResumeCommand(
  options: ResumeCommandOptions = {},
): Command {
  const io = options.io ?? defaultIo;
  const cwd = options.cwd ?? (() => processCwd());
  const configLoader = options.loadConfig ?? loadConfigWithAutoResolvedModels;
  const pipelineResumer = options.resumePipeline ?? resumePipeline;
  const renderApp = options.renderApp ?? renderPipelineApp;

  return new Command('resume')
    .description('Resume a paused Maestro pipeline run')
    .argument('[runId]', 'Run id; defaults to the latest run')
    .action(async (runId: string | undefined) => {
      const repoRoot = cwd();
      const loaded = await loadConfigOrExit(configLoader, repoRoot, io);
      if (!loaded) {
        process.exitCode = 1;
        return;
      }
      const store = options.store ?? createStateStore({ repoRoot });
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

      try {
        const result = await pipelineResumer({
          ...(runId !== undefined ? { runId } : {}),
          repoRoot,
          store,
          bus,
          config: loaded.resolved,
        });
        if (!stdoutIsTTY) {
          io.stdout(`Run completed: ${result.state.runId}`);
        }
      } catch (error) {
        if (error instanceof PipelineRunNotFoundError) {
          io.stderr(error.message);
        } else {
          io.stderr((error as Error).message);
        }
        process.exitCode = 1;
      } finally {
        instance?.unmount();
      }
    });
}
