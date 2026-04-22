import { existsSync } from 'node:fs';

import { createEventBus } from '@maestro/core';
import { editSprintContract, resolveContractPath } from '@maestro/contract';
import { createStateStore } from '@maestro/state';
import {
  App,
  bridgeBusToStore,
  createTuiStore,
  resolveColorMode,
  type TuiState,
} from '@maestro/tui';
import { render, type Instance } from 'ink';
import { createElement } from 'react';

import { createTuiCommandExecutor } from './tui-command-executor.js';
import { listMaestroFilesUnderRepo } from './tui-kb.js';

/**
 * After `maestro init` discovery apply, mounts the same idle shell as `maestro tui`
 * (panels + command bar) so the process does not exit until the user leaves the TUI.
 */
export function mountPostInitHomeShell(options: {
  readonly repoRoot: string;
  readonly env?: NodeJS.ProcessEnv;
}): void {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    return;
  }
  const env = options.env ?? process.env;
  const colorMode = resolveColorMode({ args: [], env });
  const bus = createEventBus();
  const store = createTuiStore({ mode: 'idle', colorMode });
  bridgeBusToStore(bus, store);
  const stateStore = createStateStore({ repoRoot: options.repoRoot });
  const kbFiles = listMaestroFilesUnderRepo(options.repoRoot);
  const commandExecutor = createTuiCommandExecutor({
    repoRoot: options.repoRoot,
    bus,
    store: stateStore,
  });

  let inkInstance: Instance | undefined;

  const mount = () => {
    inkInstance = render(
      createElement(App, {
        store,
        bus,
        colorMode,
        kbExplorer: {
          repoLabel: options.repoRoot,
          files: kbFiles,
        },
        editPlan: {
          resolveContractPath: (state: TuiState) => {
            const runId = state.runId;
            const spIdx = state.pipeline.sprintIdx;
            if (!runId || spIdx === null) {
              return null;
            }
            const path = resolveContractPath({
              repoRoot: options.repoRoot,
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
      }),
      {
        interactive: true,
      },
    );
  };

  mount();
}
