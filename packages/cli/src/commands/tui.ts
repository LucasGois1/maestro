import { createEventBus } from '@maestro/core';
import { editSprintContract, resolveContractPath } from '@maestro/contract';
import { createStateStore, type StateStore } from '@maestro/state';
import { App, playDemoEvents, resolveColorMode, type TuiState } from '@maestro/tui';
import { existsSync } from 'node:fs';
import { cwd } from 'node:process';
import { Command } from 'commander';
import { render, type Instance } from 'ink';
import { createElement } from 'react';

import { CLI_PACKAGE_VERSION } from '../cli-version.js';
import { createPersistEscalationHumanFeedback } from '../persist-escalation-feedback.js';
import { listMaestroFilesUnderRepo } from '../tui-kb.js';
import { createTuiCommandExecutor } from '../tui-command-executor.js';
import { createTuiStoreForWorkspace } from '../tui-workspace-store.js';
import { ensureWorkspaceTrustInteractive } from '../workspace-trust.js';

export interface CreateTuiCommandOptions {
  readonly renderApp?: typeof defaultRenderApp;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly startDemo?: typeof playDemoEvents;
}

export interface TuiCommandFlags {
  readonly demo?: boolean;
  readonly color?: boolean;
  readonly fixture?: string;
}

export function createTuiCommand(
  options: CreateTuiCommandOptions = {},
): Command {
  const command = new Command('tui');
  command
    .description('Launch the Maestro TUI shell (optionally in demo mode)')
    .option('--demo', 'Play a deterministic demo event stream after launch')
    .option('--no-color', 'Disable ANSI color output')
    .option(
      '--fixture <path>',
      'Reserved: path to a JSON file describing a custom event fixture',
    )
    .action((flags: TuiCommandFlags) => {
      return (async () => {
        const env = options.env ?? process.env;
        const renderApp = options.renderApp ?? defaultRenderApp;
        const startDemo = options.startDemo ?? playDemoEvents;

        const repoRoot = cwd();
        if (!(await ensureWorkspaceTrustInteractive(repoRoot))) {
          process.exit(0);
          return;
        }

        const colorMode = resolveColorMode({
          args: flags.color === false ? ['--no-color'] : [],
          env,
        });

        const bus = createEventBus();
        const store = await createTuiStoreForWorkspace({ repoRoot, colorMode });
        const stateStore = createStateStore({ repoRoot });
        const kbFiles = listMaestroFilesUnderRepo(repoRoot);
        const commandExecutor = createTuiCommandExecutor({
          repoRoot,
          bus,
          store: stateStore,
        });

        let inkInstance: Instance | undefined;

        const mount = () => {
          inkInstance = renderApp({
            store,
            bus,
            colorMode,
            stateStore,
            kbExplorer: {
              repoLabel: repoRoot,
              files: kbFiles,
            },
            editPlan: {
              resolveContractPath: (state) => {
                const runId = state.runId;
                const spIdx = state.pipeline.sprintIdx;
                if (!runId || spIdx === null) {
                  return null;
                }
                const path = resolveContractPath({
                  repoRoot,
                  runId,
                  sprint: spIdx + 1,
                });
                return existsSync(path) ? path : null;
              },
              onEditPath: async (filePath) => {
                inkInstance?.unmount();
                try {
                  await editSprintContract({ filePath });
                } finally {
                  mount();
                }
              },
            },
            commandExecutor,
            onForceExit: () => {
              inkInstance?.unmount();
              process.exit(0);
            },
          });
        };

        mount();

        if (flags.demo) {
          startDemo(bus);
        }
      })();
    });
  return command;
}

export interface DefaultRenderAppArgs {
  readonly store: Awaited<ReturnType<typeof createTuiStoreForWorkspace>>;
  readonly bus: ReturnType<typeof createEventBus>;
  readonly colorMode: ReturnType<typeof resolveColorMode>;
  readonly stateStore: StateStore;
  readonly kbExplorer?: {
    readonly repoLabel: string;
    readonly files: ReturnType<typeof listMaestroFilesUnderRepo>;
  };
  readonly editPlan?: {
    readonly resolveContractPath: (state: TuiState) => string | null;
    readonly onEditPath: (path: string) => void | Promise<void>;
  };
  readonly commandExecutor?: Parameters<typeof App>[0]['commandExecutor'];
  readonly onForceExit?: Parameters<typeof App>[0]['onForceExit'];
}

export function defaultRenderApp({
  store,
  bus,
  colorMode,
  stateStore,
  kbExplorer,
  editPlan,
  commandExecutor,
  onForceExit,
}: DefaultRenderAppArgs): Instance {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const persistEscalationHumanFeedback = createPersistEscalationHumanFeedback({
    stateStore,
    tuiStore: store,
  });
  return render(
    createElement(App, {
      store,
      bus,
      colorMode,
      maestroVersion: CLI_PACKAGE_VERSION,
      persistEscalationHumanFeedback,
      ...(kbExplorer ? { kbExplorer } : {}),
      ...(editPlan ? { editPlan } : {}),
      ...(commandExecutor ? { commandExecutor } : {}),
      ...(onForceExit !== undefined ? { onForceExit } : {}),
    }),
    {
      interactive,
      ...(commandExecutor !== undefined ? { exitOnCtrlC: false } : {}),
    },
  );
}
