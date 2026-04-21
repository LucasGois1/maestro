import { createEventBus } from '@maestro/core';
import { editSprintContract, resolveContractPath } from '@maestro/contract';
import {
  App,
  bridgeBusToStore,
  createTuiStore,
  playDemoEvents,
  resolveColorMode,
  type TuiState,
} from '@maestro/tui';
import { existsSync } from 'node:fs';
import { cwd } from 'node:process';
import { Command } from 'commander';
import { render, type Instance } from 'ink';
import { createElement } from 'react';

import { listMaestroFilesUnderRepo } from '../tui-kb.js';

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

export function createTuiCommand(options: CreateTuiCommandOptions = {}): Command {
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
      const env = options.env ?? process.env;
      const renderApp = options.renderApp ?? defaultRenderApp;
      const startDemo = options.startDemo ?? playDemoEvents;

      const colorMode = resolveColorMode({
        args: flags.color === false ? ['--no-color'] : [],
        env,
      });

      const bus = createEventBus();
      const store = createTuiStore({ colorMode });
      bridgeBusToStore(bus, store);

      const repoRoot = cwd();
      const kbFiles = listMaestroFilesUnderRepo(repoRoot);

      let inkInstance: Instance | undefined;

      const mount = () => {
        inkInstance = renderApp({
          store,
          bus,
          colorMode,
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
        });
      };

      mount();

      if (flags.demo) {
        startDemo(bus);
      }
    });
  return command;
}

export interface DefaultRenderAppArgs {
  readonly store: ReturnType<typeof createTuiStore>;
  readonly bus: ReturnType<typeof createEventBus>;
  readonly colorMode: ReturnType<typeof resolveColorMode>;
  readonly kbExplorer?: {
    readonly repoLabel: string;
    readonly files: ReturnType<typeof listMaestroFilesUnderRepo>;
  };
  readonly editPlan?: {
    readonly resolveContractPath: (state: TuiState) => string | null;
    readonly onEditPath: (path: string) => void | Promise<void>;
  };
}

export function defaultRenderApp({
  store,
  bus,
  colorMode,
  kbExplorer,
  editPlan,
}: DefaultRenderAppArgs): Instance {
  return render(
    createElement(App, {
      store,
      bus,
      colorMode,
      ...(kbExplorer ? { kbExplorer } : {}),
      ...(editPlan ? { editPlan } : {}),
    }),
  );
}
