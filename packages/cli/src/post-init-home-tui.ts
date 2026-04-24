import { existsSync } from 'node:fs';

import { createEventBus } from '@maestro/core';
import { editSprintContract, resolveContractPath } from '@maestro/contract';
import { loadConfigWithAutoResolvedModels } from '@maestro/provider';
import { createStateStore } from '@maestro/state';
import { App, resolveColorMode, type TuiState } from '@maestro/tui';
import { render, type Instance } from 'ink';
import { createElement } from 'react';

import { CLI_PACKAGE_VERSION } from './cli-version.js';
import {
  createPersistEscalationHumanFeedback,
  createPersistPlanningInterviewResponse,
} from './persist-escalation-feedback.js';
import { createTuiCommandExecutor } from './tui-command-executor.js';
import { listMaestroFilesUnderRepo } from './tui-kb.js';
import { createTuiStoreForWorkspace } from './tui-workspace-store.js';
import { ensureWorkspaceTrustInteractive } from './workspace-trust.js';

/**
 * After `maestro init` discovery apply, mounts the same idle shell as `maestro tui`
 * (home screen + command bar) so the process does not exit until the user leaves the TUI.
 */
export function mountPostInitHomeShell(options: {
  readonly repoRoot: string;
  readonly env?: NodeJS.ProcessEnv;
}): void {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    return;
  }
  void (async () => {
    if (!(await ensureWorkspaceTrustInteractive(options.repoRoot))) {
      process.exit(0);
      return;
    }
    const env = options.env ?? process.env;
    const colorMode = resolveColorMode({ args: [], env });
    const bus = createEventBus();
    const store = await createTuiStoreForWorkspace({
      repoRoot: options.repoRoot,
      mode: 'idle',
      colorMode,
    });
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
          maestroVersion: CLI_PACKAGE_VERSION,
          persistEscalationHumanFeedback: createPersistEscalationHumanFeedback({
            stateStore,
            tuiStore: store,
            resumeAfterPersist: {
              repoRoot: options.repoRoot,
              bus,
              loadConfig: loadConfigWithAutoResolvedModels,
            },
          }),
          persistPlanningInterviewResponse:
            createPersistPlanningInterviewResponse({
              stateStore,
              tuiStore: store,
              resumeAfterPersist: {
                repoRoot: options.repoRoot,
                bus,
                loadConfig: loadConfigWithAutoResolvedModels,
              },
            }),
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
          onForceExit: () => {
            inkInstance?.unmount();
            process.exit(0);
          },
        }),
        {
          interactive: true,
          exitOnCtrlC: false,
        },
      );
    };

    mount();
  })();
}
