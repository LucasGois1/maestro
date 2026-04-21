export type CliMode = 'app' | 'help' | 'version' | 'command';

const HELP_FLAGS = new Set(['-h', '--help']);
const VERSION_FLAGS = new Set(['-V', '--version']);

export const KNOWN_SUBCOMMANDS = new Set([
  'abort',
  'config',
  'git',
  'init',
  'kb',
  'runs',
  'tui',
]);

export function resolveCliMode(args: string[]): CliMode {
  if (args.some((arg) => VERSION_FLAGS.has(arg))) {
    return 'version';
  }

  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    return 'help';
  }

  const first = args[0];
  if (first !== undefined && KNOWN_SUBCOMMANDS.has(first)) {
    return 'command';
  }

  return 'app';
}
