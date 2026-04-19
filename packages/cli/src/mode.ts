export type CliMode = 'app' | 'help' | 'version';

const HELP_FLAGS = new Set(['-h', '--help']);
const VERSION_FLAGS = new Set(['-V', '--version']);

export function resolveCliMode(args: string[]): CliMode {
  if (args.some((arg) => VERSION_FLAGS.has(arg))) {
    return 'version';
  }

  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    return 'help';
  }

  return 'app';
}
