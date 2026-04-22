import type { TuiColorMode } from '../state/store.js';

export interface ResolveColorModeInput {
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string | undefined>>;
}

const NO_COLOR_FLAGS = new Set(['--no-color', '--no-colors']);

export function resolveColorMode(
  input: ResolveColorModeInput = {},
): TuiColorMode {
  const args = input.args ?? [];
  const env = input.env ?? {};

  if (args.some((arg) => NO_COLOR_FLAGS.has(arg))) {
    return 'no-color';
  }

  const noColorEnv = env['NO_COLOR'];
  if (typeof noColorEnv === 'string' && noColorEnv.length > 0) {
    return 'no-color';
  }

  return 'color';
}
