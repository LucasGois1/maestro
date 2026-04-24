import { createRequire } from 'node:module';
import { cwd } from 'node:process';
import { pathToFileURL } from 'node:url';

import { createEventBus } from '@maestro/core';
import { loadConfigWithAutoResolvedModels } from '@maestro/provider';
import { createStateStore } from '@maestro/state';
import { App } from '@maestro/tui';
import { Command } from 'commander';
import { render, type Instance } from 'ink';
import { createElement } from 'react';

import { createAbortCommand } from './commands/abort.js';
import { createBackgroundCommand } from './commands/background.js';
import { createConfigCommand } from './commands/config.js';
import { createGitCommand } from './commands/git.js';
import { createInitCommand } from './commands/init.js';
import { createKBCommand } from './commands/kb.js';
import { createResumeCommand } from './commands/resume.js';
import { createRunCommand } from './commands/run.js';
import { createRunsCommand } from './commands/runs.js';
import { createTuiCommand } from './commands/tui.js';
import { resolveCliMode } from './mode.js';
import {
  createPersistEscalationHumanFeedback,
  createPersistPlanningInterviewResponse,
} from './persist-escalation-feedback.js';
import { createTuiCommandExecutor } from './tui-command-executor.js';
import { createTuiStoreForWorkspace } from './tui-workspace-store.js';
import { ensureWorkspaceTrustInteractive } from './workspace-trust.js';

const CLI_PACKAGE_NAME = '@maestro/cli';
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

type CliProgram = Pick<Command, 'parse'>;

type RunCliOptions = {
  program?: CliProgram;
  renderApp?: (
    version: string,
    stdoutIsTTY: boolean,
  ) => void | Promise<void>;
  stdoutIsTTY?: boolean;
  version?: string;
};

type ExecuteCliFromProcessOptions = {
  moduleUrl?: string;
  run?: typeof runCli;
};

async function renderInkApp(_version: string, stdoutIsTTY: boolean) {
  const repoRoot = cwd();
  const bus = createEventBus();
  const store = await createTuiStoreForWorkspace({ repoRoot });
  const stateStore = createStateStore({ repoRoot });
  const commandExecutor = createTuiCommandExecutor({
    repoRoot,
    bus,
    store: stateStore,
  });
  let instance: Instance | undefined;
  instance = render(
    createElement(App, {
      store,
      bus,
      commandExecutor,
      maestroVersion: packageJson.version,
      persistEscalationHumanFeedback: createPersistEscalationHumanFeedback({
        stateStore,
        tuiStore: store,
        resumeAfterPersist: {
          repoRoot,
          bus,
          loadConfig: loadConfigWithAutoResolvedModels,
        },
      }),
      persistPlanningInterviewResponse: createPersistPlanningInterviewResponse({
        stateStore,
        tuiStore: store,
        resumeAfterPersist: {
          repoRoot,
          bus,
          loadConfig: loadConfigWithAutoResolvedModels,
        },
      }),
      onForceExit: () => {
        instance?.unmount();
        process.exit(0);
      },
    }),
    {
      interactive: stdoutIsTTY && Boolean(process.stdin.isTTY),
      exitOnCtrlC: false,
    },
  );

  if (!stdoutIsTTY) {
    setTimeout(() => {
      instance?.unmount();
    }, 0);
  }
}

function createProgram(version: string) {
  const program = new Command()
    .name('maestro')
    .description('Multi-agent coding orchestrator')
    .version(version);

  program.addCommand(createAbortCommand());
  program.addCommand(createConfigCommand());
  program.addCommand(createInitCommand());
  program.addCommand(createGitCommand());
  program.addCommand(createKBCommand());
  program.addCommand(createRunCommand());
  program.addCommand(createResumeCommand());
  program.addCommand(createRunsCommand());
  program.addCommand(createBackgroundCommand());
  program.addCommand(createTuiCommand());

  return program;
}

export function runCli(args: string[], options: RunCliOptions = {}) {
  const version = options.version ?? packageJson.version;
  const mode = resolveCliMode(args);

  if (mode !== 'app') {
    const program = options.program ?? createProgram(version);

    program.parse(['node', 'maestro', ...args]);
    return;
  }

  const stdoutIsTTY = options.stdoutIsTTY ?? process.stdout.isTTY;
  const renderApp = options.renderApp ?? renderInkApp;

  void (async () => {
    const repoRoot = cwd();
    if (!(await ensureWorkspaceTrustInteractive(repoRoot))) {
      process.exit(0);
      return;
    }
    await renderApp(version, stdoutIsTTY);
  })();
}

function isExecutedAsEntrypoint(
  entrypointPath = process.argv[1],
  moduleUrl = import.meta.url,
) {
  if (!entrypointPath) {
    return false;
  }

  return moduleUrl === pathToFileURL(entrypointPath).href;
}

export function executeCliFromProcess(
  argv = process.argv,
  options: ExecuteCliFromProcessOptions = {},
) {
  const run = options.run ?? runCli;
  const moduleUrl = options.moduleUrl ?? import.meta.url;

  if (!isExecutedAsEntrypoint(argv[1], moduleUrl)) {
    return false;
  }

  run(argv.slice(2));

  return true;
}

executeCliFromProcess();

export { CLI_PACKAGE_NAME, createProgram };
