import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { createEventBus } from '@maestro/core';
import { App, bridgeBusToStore, createTuiStore } from '@maestro/tui';
import { Command } from 'commander';
import { render } from 'ink';
import { createElement } from 'react';

import { createAbortCommand } from './commands/abort.js';
import { createConfigCommand } from './commands/config.js';
import { createGitCommand } from './commands/git.js';
import { createInitCommand } from './commands/init.js';
import { createKBCommand } from './commands/kb.js';
import { createRunsCommand } from './commands/runs.js';
import { createTuiCommand } from './commands/tui.js';
import { resolveCliMode } from './mode.js';

const CLI_PACKAGE_NAME = '@maestro/cli';
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

type CliProgram = Pick<Command, 'parse'>;

type RunCliOptions = {
  program?: CliProgram;
  renderApp?: typeof renderInkApp;
  stdoutIsTTY?: boolean;
  version?: string;
};

type ExecuteCliFromProcessOptions = {
  moduleUrl?: string;
  run?: typeof runCli;
};

function renderInkApp(_version: string, stdoutIsTTY: boolean) {
  const bus = createEventBus();
  const store = createTuiStore();
  bridgeBusToStore(bus, store);
  const instance = render(createElement(App, { store }));

  if (!stdoutIsTTY) {
    setTimeout(() => {
      instance.unmount();
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
  program.addCommand(createRunsCommand());
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

  renderApp(version, stdoutIsTTY);
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
