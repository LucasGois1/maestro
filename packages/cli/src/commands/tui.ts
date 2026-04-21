import { createEventBus } from '@maestro/core';
import {
  App,
  bridgeBusToStore,
  createTuiStore,
  playDemoEvents,
  resolveColorMode,
} from '@maestro/tui';
import { Command } from 'commander';
import { render, type Instance } from 'ink';
import { createElement } from 'react';

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

      renderApp({ store, bus, colorMode });

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
}

export function defaultRenderApp({
  store,
  colorMode,
}: DefaultRenderAppArgs): Instance {
  return render(createElement(App, { store, colorMode }));
}
